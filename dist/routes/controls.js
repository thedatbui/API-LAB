import { Router } from "express";
import { controlInput } from "../schemas/control.js";
import { listControls, upsertControl } from "../services/controlService.js";
export const controlsRouter = Router();
controlsRouter.get("/", (_req, res) => {
    const controls = listControls();
    res.json({ controls });
});
controlsRouter.post("/", (req, res) => {
    const parsed = controlInput.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "invalid input", details: parsed.error.issues });
    }
    upsertControl(parsed.data);
    res.status(201).json({
        message: "Control created",
        control: parsed.data,
    });
});
//# sourceMappingURL=controls.js.map