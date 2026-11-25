import { db } from "../db/connection.js";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface FindingRow {
  id: number;
  tool: string;
  repo: string;
  rule_id: string;
  title: string;
  description: string | null;
  severity: Severity;
  file: string | null;
  line: number | null;
  cwe: string | null;
  status: string;
  first_seen_scan_id: number;
  last_seen_scan_id: number;
  fixed_at: string | null;
}

export interface FindingFilters {
  tool?: string | undefined;
  repo?: string | undefined;
  severity?: string | undefined;
  status?: string | undefined;
}

export function listFindings(filters: FindingFilters): FindingRow[] {
  const where: string[] = [];
  const params: Record<string, string> = {};
  for (const key of ["tool", "repo", "severity", "status"] as const) {
    const value = filters[key];
    if (value) {
      where.push(`${key} = @${key}`);
      params[key] = value;
    }
  }
  const sql = `
    SELECT id, tool, repo, rule_id, title, description, severity, file, line, cwe, status,
           first_seen_scan_id, last_seen_scan_id, fixed_at
    FROM findings
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY repo, file, line, tool`;
  return db.prepare(sql).all(params) as FindingRow[];
}

export function listRepos(): { repo: string; tools: string[]; lastScan: string | null }[] {
  const rows = db.prepare(`
    SELECT repo, group_concat(DISTINCT tool) AS tools, max(received_at) AS lastScan
    FROM scans GROUP BY repo ORDER BY repo`).all() as { repo: string; tools: string; lastScan: string | null }[];
  return rows.map((r) => ({ repo: r.repo, tools: r.tools.split(","), lastScan: r.lastScan }));
}

// ---------------------------------------------------------------------------
// Comparaison Semgrep <-> Bandit
// ---------------------------------------------------------------------------

/** Bandit écrit "./app.py", Semgrep "app.py" : on aligne les chemins avant de comparer. */
export const normalizePath = (p: string | null) => (p ?? "").replace(/\\/g, "/").replace(/^(\.\/)+/, "");

const SEVERITY_RANK: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };

/** Écart de lignes toléré pour rapprocher deux findings de même CWE (ex. Semgrep signale le début d'un bloc). */
export const LINE_TOLERANCE = 3;

export type MatchKind =
  | "match"        // même emplacement, même CWE, même sévérité
  | "divergent"    // même emplacement mais CWE et/ou sévérité différents
  | "semgrep_only"
  | "bandit_only";

export interface CompareGroup {
  repo: string;
  file: string;
  line: number | null;
  kind: MatchKind;
  /** Comment le rapprochement a été fait : ligne identique ou ligne voisine avec même CWE. */
  matchedBy: "same_line" | "nearby_cwe" | null;
  semgrep: FindingRow[];
  bandit: FindingRow[];
  differences: {
    severity: boolean;
    cwe: boolean;
    line: boolean;
  };
}

export interface CompareResult {
  repo: string | null;
  lineTolerance: number;
  summary: Record<MatchKind, number> & { semgrepTotal: number; banditTotal: number };
  groups: CompareGroup[];
}

const maxSeverity = (rows: FindingRow[]) =>
  rows.reduce<Severity | null>(
    (acc, r) => (acc === null || SEVERITY_RANK[r.severity] > SEVERITY_RANK[acc] ? r.severity : acc),
    null,
  );

const cweSet = (rows: FindingRow[]) => new Set(rows.map((r) => r.cwe).filter((c): c is string => !!c));

function classify(repo: string, file: string, line: number | null, semgrep: FindingRow[], bandit: FindingRow[],
  matchedBy: CompareGroup["matchedBy"]): CompareGroup {
  if (!bandit.length) {
    return { repo, file, line, kind: "semgrep_only", matchedBy: null, semgrep, bandit,
      differences: { severity: false, cwe: false, line: false } };
  }
  if (!semgrep.length) {
    return { repo, file, line, kind: "bandit_only", matchedBy: null, semgrep, bandit,
      differences: { severity: false, cwe: false, line: false } };
  }
  const sCwe = cweSet(semgrep);
  const bCwe = cweSet(bandit);
  const cweDiff = sCwe.size !== bCwe.size || [...sCwe].some((c) => !bCwe.has(c));
  const sevDiff = maxSeverity(semgrep) !== maxSeverity(bandit);
  const lineDiff = matchedBy === "nearby_cwe";
  return {
    repo, file, line, matchedBy, semgrep, bandit,
    kind: cweDiff || sevDiff ? "divergent" : "match",
    differences: { severity: sevDiff, cwe: cweDiff, line: lineDiff },
  };
}

/**
 * Regroupe les findings des deux outils par emplacement (fichier + ligne).
 * 1. Les findings sur la même ligne du même fichier sont rapprochés.
 * 2. Les groupes restés orphelins sont rapprochés si même fichier, même CWE,
 *    et lignes distantes d'au plus LINE_TOLERANCE.
 */
export function compareFindings(rows: FindingRow[], repo: string | null = null): CompareResult {
  type Bucket = { repo: string; file: string; line: number | null; semgrep: FindingRow[]; bandit: FindingRow[] };
  const buckets = new Map<string, Bucket>();
  for (const r of rows) {
    if (r.tool !== "semgrep" && r.tool !== "bandit") continue;
    const file = normalizePath(r.file);
    const key = `${r.repo}\u0000${file}\u0000${r.line ?? ""}`;
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { repo: r.repo, file, line: r.line, semgrep: [], bandit: [] }));
    b[r.tool].push(r);
  }

  const groups: CompareGroup[] = [];
  const orphanS: Bucket[] = [];
  const orphanB: Bucket[] = [];
  for (const b of buckets.values()) {
    if (b.semgrep.length && b.bandit.length) groups.push(classify(b.repo, b.file, b.line, b.semgrep, b.bandit, "same_line"));
    else if (b.semgrep.length) orphanS.push(b);
    else orphanB.push(b);
  }

  // Passe 2 : rapprochement par voisinage + CWE commun
  const usedS = new Set<Bucket>();
  for (const bb of orphanB) {
    const bCwe = cweSet(bb.bandit);
    let best: Bucket | undefined;
    let bestDist = Infinity;
    for (const sb of orphanS) {
      if (usedS.has(sb) || sb.repo !== bb.repo || sb.file !== bb.file || sb.line === null || bb.line === null) continue;
      const dist = Math.abs(sb.line - bb.line);
      if (dist > LINE_TOLERANCE || dist >= bestDist) continue;
      if (![...cweSet(sb.semgrep)].some((c) => bCwe.has(c))) continue;
      best = sb;
      bestDist = dist;
    }
    if (best) {
      usedS.add(best);
      groups.push(classify(bb.repo, bb.file, Math.min(best.line!, bb.line!), best.semgrep, bb.bandit, "nearby_cwe"));
    } else {
      groups.push(classify(bb.repo, bb.file, bb.line, [], bb.bandit, null));
    }
  }
  for (const sb of orphanS) if (!usedS.has(sb)) groups.push(classify(sb.repo, sb.file, sb.line, sb.semgrep, [], null));

  groups.sort((a, b) => a.repo.localeCompare(b.repo) || a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0));

  const summary = { match: 0, divergent: 0, semgrep_only: 0, bandit_only: 0, semgrepTotal: 0, banditTotal: 0 };
  for (const g of groups) {
    summary[g.kind]++;
    summary.semgrepTotal += g.semgrep.length;
    summary.banditTotal += g.bandit.length;
  }
  return { repo, lineTolerance: LINE_TOLERANCE, summary, groups };
}
