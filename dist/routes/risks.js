import { Router } from "express";
import { riskInput } from "../schemas/risk.js";
import { listRisksFromAsset, upsertRisk } from "../services/riskService.js";
export const risksRouter = Router();
risksRouter.get("/assets/:assetId", (_req, res) => {
    const assetId = parseInt(_req.params.assetId, 10);
    if (isNaN(assetId)) {
        return res.status(400).json({ error: "Invalid assetId" });
    }
    const risks = listRisksFromAsset(assetId);
    res.json({ risks });
});
risksRouter.post("/", (req, res) => {
    const parsed = riskInput.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "invalid input", details: parsed.error.issues });
    }
    upsertRisk(parsed.data);
    res.status(201).json({
        message: "Risk created",
        risk: parsed.data,
    });
});
//# sourceMappingURL=risks.js.map