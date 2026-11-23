import express, {} from "express";
import helmet from "helmet";
import { assetsRouter } from "./routes/assets.js";
import { controlsRouter } from "./routes/controls.js";
import { findingsRouter } from "./routes/findings.js";
import { ingestRouter } from "./routes/ingest.js";
import { reportsRouter } from "./routes/reports.js";
import { risksRouter } from "./routes/risks.js";
import { errorHandler } from "./middleware/errors.js";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
export function createApp() {
    const app = express();
    app.use(helmet());
    app.use(pinoHttp());
    app.use("/ingest", express.json({ limit: "5mb" }), ingestRouter);
    app.use(express.json({ limit: "10kb" }));
    app.use(rateLimit({ windowMs: 60_000, limit: 60 }));
    app.use("/assets", assetsRouter);
    app.use("/risks", risksRouter);
    app.use("/controls", controlsRouter);
    app.use("/findings", findingsRouter);
    app.use("/reports", reportsRouter);
    app.use(errorHandler);
    return app;
}
//# sourceMappingURL=app.js.map