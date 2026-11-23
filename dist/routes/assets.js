import { Router } from "express";
import { assetInput } from "../schemas/asset.js";
import { listAssets, upsertAsset } from "../services/assetService.js";
export const assetsRouter = Router();
assetsRouter.get("/", (_req, res) => {
    const assets = listAssets();
    res.json({ assets });
});
assetsRouter.post("/", (req, res) => {
    const parsed = assetInput.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: "invalid input", details: parsed.error.issues });
    }
    upsertAsset(parsed.data);
    res.status(201).json({
        message: "Asset created",
        asset: parsed.data,
    });
});
//# sourceMappingURL=assets.js.map