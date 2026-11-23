import { z } from "zod";

export const assetInput = z.object({
  key: z.string().regex(/^[a-z0-9-]+$/).max(50),
  name: z.string().min(2).max(100),
  type: z.enum(["web_app", "reverse_proxy", "database", "siem", "firewall", "other"]),
  zone: z.enum(["WAN", "DMZ", "LAN"]),
  criticality: z.number().int().min(1).max(3),
}).strict();

export type AssetInput = z.infer<typeof assetInput>;