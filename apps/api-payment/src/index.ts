import "dotenv/config";
import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { AppError } from "./application/AppError";
import { initTracing } from "./infra/tracing";
import { logger } from "./infra/logger";
import { requestContextMiddleware } from "./infra/middleware/requestContext";
import { router } from "./presentation/api/controllers/routes";
import { env } from "./infra/env";

initTracing({
	serviceName: "api-payment",
	environment: env.NODE_ENV,
	endpoint: env.OTEL_ENDPOINT,
});

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(requestContextMiddleware);

app.use(router);

app.use(
	(
		err: unknown,
		_req: express.Request,
		res: express.Response,
		_next: express.NextFunction,
	) => {
		if (err instanceof ZodError) {
			logger.warn("request.validation_error", { issues: err.issues });
			res.status(400).json({ error: "Validation error", issues: err.issues });
			return;
		}
		if (err instanceof AppError) {
			logger.warn("request.business_error", { message: err.message, statusCode: err.statusCode });
			res.status(err.statusCode).json({ error: err.message });
			return;
		}
		logger.error("request.unhandled_error", {
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		res.status(500).json({ error: "Internal server error" });
	},
);

app.listen(Number(env.PORT), () => {
	logger.info("server.started", { port: env.PORT, env: env.NODE_ENV });
});
