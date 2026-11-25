import { createHash } from "node:crypto";
export const fp = (...parts) => createHash("sha256").update(parts.map(String).join("|")).digest("hex");
//# sourceMappingURL=fingerprint.js.map