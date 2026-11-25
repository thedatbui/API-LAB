import { z } from "zod";
import { fp } from "./fingerprint.js";
const semgrepSeverity = z.enum(["ERROR", "WARNING", "INFO", "INVENTORY", "EXPERIMENT"]);
const semgrepReport = z.object({
    results: z.array(z.object({
        check_id: z.string(),
        path: z.string(),
        start: z.object({ line: z.number().int().positive() }),
        extra: z.object({
            message: z.string(),
            severity: semgrepSeverity,
            metadata: z.object({
                name: z.string().optional(),
                cwe: z.union([z.string(), z.array(z.string())]).optional(),
            }).optional(),
        }),
    })),
});
const severityMap = {
    ERROR: "high",
    WARNING: "medium",
    INFO: "low",
    INVENTORY: "info",
    EXPERIMENT: "info",
};
function extractCwe(cwe) {
    const entries = typeof cwe === "string" ? [cwe] : cwe ?? [];
    for (const entry of entries) {
        const match = /\bCWE-\d+\b/i.exec(entry);
        if (match)
            return match[0].toUpperCase();
    }
    return undefined;
}
export const parseSemgrep = (raw) => {
    const report = semgrepReport.parse(raw);
    return report.results.map((result) => {
        const cwe = extractCwe(result.extra.metadata?.cwe);
        return {
            fingerprint: fp("semgrep", result.check_id, result.path, result.start.line),
            ruleId: result.check_id,
            title: result.extra.metadata?.name ?? result.check_id,
            description: result.extra.message.slice(0, 2000),
            severity: severityMap[result.extra.severity],
            file: result.path,
            line: result.start.line,
            ...(cwe ? { cwe } : {}),
        };
    });
};
//# sourceMappingURL=semgrep.js.map