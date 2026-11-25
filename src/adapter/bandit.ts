import { z } from "zod";
import type { Adapter } from "./types.js";
import { fp } from "./fingerprint.js";

const banditReport = z.object({
  results: z.array(z.object({
    test_id: z.string(),
    test_name: z.string(),
    issue_severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
    issue_text: z.string(),
    filename: z.string(),
    line_number: z.number().int(),
    code: z.string().optional(),
    issue_cwe: z.object({ id: z.number() }).optional(),
  })),
});

export const parseBandit: Adapter = (raw) => {
  const report = banditReport.parse(raw);   
  return report.results.map((r) => ({
    fingerprint: fp("bandit", r.test_id, r.filename, (r.code ?? "").trim() || r.line_number),
    ruleId: r.test_id,
    title: r.test_name,
    description: r.issue_text.slice(0, 2000),
    severity: r.issue_severity.toLowerCase() as "low" | "medium" | "high",
    file: r.filename,
    line: r.line_number,
    ...(r.issue_cwe ? { cwe: `CWE-${r.issue_cwe.id}` } : {}),
  }));
};