// Dashboard des findings SAST — vanilla JS, aucune dépendance.
// Toutes les données venant des rapports sont injectées via textContent (jamais innerHTML) :
// un message de règle malveillant ne peut donc pas injecter de HTML.

const SEVERITIES = ["critical", "high", "medium", "low", "info"];
const SEV_RANK = Object.fromEntries(SEVERITIES.map((s, i) => [s, SEVERITIES.length - i]));
const TOOLS = ["semgrep", "bandit"];
const STATUS_LABEL = { open: "Ouvert", fixed: "Corrigé", accepted: "Accepté", false_positive: "Faux positif" };
const KIND_LABEL = {
  match: "Concordant",
  divergent: "Divergent",
  semgrep_only: "Semgrep seul",
  bandit_only: "Bandit seul",
};
const KIND_HELP = {
  match: "Les deux outils signalent le même endroit, même CWE, même sévérité",
  divergent: "Même endroit, mais CWE ou sévérité différents",
  semgrep_only: "Trouvé uniquement par Semgrep",
  bandit_only: "Trouvé uniquement par Bandit",
};

const state = {
  view: "findings",
  repo: "",
  tool: "",
  status: "open",
  search: "",
  cell: null, // { tool, severity } sélectionnée dans la matrice
  sort: { key: "severity", dir: "desc" },
  expanded: new Set(),
  findings: [],
  compare: null,
  compareKind: "",
};

// ---------------------------------------------------------------- helpers
const $ = (sel) => document.querySelector(sel);

/** Crée un élément DOM. Les enfants string deviennent des noeuds texte. */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

/** "python.flask.security.open-redirect.open-redirect" -> "open-redirect" */
const shortRule = (id) => id.split(".").pop();
const normPath = (p) => (p ?? "").replace(/\\/g, "/").replace(/^(\.\/)+/, "");
const loc = (f) => (f.file ? `${normPath(f.file)}${f.line ? ":" + f.line : ""}` : "—");

const sevBadge = (s) => h("span", { class: `sev sev-${s}` }, s);
const toolBadge = (t) => h("span", { class: `tool ${t}` }, h("span", { class: `tool-dot ${t}` }), t);

async function api(path) {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

function showError(err) {
  const box = $("#error");
  box.hidden = !err;
  box.textContent = err ? `Erreur : ${err.message ?? err}` : "";
}

const qs = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `?${s}` : "";
};

// ---------------------------------------------------------------- data
async function loadRepos() {
  const { repos } = await api("/findings/repos");
  const select = $("#repo");
  select.replaceChildren(
    h("option", { value: "" }, "Tous les dépôts"),
    ...repos.map((r) => h("option", { value: r.repo }, `${r.repo}  (${r.tools.join(", ")})`)),
  );
  if (repos.length === 1) state.repo = repos[0].repo;
  select.value = state.repo;
}

async function loadFindings() {
  const data = await api(`/findings${qs({ repo: state.repo, status: state.status })}`);
  state.findings = data.findings.filter((f) => TOOLS.includes(f.tool));
}

async function loadCompare() {
  state.compare = await api(`/findings/compare${qs({ repo: state.repo, status: state.status })}`);
}

async function refresh() {
  showError(null);
  try {
    if (state.view === "findings") await loadFindings();
    else await loadCompare();
    render();
  } catch (e) {
    showError(e);
  }
}

// ---------------------------------------------------------------- findings view
function matchesSearch(f) {
  if (!state.search) return true;
  const q = state.search.toLowerCase();
  return [f.rule_id, f.title, f.file, f.cwe, f.description].some((v) => v && v.toLowerCase().includes(q));
}

/** Findings après filtres outil + recherche (mais avant le filtre de cellule -> sert à la matrice). */
function baseFiltered() {
  return state.findings.filter((f) => (!state.tool || f.tool === state.tool) && matchesSearch(f));
}

