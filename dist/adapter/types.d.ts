export interface NormalizedFinding {
    fingerprint: string;
    ruleId: string;
    title: string;
    description?: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    file?: string;
    line?: number;
    cwe?: string;
    cve?: string;
    pkg?: string;
    pkgVersion?: string;
    fixedVersion?: string;
}
export type Adapter = (raw: unknown) => NormalizedFinding[];
//# sourceMappingURL=types.d.ts.map