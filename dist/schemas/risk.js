import { z } from "zod";
export const riskInput = z.object({
    key: z.string().regex(/^[a-z0-9-]+$/).max(50),
    name: z.string().min(2).max(100),
    description: z.string().min(10).max(500),
    stride: z.enum(["s", "t", "r", "i", "d", "e"]),
    likelihood: z.number().int().min(1).max(5),
    impact: z.number().int().min(1).max(5),
    status: z.enum(["open", "mitigated", "accepted"]).default("open"),
    assetId: z.number().int().positive(),
}).strict();
//# sourceMappingURL=risk.js.map