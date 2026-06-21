import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { Product, SagaStepName } from "@casecellshop/shared";
import { CreateOrderUsecase } from "@/application/usecase/order/CreateOrderUsecase";
import {
	InMemoryOrderRepository,
	InMemoryProductRepository,
	InMemorySagaRepository,
	MockQueueAdapter,
} from "../helpers/inMemoryRepositories";

function makeProductFixture(id: string, price = 50) {
	const now = new Date();
	return Product.restore({
		id,
		name: "Test Product",
		price,
		stock: 100,
		version: 1,
		deletedAt: null,
		createdAt: now,
		updatedAt: now,
	});
}

describe("CreateOrderUsecase", () => {
	let orderRepo: InMemoryOrderRepository;
	let productRepo: InMemoryProductRepository;
	let sagaRepo: InMemorySagaRepository;
	let queue: MockQueueAdapter;
	let usecase: CreateOrderUsecase;

	beforeEach(() => {
		orderRepo = new InMemoryOrderRepository();
		productRepo = new InMemoryProductRepository();
		sagaRepo = new InMemorySagaRepository();
		queue = new MockQueueAdapter();
		usecase = new CreateOrderUsecase(orderRepo, productRepo, sagaRepo, queue);
	});

	it("creates an order with the correct amount", async () => {
		productRepo.products.push(makeProductFixture("prd_aaa", 50));

		const result = await usecase.execute({
			items: [{ productId: "prd_aaa", quantity: 2 }],
		});

		assert.match(result.id, /^ord_/);
		assert.equal(result.status, "pending");
		assert.equal(result.amount, 100);
	});

	it("persists the order to the repository", async () => {
		productRepo.products.push(makeProductFixture("prd_aaa"));

		await usecase.execute({ items: [{ productId: "prd_aaa", quantity: 1 }] });

		assert.equal(orderRepo.orders.length, 1);
	});

	it("creates order items for each input item", async () => {
		productRepo.products.push(makeProductFixture("prd_aaa"));
		productRepo.products.push(makeProductFixture("prd_bbb"));

		const result = await usecase.execute({
			items: [
				{ productId: "prd_aaa", quantity: 1 },
				{ productId: "prd_bbb", quantity: 3 },
			],
		});

		assert.equal(result.ordemItems.length, 2);
	});

	it("creates a saga record with RESERVE_STOCK as first step", async () => {
		productRepo.products.push(makeProductFixture("prd_aaa"));

		await usecase.execute({ items: [{ productId: "prd_aaa", quantity: 1 }] });

		assert.equal(sagaRepo.sagas.length, 1);
		assert.equal(sagaRepo.sagas[0]!.currentStep, SagaStepName.RESERVE_STOCK);
	});

	it("links saga to the created order", async () => {
		productRepo.products.push(makeProductFixture("prd_aaa"));

		const result = await usecase.execute({
			items: [{ productId: "prd_aaa", quantity: 1 }],
		});

		assert.equal(sagaRepo.sagas[0]!.orderId, result.id);
	});

	it("publishes a RESERVE_STOCK message to the queue", async () => {
		productRepo.products.push(makeProductFixture("prd_aaa"));

		await usecase.execute({ items: [{ productId: "prd_aaa", quantity: 1 }] });

		assert.equal(queue.published.length, 1);
		assert.equal(queue.published[0]!.queue, SagaStepName.RESERVE_STOCK);
	});

	it("throws AppError 404 when a product is not found", async () => {
		await assert.rejects(
			() =>
				usecase.execute({ items: [{ productId: "prd_missing", quantity: 1 }] }),
			(err: any) => {
				assert.equal(err.statusCode, 404);
				assert.ok(err.message.includes("prd_missing"));
				return true;
			},
		);
	});

	it("does not persist the order when a product is missing", async () => {
		await assert.rejects(() =>
			usecase.execute({ items: [{ productId: "prd_missing", quantity: 1 }] }),
		);
		assert.equal(orderRepo.orders.length, 0);
	});
});
