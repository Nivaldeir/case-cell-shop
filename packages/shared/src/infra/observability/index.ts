import { context, SpanStatusCode, trace } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";

export class Observability {
	private static sdk = new NodeSDK({
		resource: new Resource({ "service.name": process.env.SERVICE_NAME }),
		traceExporter: new OTLPTraceExporter({
			url: "http://localhost:4318/v1/traces",
		}),
		instrumentations: [getNodeAutoInstrumentations()],
	});

	static start() {
		Observability.sdk.start();
	}

	static withSpan<T>(
		name: string,
		attributes: Record<string, string>,
		fn: () => Promise<T>,
	) {
		const span = trace
			.getTracer(process.env.SERVICE_NAME!)
			.startSpan(name, { attributes });
		return context.with(trace.setSpan(context.active(), span), async () => {
			try {
				const result = await fn();
				span.setStatus({ code: SpanStatusCode.OK });
				return result;
			} catch (err) {
				span.setStatus({ code: SpanStatusCode.ERROR });
				span.recordException(err as Error);
				throw err;
			} finally {
				span.end();
			}
		});
	}
}
