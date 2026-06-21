import {
	AppError,
	Observability,
	OrderRepository,
	Payment,
	PaymentRepository,
	SagaRepository,
	SagaStatus,
	SagaStepName,
	SQSAdapter,
} from "@casecellshop/shared";
import { SpanStatusCode, trace } from "@opentelemetry/api";

async function main() {
	Observability.start();
	const sqs = new SQSAdapter();
	await sqs.connect();

	const paymentRepository = new PaymentRepository();
	const orderRepository = new OrderRepository();
	const sagaRepository = new SagaRepository();

	void sqs.consume(SagaStepName.PROCESS_PAYMENT, async (message: any) => {
		const { sagaId, orderId } = message.body;

		await Observability.withSpan(
			"process-payment",
			{
				"saga.id": sagaId,
				"order.id": orderId,
			},
			async () => {
				try {
					await sagaRepository.update(sagaId, { status: SagaStatus.RUNNING });

					const order = await orderRepository.findById(orderId);

					if (!order) throw new AppError(`Pedido ${orderId} não encontrado`);

					const payment = Payment.create({
						orderId,
						type: "pix",
						amount: order.get("amount"),
					});

					await paymentRepository.create(payment);

					const isNotPaid = Math.random() < 0.5 && true;

					if (isNotPaid) {
						payment.markAsFailed();
						await paymentRepository.updateStatus(payment);
						throw new AppError("Pagamento recusado");
					}

					payment.markAsPaid();
					await paymentRepository.updateStatus(payment);

					order.markAsPaid();
					await orderRepository.updateStatus(order);

					await sagaRepository.update(sagaId, { status: SagaStatus.COMPLETED });

					trace.getActiveSpan()?.setAttribute("payment.status", "paid");

					console.log(
						`[worker-payment] Pagamento processado — sagaId=${sagaId} orderId=${orderId}`,
					);
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);

					console.error(
						`[worker-payment] Falha no pagamento — sagaId=${sagaId}:`,
						errorMessage,
					);

					trace.getActiveSpan()?.setAttribute("payment.status", "failed");
					trace.getActiveSpan()?.setAttribute("payment.error", errorMessage);

					await sagaRepository.update(sagaId, {
						status: SagaStatus.COMPENSATED,
						error: errorMessage,
					});

					await sqs.publish(SagaStepName.RELEASE_STOCK, message.body);

					const order = await orderRepository.findById(orderId);
					if (order) {
						order.cancel();
						await orderRepository.updateStatus(order);
					}
				}
			},
		);

		await sqs.ack(message);
	});
}

main();
