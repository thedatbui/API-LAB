import type { NormalizedFinding } from "../adapter/types.js";
export declare function ingestScan(meta: {
    tool: string;
    repo: string;
    commit: string;
    branch?: string;
    runId?: string;
    raw: string;
}, findings: NormalizedFinding[]): {
    scanId: number;
    duplicate: boolean;
    total: number;
    new: number;
    reopened: number;
    fixed: number;
};
//# sourceMappingURL=IngestService.d.ts.map