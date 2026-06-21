import {
	AppError,
	type JobData,
	OrderRepository,
	Payment,
	PaymentRepository,
	type QueueMessage,
	SagaRepository,
	SagaStatus,
	SagaStepName,
	SQSAdapter,
} from "@casecellshop/shared";

async function main() {
	const sqs = new SQSAdapter();
	await sqs.connect();

	const paymentRepository = new PaymentRepository();
	const orderRepository = new OrderRepository();
	const sagaRepository = new SagaRepository();

	console.log(
		"[worker-payment] Aguardando mensagens na fila:",
		SagaStepName.PROCESS_PAYMENT,
	);

	void sqs.consume(
		SagaStepName.PROCESS_PAYMENT,
		async (message: QueueMessage<JobData>) => {
			const { sagaId, orderId } = message.body;

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

				if (isNotPaid) throw new AppError("Forcando error");

				payment.markAsPaid();
				await paymentRepository.updateStatus(payment);

				order.markAsPaid();
				await orderRepository.updateStatus(order);

				await sagaRepository.update(sagaId, { status: SagaStatus.COMPLETED });

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
			} finally {
				await sqs.ack(message);
			}
		},
	);
}

main();
