import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import type { JobData } from "@casecellshop/shared";
import {
	AppError,
	OrdemItem,
	Order,
	Product,
	SagaStatus,
	SagaStepName,
} from "@casecellshop/shared";
import { ReserveStockUsecase } from "../../src/application/usecase/ReserveStockUsecase";
import {
	InMemoryOrderRepository,
	InMemoryProductRepository,
	InMemorySagaRepository,
} from "../helpers/inMemoryRepositories";

class SUT {
	productRepo: InMemoryProductRepository;
	orderRepo: InMemoryOrderRepository;
	sagaRepo: InMemorySagaRepository;
	usecase: ReserveStockUsecase;

	readonly orderId = "ord_test";
	readonly sagaId = "saga_test";

	constructor() {
		this.productRepo = new InMemoryProductRepository();
		this.orderRepo = new InMemoryOrderRepository();
		this.sagaRepo = new InMemorySagaRepository();
		this.usecase = new ReserveStockUsecase(
			this.productRepo,
			this.orderRepo,
			this.sagaRepo,
		);
	}

	addProduct(id = "prd_test", stock = 10) {
		const now = new Date();
		this.productRepo.products.push(
			Product.restore({
				id,
				name: "Test Product",
				price: 50,
				stock,
				version: 1,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			}),
		);
		return this;
	}

	addOrder(id = "ord_test") {
		const now = new Date();
		const item = OrdemItem.create({
			productId: "prd_test",
			price: 50,
			quantity: 1,
		});
		this.orderRepo.orders.push(
			Order.restore({
				id,
				ordemItems: [item],
				status: "pending",
				amount: 50,
				createdAt: now,
				updatedAt: now,
				idempotencyKey: randomUUID(),
			}),
		);
		return this;
	}

	input(overrides: Partial<JobData> = {}): JobData {
		return {
			sagaId: this.sagaId,
			orderId: this.orderId,
			items: [{ productId: "prd_test", quantity: 3 }],
			...overrides,
		};
	}
}

describe("ReserveStockUsecase", () => {
	let sut: SUT;

	beforeEach(() => {
		sut = new SUT();
	});

	it("returns { success: true } when all items are reserved", async () => {
		sut.addProduct().addOrder();
		const result = await sut.usecase.execute(sut.input());
		assert.equal(result.success, true);
	});

	it("decrements stock for each item", async () => {
		sut.addProduct("prd_test", 10).addOrder();
		await sut.usecase.execute(
			sut.input({ items: [{ productId: "prd_test", quantity: 4 }] }),
		);
		const product = await sut.productRepo.findById("prd_test");
		assert.equal(product!.get("stock"), 6);
	});

	it("updates saga status to RUNNING at start", async () => {
		sut.addProduct().addOrder();
		await sut.usecase.execute(sut.input());
		assert.equal(sut.sagaRepo.updates[0]!.data.status, SagaStatus.RUNNING);
	});

	it("advances saga to PROCESS_PAYMENT step on success", async () => {
		sut.addProduct().addOrder();
		await sut.usecase.execute(sut.input());
		const finalUpdate = sut.sagaRepo.updates.at(-1)!;
		assert.equal(finalUpdate.data.status, SagaStatus.RUNNING);
		assert.equal(finalUpdate.data.currentStep, SagaStepName.PROCESS_PAYMENT);
	});

	it("handles multiple items and decrements each", async () => {
		sut.addProduct("prd_a", 10).addProduct("prd_b", 5).addOrder();
		await sut.usecase.execute(
			sut.input({
				items: [
					{ productId: "prd_a", quantity: 2 },
					{ productId: "prd_b", quantity: 3 },
				],
			}),
		);
		const a = await sut.productRepo.findById("prd_a");
		const b = await sut.productRepo.findById("prd_b");
		assert.equal(a!.get("stock"), 8);
		assert.equal(b!.get("stock"), 2);
	});

	it("returns { success: false } when product not found", async () => {
		sut.addOrder();
		const result = await sut.usecase.execute(sut.input());
		assert.equal(result.success, false);
	});

	it("marks saga as FAILED when product not found", async () => {
		sut.addOrder();
		await sut.usecase.execute(sut.input());
		const failUpdate = sut.sagaRepo.updates.find(
			(u) => u.data.status === SagaStatus.FAILED,
		);
		assert.ok(failUpdate, "expected a FAILED saga update");
	});

	it("cancels the order when reservation fails", async () => {
		sut.addOrder();
		await sut.usecase.execute(sut.input());
		const order = await sut.orderRepo.findById(sut.orderId);
		assert.equal(order!.get("status"), "cancelled");
	});

	it("returns { success: false } when stock is insufficient", async () => {
		sut.addProduct("prd_test", 1).addOrder();
		const result = await sut.usecase.execute(
			sut.input({ items: [{ productId: "prd_test", quantity: 5 }] }),
		);
		assert.equal(result.success, false);
	});

	it("compensates already-reserved items when a later item fails", async () => {
		sut.addProduct("prd_a", 10).addOrder();
		await sut.usecase.execute(
			sut.input({
				items: [
					{ productId: "prd_a", quantity: 3 },
					{ productId: "prd_missing", quantity: 1 },
				],
			}),
		);
		const productA = await sut.productRepo.findById("prd_a");
		assert.equal(productA!.get("stock"), 10);
	});

	it("retries decrement once on 409 conflict and succeeds", async () => {
		sut.addProduct().addOrder();
		sut.productRepo.failNextNUpdates(1);
		const result = await sut.usecase.execute(sut.input());
		assert.equal(result.success, true);
		assert.ok(sut.productRepo.updateCallCount >= 2);
	});

	it("returns { success: false } after exhausting all retries with 409", async () => {
		sut.addProduct().addOrder();
		sut.productRepo.failNextNUpdates(10);
		const result = await sut.usecase.execute(sut.input());
		assert.equal(result.success, false);
	});
});
