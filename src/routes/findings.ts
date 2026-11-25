import { Router } from "express";
import { z } from "zod";
import { compareFindings, listFindings, listRepos } from "../services/findingService.js";

export const findingsRouter = Router();

const filtersSchema = z.object({
  tool: z.enum(["bandit", "semgrep", "dependency-check"]).optional(),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).optional(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  status: z.enum(["open", "fixed", "accepted", "false_positive"]).optional(),
});

// GET /findings?tool=&repo=&severity=&status=
findingsRouter.get("/", (req, res) => {
  const parsed = filtersSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid filters", details: parsed.error.issues });
  const findings = listFindings(parsed.data);
  res.json({ count: findings.length, findings });
});

// GET /findings/repos
findingsRouter.get("/repos", (_req, res) => {
  res.json({ repos: listRepos() });
});

// GET /findings/compare?repo=&status=
findingsRouter.get("/compare", (req, res) => {
  const parsed = filtersSchema.pick({ repo: true, status: true }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "invalid filters", details: parsed.error.issues });
  const rows = listFindings(parsed.data).filter((f) => f.tool === "semgrep" || f.tool === "bandit");
  res.json(compareFindings(rows, parsed.data.repo ?? null));
});
