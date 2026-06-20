import { Redis, type RedisOptions } from "ioredis";

export type RedisConfig = RedisOptions;

export class RedisAdapter {
	private static client: Redis | null = null;

	private static create(): Redis {
		const url = process.env.REDIS_URL;

		const baseConfig: RedisOptions = {
			keyPrefix: process.env.REDIS_KEY_PREFIX,
			maxRetriesPerRequest: Number(process.env.REDIS_MAX_RETRIES ?? 3),
			enableReadyCheck: process.env.REDIS_ENABLE_READY_CHECK !== "false",
			lazyConnect: process.env.REDIS_LAZY_CONNECT === "true",
		};

		if (url) {
			return new Redis(url, baseConfig);
		}

		return new Redis({
			host: process.env.REDIS_HOST ?? "127.0.0.1",
			port: Number(process.env.REDIS_PORT ?? 6379),
			password: process.env.REDIS_PASSWORD,
			db: Number(process.env.REDIS_DB ?? 0),
			...baseConfig,
		});
	}

	static getClient(): Redis {
		if (!RedisAdapter.client) {
			RedisAdapter.client = RedisAdapter.create();
		}
		return RedisAdapter.client;
	}

	static async connect(): Promise<void> {
		const client = RedisAdapter.getClient();
		if (client.status !== "ready") {
			await client.connect();
		}
	}

	static async disconnect(): Promise<void> {
		if (RedisAdapter.client) {
			await RedisAdapter.client.quit();
			RedisAdapter.client = null;
		}
	}

	static async healthCheck(): Promise<boolean> {
		try {
			const client = RedisAdapter.getClient();
			const res = await client.ping();
			return res === "PONG";
		} catch {
			return false;
		}
	}
}
