import { db } from "../db/connection.js";
export function listControls() {
    return db.prepare("SELECT * FROM controls").all();
}
export function upsertControl(control) {
    const controlWithDefaults = { ...control, ref: control.ref ?? null };
    console.log("Upserting control:", controlWithDefaults);
    db.prepare(`
        INSERT INTO controls (key, framework, ref, name, description)
        VALUES (@key, @framework, @ref, @name, @description)
        ON CONFLICT(key) DO UPDATE SET
        framework = excluded.framework,
        ref = excluded.ref,
        name = excluded.name,
        description = excluded.description
    `).run(controlWithDefaults);
}
//# sourceMappingURL=controlService.js.map