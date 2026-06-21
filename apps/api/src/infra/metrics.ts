import {
	Counter,
	collectDefaultMetrics,
	Histogram,
	Registry,
} from "prom-client";

export const register = new Registry();

collectDefaultMetrics({ register });

export const checkoutTotal = new Counter({
	name: "checkout_total",
	help: "Total de checkouts processados",
	labelNames: ["status"] as const,
	registers: [register],
});

export const checkoutDuration = new Histogram({
	name: "checkout_duration_ms",
	help: "Duração do checkout em milissegundos",
	buckets: [10, 50, 100, 250, 500, 1000, 2500],
	registers: [register],
});

export const cacheHits = new Counter({
	name: "cache_hits_total",
	help: "Total de cache hits",
	labelNames: ["entity"] as const,
	registers: [register],
});

export const cacheMisses = new Counter({
	name: "cache_misses_total",
	help: "Total de cache misses",
	labelNames: ["entity"] as const,
	registers: [register],
});

export const workerQueueGauge = new Counter({
	name: "worker_orders_processed_total",
	help: "Total de pedidos processados pelo worker de pagamento",
	labelNames: ["result"] as const,
	registers: [register],
});
