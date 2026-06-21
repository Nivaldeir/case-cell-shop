import {
	Observability,
	OrderRepository,
	PaymentRepository,
	SagaRepository,
	SagaStepName,
	SQSAdapter,
} from "@casecellshop/shared";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { ProcessPaymentUsecase } from "./application/usecase/ProcessPaymentUsecase";

async function main() {
	Observability.start();
	const sqs = new SQSAdapter();
	await sqs.connect();

	const processPaymentUsecase = new ProcessPaymentUsecase(
		new OrderRepository(),
		new PaymentRepository(),
		new SagaRepository(),
		sqs,
	);

	void sqs.consume(SagaStepName.PROCESS_PAYMENT, async (message: any) => {
		const { sagaId, orderId, items } = message.body;

		await Observability.withSpan(
			"process-payment",
			{ "saga.id": sagaId, "order.id": orderId },
			async () => {
				const result = await processPaymentUsecase.execute({
					sagaId,
					orderId,
					items,
				});

				if (result.approved) {
					trace.getActiveSpan()?.setAttribute("payment.status", "paid");
				} else {
					trace.getActiveSpan()?.setAttribute("payment.status", "failed");
					if (result.error) {
						trace.getActiveSpan()?.setAttribute("payment.error", result.error);
					}
					trace.getActiveSpan()?.setStatus({
						code: SpanStatusCode.ERROR,
						message: result.error ?? "Pagamento falhou",
					});
				}
			},
		);

		await sqs.ack(message);
	});
}

main();
