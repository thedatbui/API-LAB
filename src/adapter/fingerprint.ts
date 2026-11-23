import { createHash } from "node:crypto";

export const fp = (...parts: (string | number | undefined)[]) =>
  createHash("sha256").update(parts.map(String).join("|")).digest("hex");