function renderMatrix(rows) {
  const tools = state.tool ? [state.tool] : TOOLS;
  const count = (tool, sev) => rows.filter((f) => (!tool || f.tool === tool) && (!sev || f.severity === sev)).length;

  const cell = (tool, sev) => {
    const n = count(tool, sev);
    const selected = state.cell && state.cell.tool === tool && state.cell.severity === sev;
    const isTotal = !tool || !sev;
    return h("td", {
      class: [n === 0 && "zero", isTotal && "total", selected && "selected"].filter(Boolean).join(" "),
      title: n ? "Filtrer sur cette cellule" : null,
      onclick: n ? () => {
        state.cell = selected ? null : { tool, severity: sev };
        render();
      } : null,
    }, n === 0 ? "·" : n);
  };

  $("#matrix").replaceChildren(
    h("thead", {}, h("tr", {}, h("th"), ...SEVERITIES.map((s) => h("th", {}, sevBadge(s))), h("th", {}, "Total"))),
    h("tbody", {},
      ...tools.map((t) => h("tr", {}, h("th", { class: "row-head" }, toolBadge(t)), ...SEVERITIES.map((s) => cell(t, s)), cell(t, null))),
      tools.length > 1
        ? h("tr", {}, h("th", { class: "row-head" }, "Total"), ...SEVERITIES.map((s) => cell(null, s)), cell(null, null))
        : null,
    ),
  );
}

const SORTERS = {
  severity: (a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity],
  tool: (a, b) => a.tool.localeCompare(b.tool),
  rule: (a, b) => shortRule(a.rule_id).localeCompare(shortRule(b.rule_id)),
  cwe: (a, b) => (parseInt((a.cwe ?? "").slice(4)) || 0) - (parseInt((b.cwe ?? "").slice(4)) || 0),
  location: (a, b) => normPath(a.file).localeCompare(normPath(b.file)) || (a.line ?? 0) - (b.line ?? 0),
  status: (a, b) => a.status.localeCompare(b.status),
};

function renderFindingsTable(rows) {
  const { key, dir } = state.sort;
  const sorted = [...rows].sort((a, b) => {
    const primary = SORTERS[key](a, b) * (dir === "asc" ? 1 : -1);
    return primary || SORTERS.location(a, b);
  });

  document.querySelectorAll("#findings-table th[data-sort]").forEach((th) => {
    th.classList.toggle("sorted-asc", th.dataset.sort === key && dir === "asc");
    th.classList.toggle("sorted-desc", th.dataset.sort === key && dir === "desc");
  });

  const tbody = $("#findings-table tbody");
  if (!sorted.length) {
    tbody.replaceChildren(h("tr", {}, h("td", { colspan: 6, class: "empty" }, "Aucun finding ne correspond aux filtres.")));
    return;
  }
  tbody.replaceChildren(...sorted.flatMap((f) => {
    const open = state.expanded.has(f.id);
    const row = h("tr", {
      class: "row",
      "aria-expanded": String(open),
      onclick: () => { open ? state.expanded.delete(f.id) : state.expanded.add(f.id); render(); },
    },
      h("td", {}, sevBadge(f.severity)),
      h("td", {}, toolBadge(f.tool)),
      h("td", { class: "rule", title: f.rule_id }, shortRule(f.rule_id),
        f.title !== f.rule_id ? h("small", {}, f.title) : null),
      h("td", { class: "mono" }, f.cwe ?? "—"),
      h("td", { class: "mono" }, loc(f)),
      h("td", {}, h("span", { class: `pill status-${f.status}` }, STATUS_LABEL[f.status] ?? f.status)),
    );
    const detail = open
      ? h("tr", { class: "detail" }, h("td", { colspan: 6 },
          h("div", { class: "mono muted" }, f.rule_id),
          f.description ?? "(pas de description)"))
      : null;
    return [row, detail].filter(Boolean);
  }));
}

function renderFindings() {
  const base = baseFiltered();
  renderMatrix(base);
  const rows = state.cell
    ? base.filter((f) => (!state.cell.tool || f.tool === state.cell.tool) && (!state.cell.severity || f.severity === state.cell.severity))
    : base;
  $("#findings-count").textContent = `${rows.length} finding${rows.length > 1 ? "s" : ""}`
    + (rows.length !== state.findings.length ? ` sur ${state.findings.length}` : "");
  $("#clear-filters").hidden = !(state.cell || state.search || state.tool);
  renderFindingsTable(rows);
}

