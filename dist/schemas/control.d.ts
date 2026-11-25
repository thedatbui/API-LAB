import { z } from "zod";
export declare const controlInput: z.ZodObject<{
    key: z.ZodString;
    framework: z.ZodEnum<{
        CUSTOM: "CUSTOM";
        ISO27001: "ISO27001";
        "NIST-800-53": "NIST-800-53";
        "NIST-CSF": "NIST-CSF";
    }>;
    ref: z.ZodDefault<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    name: z.ZodString;
    description: z.ZodString;
}, z.core.$strict>;
export type ControlInput = z.infer<typeof controlInput>;
//# sourceMappingURL=control.d.ts.map