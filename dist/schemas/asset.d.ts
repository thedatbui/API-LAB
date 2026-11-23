import { z } from "zod";
export declare const assetInput: z.ZodObject<{
    key: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<{
        database: "database";
        firewall: "firewall";
        other: "other";
        reverse_proxy: "reverse_proxy";
        siem: "siem";
        web_app: "web_app";
    }>;
    zone: z.ZodEnum<{
        DMZ: "DMZ";
        LAN: "LAN";
        WAN: "WAN";
    }>;
    criticality: z.ZodNumber;
}, z.core.$strict>;
export type AssetInput = z.infer<typeof assetInput>;
//# sourceMappingURL=asset.d.ts.map