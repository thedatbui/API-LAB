import { db } from "../db/connection.js";
export function ingestScan(meta, findings) {
    const run = db.transaction(() => {
        const dup = db.prepare("SELECT id FROM scans WHERE tool = ? AND repo = ? AND commit_sha = ?").get(meta.tool, meta.repo, meta.commit);
        if (dup)
            return { scanId: dup.id, duplicate: true, total: findings.length, new: 0, reopened: 0, fixed: 0 };
        const scanId = Number(db.prepare(`
      INSERT INTO scans (tool, repo, commit_sha, branch, ci_run_id, findings_count, raw_report)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(meta.tool, meta.repo, meta.commit, meta.branch ?? null, meta.runId ?? null, findings.length, meta.raw).lastInsertRowid);
        const asset = db.prepare("SELECT id FROM assets WHERE repo = ?").get(meta.repo);
        const find = db.prepare("SELECT status FROM findings WHERE tool = ? AND repo = ? AND fingerprint = ?");
        const insert = db.prepare(`
      INSERT INTO findings (fingerprint, tool, repo, rule_id, title, description, severity, file, line,
        cwe, cve, package, package_version, fixed_version, first_seen_scan_id, last_seen_scan_id, asset_id)
      VALUES (@fingerprint, @tool, @repo, @ruleId, @title, @description, @severity, @file, @line,
        @cwe, @cve, @pkg, @pkgVersion, @fixedVersion, @scanId, @scanId, @assetId)`);
        const touch = db.prepare(`
      UPDATE findings SET last_seen_scan_id = ?, severity = ?, line = ?,
        status = CASE WHEN status = 'fixed' THEN 'open' ELSE status END,
        fixed_at = CASE WHEN status = 'fixed' THEN NULL ELSE fixed_at END
      WHERE tool = ? AND repo = ? AND fingerprint = ?`);
        let created = 0, reopened = 0;
        for (const f of findings) {
            const existing = find.get(meta.tool, meta.repo, f.fingerprint);
            if (!existing) {
                insert.run({ description: null, file: null, line: null, cwe: null, cve: null,
                    pkg: null, pkgVersion: null, fixedVersion: null, ...f,
                    tool: meta.tool, repo: meta.repo, scanId, assetId: asset?.id ?? null });
                created++;
            }
            else {
                if (existing.status === "fixed")
                    reopened++;
                touch.run(scanId, f.severity, f.line ?? null, meta.tool, meta.repo, f.fingerprint);
            }
        }
        const fixed = db.prepare(`
      UPDATE findings SET status = 'fixed', fixed_at = datetime('now')
      WHERE tool = ? AND repo = ? AND status = 'open' AND last_seen_scan_id != ?`)
            .run(meta.tool, meta.repo, scanId).changes;
        return { scanId, duplicate: false, total: findings.length, new: created, reopened, fixed };
    });
    return run();
}
//# sourceMappingURL=IngestService.js.map