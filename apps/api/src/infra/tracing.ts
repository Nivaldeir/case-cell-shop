import {
	type Attributes,
	context,
	SpanStatusCode,
	trace,
} from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";

export function initTracing(options: {
	serviceName: string;
	environment: string;
	endpoint?: string;
}) {
	if (!options.endpoint) return;

	const sdk = new NodeSDK({
		resource: new Resource({
			"service.name": options.serviceName,
			"deployment.environment": options.environment,
		}),
		traceExporter: new OTLPTraceExporter({ url: options.endpoint }),
	});

	sdk.start();

	process.on("SIGTERM", () => sdk.shutdown());
}

export async function withSpan<T>(
	name: string,
	fn: () => Promise<T>,
	attributes?: Attributes,
): Promise<T> {
	const tracer = trace.getTracer("api-payment");
	const span = tracer.startSpan(name, { attributes });

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
