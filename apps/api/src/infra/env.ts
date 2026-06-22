import { config } from "dotenv";
import { z } from "zod";

config();

const serverEnvSchema = z.object({
	CORS_ORIGIN: z.string().default("*"),

	PORT: z.string().default("3000"),

	NODE_ENV: z
		.enum(["development", "staging", "production"])
		.default("development"),
	LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
	OTEL_ENDPOINT: z.string().url().optional(),
	SERVICE_NAME: z.string(),
	DATABASE_URL: z.string().default("file:local.db"),
	REDIS_URL: z.string().default("redis://127.0.0.1:6379"),
});

export const env = serverEnvSchema.parse(process.env);
