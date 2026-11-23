import { z } from "zod";
export declare const riskInput: z.ZodObject<{
    key: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    stride: z.ZodEnum<{
        d: "d";
        e: "e";
        i: "i";
        r: "r";
        s: "s";
        t: "t";
    }>;
    likelihood: z.ZodNumber;
    impact: z.ZodNumber;
    status: z.ZodDefault<z.ZodEnum<{
        accepted: "accepted";
        mitigated: "mitigated";
        open: "open";
    }>>;
    assetId: z.ZodNumber;
}, z.core.$strict>;
export type RiskInput = z.infer<typeof riskInput>;
//# sourceMappingURL=risk.d.ts.map