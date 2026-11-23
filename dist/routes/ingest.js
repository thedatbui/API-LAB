import { Router } from "express";
export const ingestRouter = Router();
ingestRouter.post("/", (req, res) => {
    res.json({ received: req.body });
});
//# sourceMappingURL=ingest.js.map