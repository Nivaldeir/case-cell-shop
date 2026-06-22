import {
	Observability,
	OrderRepository,
	ProductRepository,
	SagaRepository,
	SagaStepName,
	SQSAdapter,
} from "@casecellshop/shared";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { ReleaseStockUsecase } from "./application/usecase/ReleaseStockUsecase";
import { ReserveStockUsecase } from "./application/usecase/ReserveStockUsecase";

async function main() {
	Observability.start();
	const sqs = new SQSAdapter();
	await sqs.connect();

	const productRepository = new ProductRepository();
	const orderRepository = new OrderRepository();
	const sagasRepository = new SagaRepository();

	const reserveStockUsecase = new ReserveStockUsecase(
		productRepository,
		orderRepository,
		sagasRepository,
	);
	const releaseStockUsecase = new ReleaseStockUsecase(
		productRepository,
		sagasRepository,
	);

	void sqs.consume(SagaStepName.RESERVE_STOCK, async (message: any) => {
		const { sagaId, orderId, items } = message.body;

		await Observability.withSpan(
			"reserve-stock",
			{
				"saga.id": sagaId,
				"order.id": orderId,
				"input.items": JSON.stringify(items),
			},
			async () => {
				const output = await reserveStockUsecase.execute({
					sagaId,
					items,
					orderId,
				});

				trace
					.getActiveSpan()
					?.setAttribute("output.success", String(output.success));

				if (!output.success) {
					trace.getActiveSpan()?.setStatus({
						code: SpanStatusCode.ERROR,
						message: "Falha na reserva de estoque",
					});
					return;
				}

				await sqs.publish(SagaStepName.PROCESS_PAYMENT, {
					sagaId,
					orderId,
					items,
				});
			},
		);

		console.log("Mensagem lida");
		await sqs.ack(message);
	});

	void sqs.consume(SagaStepName.RELEASE_STOCK, async (message: any) => {
		const { sagaId, orderId, items } = message.body;

		await Observability.withSpan(
			"release-stock",
			{
				"saga.id": sagaId,
				"order.id": orderId,
				"input.items": JSON.stringify(items),
			},
			async () => {
				await releaseStockUsecase.execute({ sagaId, items, orderId });
			},
		);

		await sqs.ack(message);
	});
}

main();
