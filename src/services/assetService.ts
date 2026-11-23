import { db } from "../db/connection.js";
import type { AssetInput } from "../schemas/asset.js";

export function listAssets(zone?: string) {
    // Placeholder implementation for listing assets
    return zone ? db.prepare("SELECT * FROM assets WHERE zone = ?").all(zone) 
    : db.prepare("SELECT * FROM assets").all();
}

export function upsertAsset(a: AssetInput) {
    console.log("Upserting asset:", a);
    db.prepare(`
        INSERT INTO assets (key, name, type, zone, criticality)
        VALUES (@key, @name, @type, @zone, @criticality)
        ON CONFLICT(key) DO UPDATE SET
        name = excluded.name, type = excluded.type,
        zone = excluded.zone, criticality = excluded.criticality
    `).run(a);
}