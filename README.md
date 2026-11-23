# Risk Register API
 
A REST API (Node.js, TypeScript, SQLite) that centralizes **assets, risks, controls and security findings** in one place, and ingests the results of CI security scans automatically.
 
> ⚠️ **Work in progress, local development only.**
> The API has **no authentication yet** (see [Roadmap](#roadmap)). Do not expose it on a network or the Internet in its current state.
 
## Why this project
 
My security work was spread across Markdown tables (STRIDE threat model, control mapping) and scanner reports. This API links them together:
 
- **What am I protecting?** → assets
- **What can go wrong?** → risks (likelihood × impact)
- **What protects it?** → controls
- **What did the tools find?** → findings, tracked from one scan to the next
## Status
 
| Component | Status |
|---|---|
| Assets (CRUD, filter by zone) | ✅ Done |
| Findings ingestion: **Bandit** (SAST) | ✅ Done |
| Scan history, deduplication, new / fixed / reopened tracking | ✅ Done |
| Risks and controls (data model) | 🟡 Schema defined, endpoints in progress |
| Findings ingestion: **Semgrep** (SAST) | 🔜 Coming soon |
| Findings ingestion: **OWASP Dependency-Check** (SCA) | 🔜 Coming soon |
| Web interface (dashboard, findings list) | 📋 Planned |
| Authentication (Microsoft Entra ID, roles) | 📋 Planned |
 
## How findings ingestion works
 
```
CI scan (JSON report)
      │  POST /ingest/:tool   (headers: X-Repo, X-Commit)
      ▼
 route ──► validates the request (Zod)
      ▼
 adapter ──► translates the tool's JSON into a common "NormalizedFinding"
      ▼
 ingest service ──► ONE database transaction:
      │               • records the scan
      │               • creates new findings / updates known ones
      │               • marks findings that disappeared as "fixed"
      ▼
 response: { scanId, total, new, reopened, fixed }
```
 
**Adapters.** Each scanner has its own JSON format. An adapter converts it into the same `NormalizedFinding` shape (rule, severity, file, line, CWE/CVE, fingerprint…), so the service, the database and the future UI never depend on a specific tool.
 
**Finding lifecycle.** A finding is identified by a **fingerprint** (a hash of tool, rule, file and code snippet), so the same issue is recognized across scans:
 
| Situation in the new scan | Result |
|---|---|
| Never seen before | created as `open` |
| Already known | `last_seen` updated |
| Was `open`, no longer reported | `fixed` |
| Was `fixed`, reported again | reopened (`open`) |
| Marked `accepted` / `false_positive` by hand | never overwritten automatically |
 
**Idempotence.** Sending the same `(tool, repo, commit)` twice does not create duplicates.
 
### Supported tools
 
| Tool | Type | Status |
|---|---|---|
| Bandit | SAST (Python) | ✅ Supported |
| Semgrep | SAST | 🔜 Coming soon, same logic as Bandit: one new adapter producing `NormalizedFinding` |
| OWASP Dependency-Check | SCA (dependencies) | 🔜 Coming soon, same logic as Bandit: one new adapter producing `NormalizedFinding` |
 
Adding a scanner means writing **one adapter** and registering it. The service, the database and the endpoint stay unchanged.
 
### Example
 
```bash
# Generate a JSON report (from the root of the analyzed repository)
bandit -r . -f json -o bandit.json
 
# Send it to the API
curl -X POST http://localhost:3000/ingest/bandit \
  -H "Content-Type: application/json" \
  -H "X-Repo: owner/repository" \
  -H "X-Commit: <40-character commit SHA>" \
  --data-binary @bandit.json
```
 
Response:
 
```json
{ "scanId": 1, "duplicate": false, "total": 8, "new": 8, "reopened": 0, "fixed": 0 }
```
 
## Data model
 
```
assets ──< risks >──< controls      (a control can protect several risks)
   │
   └──< findings >── scans          (findings are tracked across scans)
```
 
- **assets**: key, name, type, zone (WAN / DMZ / LAN), criticality
- **risks**: linked to an asset; likelihood × impact is **computed by the API**, never typed by hand
- **controls**: framework (ISO 27001, NIST CSF, NIST 800-53), reference, name
- **scans**: one row per CI submission (tool, repo, commit)
- **findings**: one row per issue, with status and first/last seen scan
## Security design
 
- **Strict input validation** with Zod: unknown fields are rejected, values are bounded (anti mass-assignment).
- **Parameterized SQL queries** only (`better-sqlite3`), no string concatenation.
- **Scanner reports are treated as untrusted input** (they contain code snippets and messages): validated and length-limited before storage, and never rendered as raw HTML.
- Request body size limits, rate limiting, hardened HTTP headers (`helmet`), structured logs (`pino`).
- Findings ingestion runs in a **single transaction**: a malformed report changes nothing.
### Known limitations
 
- **No authentication yet.** Local use only. Planned: Entra ID token validation with role checks, and a separate credential for the CI.
- **CI-to-API delivery.** A GitHub Actions runner cannot reach `localhost`. For now the CI uploads the JSON report as an artifact and I send it to the local API manually; automatic delivery requires hosting the API (with authentication).
## Getting started
 
```bash
git clone https://github.com/thedatbui/risk-register-api.git
cd risk-register-api
npm install
cp .env.example .env        # adjust values if needed
npm run seed                # optional: load assets from registry/*.yaml
npm run dev                 # http://localhost:3000
```
 
Reset the local database: `npm run db:reset`.
 
## Project structure
 
```
src/
├─ index.ts / app.ts      # server start, app and middleware setup
├─ config.ts              # validated environment variables
├─ db/                    # SQLite connection and schema.sql
├─ schemas/               # Zod schemas (what a request may contain)
├─ routes/                # HTTP layer only
├─ services/              # business rules and database access
├─ adapters/              # one parser per scanner (bandit.ts, ...)
└─ cli/seed.ts            # registry-as-code import (YAML → database)
```
 
## Roadmap
 
1. Risks and controls endpoints, with the gap-analysis report
2. Semgrep and OWASP Dependency-Check adapters
3. Automated tests (authorization, validation, ingestion lifecycle)
4. Authentication with Microsoft Entra ID and role-based access
5. Web dashboard (findings by severity, new vs fixed, risk matrix)
6. Dockerfile, CI pipeline, and hosted deployment so the CI can push reports directly
7. Link findings to risks and controls
## Related work
 
[Home-Lab](https://github.com/thedatbui/Home-Lab): the attack-and-defense lab whose threat model and control mapping this API is designed to manage.
 