// ---------------------------------------------------------------- compare view
function renderCompare() {
  const data = state.compare;
  if (!data) return;

  $("#compare-summary").replaceChildren(...Object.keys(KIND_LABEL).map((k) =>
    h("button", {
      class: `k-${k}${state.compareKind === k ? " active" : ""}`,
      title: KIND_HELP[k],
      onclick: () => { state.compareKind = state.compareKind === k ? "" : k; render(); },
    }, h("strong", {}, data.summary[k]), h("span", {}, KIND_LABEL[k]), h("span", {}, KIND_HELP[k])),
  ));

  $("#compare-hint").textContent =
    `${data.summary.semgrepTotal} findings Semgrep et ${data.summary.banditTotal} findings Bandit regroupés en `
    + `${data.groups.length} emplacements. Deux findings sont rapprochés s'ils sont sur la même ligne, `
    + `ou à ±${data.lineTolerance} lignes avec un CWE commun. Cliquez une carte pour filtrer.`;

  const groups = state.compareKind ? data.groups.filter((g) => g.kind === state.compareKind) : data.groups;
  const tbody = $("#compare-table tbody");
  if (!groups.length) {
    tbody.replaceChildren(h("tr", {}, h("td", { colspan: 4, class: "empty" }, "Rien à afficher.")));
    return;
  }
  const multiRepo = new Set(data.groups.map((g) => g.repo)).size > 1;

  tbody.replaceChildren(...groups.map((g) => {
    const otherCwes = (side) => new Set((side === "semgrep" ? g.bandit : g.semgrep).map((f) => f.cwe));
    const sevOf = (list) => list.reduce((m, f) => (SEV_RANK[f.severity] > SEV_RANK[m] ? f.severity : m), "info");

    const cellFor = (side) => {
      const list = g[side];
      if (!list.length) return h("td", {}, h("span", { class: "absent" }, "non détecté"));
      const other = otherCwes(side);
      const both = g.semgrep.length && g.bandit.length;
      return h("td", {}, ...list.map((f) => h("div", { class: "finding", title: f.description ?? "" },
        h("div", { class: "rule", title: f.rule_id }, shortRule(f.rule_id)),
        h("div", { class: "meta" },
          h("span", { class: both && g.differences.severity ? "diff" : "" }, sevBadge(f.severity)),
          h("span", { class: `cwe mono${both && f.cwe && !other.has(f.cwe) ? " diff" : ""}` }, f.cwe ?? "sans CWE"),
          g.matchedBy === "nearby_cwe" ? h("span", { class: "mono diff" }, `L${f.line}`) : null,
        ),
      )));
    };

    const reasons = [];
    if (g.kind === "divergent" || g.kind === "match") {
      if (g.differences.severity) reasons.push(`Sévérité : Semgrep ${sevOf(g.semgrep)} / Bandit ${sevOf(g.bandit)}`);
      if (g.differences.cwe) reasons.push("CWE différents");
      if (g.differences.line) reasons.push("Lignes voisines (même CWE)");
    }

    return h("tr", { class: `k-${g.kind}` },
      h("td", { class: "mono" }, multiRepo ? h("div", { class: "muted" }, g.repo) : null, `${g.file}${g.line ? ":" + g.line : ""}`),
      cellFor("semgrep"),
      cellFor("bandit"),
      h("td", {}, h("div", { class: `verdict k-${g.kind}` }, KIND_LABEL[g.kind],
        reasons.length ? h("ul", {}, ...reasons.map((r) => h("li", {}, r))) : null)),
    );
  }));
}

// ---------------------------------------------------------------- shell
function render() {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === state.view));
  $("#view-findings").hidden = state.view !== "findings";
  $("#view-compare").hidden = state.view !== "compare";
  document.querySelectorAll("#tool-filter button").forEach((b) => b.classList.toggle("active", b.dataset.tool === state.tool));
  if (state.view === "findings") renderFindings();
  else renderCompare();
}

function setViewFromHash() {
  state.view = location.hash === "#compare" ? "compare" : "findings";
}

function bind() {
  window.addEventListener("hashchange", () => { setViewFromHash(); refresh(); });

  $("#repo").addEventListener("change", (e) => { state.repo = e.target.value; state.cell = null; refresh(); });
  $("#status-filter").addEventListener("change", (e) => { state.status = e.target.value; refresh(); });

  $("#tool-filter").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.tool = btn.dataset.tool;
    state.cell = null;
    render();
  });

  let t;
  $("#search").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.search = e.target.value.trim(); render(); }, 120);
  });

  $("#clear-filters").addEventListener("click", () => {
    state.tool = ""; state.cell = null; state.search = "";
    $("#search").value = "";
    render();
  });

  document.querySelectorAll("#findings-table th[data-sort]").forEach((th) => th.addEventListener("click", () => {
    const key = th.dataset.sort;
    state.sort = { key, dir: state.sort.key === key && state.sort.dir === "desc" ? "asc" : "desc" };
    render();
  }));
}

(async function init() {
  setViewFromHash();
  bind();
  try {
    await loadRepos();
  } catch (e) {
    showError(e);
  }
  refresh();
})();
