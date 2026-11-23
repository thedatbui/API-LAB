import { Router } from "express";
export const findingsRouter = Router();
findingsRouter.get("/", (_req, res) => {
    res.json({ message: "Findings route" });
});
//# sourceMappingURL=findings.js.map