CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  zone TEXT NOT NULL,
  repo TEXT,
  criticality INTEGER NOT NULL CHECK (criticality BETWEEN 1 AND 3)
);

CREATE TABLE IF NOT EXISTS risks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  stride TEXT CHECK (stride IN ('S','T','R','I','D','E')),
  likelihood INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
  impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','mitigated','accepted')),
  asset_id INTEGER NOT NULL,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_risks_asset ON risks(asset_id);

CREATE TABLE IF NOT EXISTS controls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  framework TEXT NOT NULL
    CHECK (framework IN ('ISO27001','NIST-CSF','NIST-800-53','CUSTOM')),
  ref TEXT,                       
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS risk_controls (
  risk_id INTEGER NOT NULL,
  control_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'gap'
    CHECK (status IN ('implemented','partial','gap')),
  evidence TEXT,                  
  PRIMARY KEY (risk_id, control_id),
  FOREIGN KEY (risk_id) REFERENCES risks(id) ON DELETE CASCADE,
  FOREIGN KEY (control_id) REFERENCES controls(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool TEXT NOT NULL CHECK (tool IN ('bandit','semgrep','dependency-check')),
  repo TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  branch TEXT,
  ci_run_id TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  findings_count INTEGER NOT NULL DEFAULT 0,
  raw_report TEXT,                      -- le JSON brut (optionnel, voir plus bas)
  UNIQUE (tool, repo, commit_sha)       -- empêche d'importer deux fois le même scan
);

CREATE TABLE IF NOT EXISTS findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fingerprint TEXT NOT NULL,
  tool TEXT NOT NULL,
  repo TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  file TEXT,
  line INTEGER,
  cwe TEXT,
  cve TEXT,
  package TEXT,
  package_version TEXT,
  fixed_version TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','fixed','accepted','false_positive')),
  first_seen_scan_id INTEGER NOT NULL REFERENCES scans(id),
  last_seen_scan_id  INTEGER NOT NULL REFERENCES scans(id),
  fixed_at TEXT,
  asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
  UNIQUE (tool, repo, fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status, severity);