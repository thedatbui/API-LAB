import { db } from "../db/connection.js";
import type { ControlInput } from "../schemas/control.js";

export function listControls() {
    return db.prepare("SELECT * FROM controls").all();
}

export function upsertControl(control: ControlInput) {
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
