import { Router } from "express";
import { ingestScan } from "../services/IngestService.js";
import { parseBandit } from "../adapter/bandit.js";
import { parseSemgrep } from "../adapter/semgrep.js";
import { z } from "zod";
export const ingestRouter = Router();
export const adapters = {
    bandit: parseBandit,
    semgrep: parseSemgrep,
};
ingestRouter.post("/:tool", (req, res) => {
    const tool = z.enum(["bandit", "semgrep", "dependency-check"]).safeParse(req.params.tool);
    const meta = z.object({
        repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
        commit: z.string().regex(/^[0-9a-f]{40}$/),
    }).safeParse({ repo: req.header("x-repo"), commit: req.header("x-commit") });
    if (!tool.success || !meta.success)
        return res.status(400).json({ error: "invalid request" });
    const adapter = adapters[tool.data];
    if (!adapter)
        return res.status(400).json({ error: "unsupported tool" });
    let findings;
    try {
        findings = adapter(req.body);
    }
    catch {
        return res.status(400).json({ error: "invalid report format" });
    }
    const result = ingestScan({ tool: tool.data, ...meta.data, raw: JSON.stringify(req.body) }, findings);
    res.status(result.duplicate ? 200 : 201).json(result);
});
//# sourceMappingURL=ingest.js.map