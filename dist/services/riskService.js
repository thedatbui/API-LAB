import { db } from "../db/connection.js";
export function listRisksFromAsset(assetId) {
    return db.prepare("SELECT * FROM risks WHERE assetId = ?").all(assetId);
}
export function upsertRisk(risk) {
    db.prepare(`
        INSERT INTO risks (key, name, description, stride, likelihood, impact, status, assetId)
        VALUES (@key, @name, @description, @stride, @likelihood, @impact, @status, @assetId)
        ON CONFLICT(key) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        stride = excluded.stride,
        likelihood = excluded.likelihood,
        impact = excluded.impact,
        status = excluded.status,
        assetId = excluded.assetId
    `).run(risk);
}
//# sourceMappingURL=riskService.js.map