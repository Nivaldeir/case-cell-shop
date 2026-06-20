import { Observability } from "@mutual-processadora-de-pagamentos/lib-observability/dist/observability.js";
import { RedisAdapter } from "../infra/Redis.js";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitOpenError extends Error {
	constructor(public readonly circuitName: string) {
		super(`Circuit breaker is OPEN for: ${circuitName}`);
		this.name = "CircuitOpenError";
	}
}

export interface CircuitBreakerOptions {
	failureThreshold?: number;
	recoveryTimeout?: number;
	successThreshold?: number;
}

export class CircuitBreaker {
	private readonly keyState: string;
	private readonly keyOpenedAt: string;
	private readonly keyFailures: string;
	private readonly keySuccesses: string;
	private readonly keyProbeLock: string;

	private readonly failureThreshold: number;
	private readonly recoveryTimeout: number;
	private readonly successThreshold: number;

	constructor(name: string, options: CircuitBreakerOptions = {}) {
		this.keyState = `circuit:${name}:state`;
		this.keyOpenedAt = `circuit:${name}:opened_at`;
		this.keyFailures = `circuit:${name}:failures`;
		this.keySuccesses = `circuit:${name}:successes`;
		this.keyProbeLock = `circuit:${name}:probe`;

		this.failureThreshold = options.failureThreshold ?? 5;
		this.recoveryTimeout = options.recoveryTimeout ?? 60_000;
		this.successThreshold = options.successThreshold ?? 2;
	}

	async execute<T>(fn: () => Promise<T>): Promise<T> {
		const state = await this.getState();

		if (state === "OPEN") {
			throw new CircuitOpenError(this.keyState);
		}

		try {
			const result = await fn();
			await this.onSuccess(state);
			return result;
		} catch (err) {
			await this.onFailure(state);
			throw err;
		}
	}

	async isOpen(): Promise<boolean> {
		return (await this.getState()) === "OPEN";
	}

	private async getState(): Promise<CircuitState> {
		const redis = RedisAdapter.getClient();
		const raw = await redis.get(this.keyState);

		if (!raw || raw === "CLOSED") return "CLOSED";
		if (raw === "HALF_OPEN") return "HALF_OPEN";

		const openedAt = await redis.get(this.keyOpenedAt);
		if (openedAt && Date.now() - Number(openedAt) >= this.recoveryTimeout) {
			const acquired = await redis.set(
				this.keyProbeLock,
				"1",
				"EX",
				Math.ceil(this.recoveryTimeout / 1000),
				"NX",
			);
			if (acquired === "OK") {
				await redis.set(this.keyState, "HALF_OPEN");
				Observability.logger.info(`Circuit HALF_OPEN: ${this.keyState}`);
				return "HALF_OPEN";
			}
		}

		return "OPEN";
	}

	private async onSuccess(state: CircuitState): Promise<void> {
		const redis = RedisAdapter.getClient();

		if (state === "HALF_OPEN") {
			const successes = await redis.incr(this.keySuccesses);
			if (successes >= this.successThreshold) {
				await this.close();
			}
			return;
		}

		await redis.del(this.keyFailures);
	}

	private async onFailure(state: CircuitState): Promise<void> {
		const redis = RedisAdapter.getClient();

		if (state === "HALF_OPEN") {
			await this.open();
			return;
		}

		const failures = await redis.incr(this.keyFailures);
		if (failures === 1) {
			await redis.expire(
				this.keyFailures,
				Math.ceil(this.recoveryTimeout / 1000),
			);
		}

		Observability.logger.warn(
			`Circuit failure ${failures}/${this.failureThreshold}: ${this.keyState}`,
		);

		if (failures >= this.failureThreshold) {
			await this.open();
		}
	}

	private async open(): Promise<void> {
		const redis = RedisAdapter.getClient();
		const cleanupTtl = Math.ceil((this.recoveryTimeout / 1000) * 4);

		await Promise.all([
			redis.set(this.keyState, "OPEN", "EX", cleanupTtl),
			redis.set(this.keyOpenedAt, String(Date.now()), "EX", cleanupTtl),
			redis.del(this.keyFailures),
			redis.del(this.keySuccesses),
			redis.del(this.keyProbeLock),
		]);

		Observability.logger.error(`Circuit OPEN: ${this.keyState}`);
	}

	private async close(): Promise<void> {
		const redis = RedisAdapter.getClient();

		await Promise.all([
			redis.del(this.keyState),
			redis.del(this.keyOpenedAt),
			redis.del(this.keyFailures),
			redis.del(this.keySuccesses),
			redis.del(this.keyProbeLock),
		]);

		Observability.logger.info(`Circuit CLOSED: ${this.keyState}`);
	}
}
