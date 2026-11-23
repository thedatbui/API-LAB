// src/db/connection.ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Chemin de la base : variable d'environnement, ou un fichier local par défaut.
// ":memory:" (utile pour les tests) crée une base temporaire en mémoire.
const dbPath = process.env.DATABASE_PATH ?? "data/registry.sqlite";
if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL"); // meilleures performances et robustesse
db.pragma("foreign_keys = ON"); // SQLite n'applique pas les clés étrangères sans ça
// Crée les tables si elles n'existent pas (grâce aux CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
db.exec(schema);
//# sourceMappingURL=connection.js.map