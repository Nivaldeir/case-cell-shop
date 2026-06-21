import {
	type JobData,
	OrderRepository,
	ProductRepository,
	type QueueMessage,
	SagaRepository,
	SagaStepName,
	SQSAdapter,
} from "@casecellshop/shared";
import { ReleaseStockUsecase } from "./application/usecase/ReleaseStockUsecase";
import { ReserveStockUsecase } from "./application/usecase/ReserveStockUsecase";

async function main() {
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

	void sqs.consume(
		SagaStepName.RESERVE_STOCK,
		async (message: QueueMessage<JobData>) => {
			const { sagaId, orderId, items } = message.body;

			const output = await reserveStockUsecase.execute({
				sagaId,
				items,
				orderId,
			});

			if (output)
				await sqs.publish<JobData>(SagaStepName.PROCESS_PAYMENT, {
					sagaId,
					orderId,
					items,
				});
		},
	);

	void sqs.consume(
		SagaStepName.RELEASE_STOCK,
		async (message: QueueMessage<JobData>) => {
			const { sagaId, orderId, items } = message.body;

			await releaseStockUsecase.execute({ sagaId, items, orderId });
		},
	);
}

main();
