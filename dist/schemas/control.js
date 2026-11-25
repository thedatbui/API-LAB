import { z } from "zod";
export const controlInput = z.object({
    key: z.string().regex(/^[a-z0-9-]+$/).max(50),
    framework: z.enum(["ISO27001", "NIST-CSF", "NIST-800-53", "CUSTOM"]),
    ref: z.string().max(100).nullable().optional().default(null),
    name: z.string().min(2).max(100),
    description: z.string().min(10).max(500),
}).strict();
//# sourceMappingURL=control.js.map