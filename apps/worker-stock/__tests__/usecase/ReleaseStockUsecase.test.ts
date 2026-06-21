import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { JobData } from "@casecellshop/shared";
import {
	AppError,
	Product,
	SagaStatus,
	SagaStepName,
} from "@casecellshop/shared";
import { ReleaseStockUsecase } from "../../src/application/usecase/ReleaseStockUsecase";
import {
	InMemoryProductRepository,
	InMemorySagaRepository,
} from "../helpers/inMemoryRepositories";

class SUT {
	productRepo: InMemoryProductRepository;
	sagaRepo: InMemorySagaRepository;
	usecase: ReleaseStockUsecase;

	readonly sagaId = "saga_test";
	readonly orderId = "ord_test";

	constructor() {
		this.productRepo = new InMemoryProductRepository();
		this.sagaRepo = new InMemorySagaRepository();
		this.usecase = new ReleaseStockUsecase(this.productRepo, this.sagaRepo);
	}

	addProduct(id = "prd_test", stock = 5) {
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

	input(overrides: Partial<JobData> = {}): JobData {
		return {
			sagaId: this.sagaId,
			orderId: this.orderId,
			items: [{ productId: "prd_test", quantity: 3 }],
			...overrides,
		};
	}
}

describe("ReleaseStockUsecase", () => {
	let sut: SUT;

	beforeEach(() => {
		sut = new SUT();
	});

	it("returns { success: true }", async () => {
		sut.addProduct();
		const result = await sut.usecase.execute(sut.input());
		assert.equal(result.success, true);
	});

	it("increments stock for each item", async () => {
		sut.addProduct("prd_test", 5);
		await sut.usecase.execute(
			sut.input({ items: [{ productId: "prd_test", quantity: 3 }] }),
		);
		const product = await sut.productRepo.findById("prd_test");
		assert.equal(product!.get("stock"), 8);
	});

	it("updates saga to FAILED with RELEASE_STOCK step", async () => {
		sut.addProduct();
		await sut.usecase.execute(sut.input());
		const lastUpdate = sut.sagaRepo.updates.at(-1)!;
		assert.equal(lastUpdate.data.status, SagaStatus.FAILED);
		assert.equal(lastUpdate.data.currentStep, SagaStepName.RELEASE_STOCK);
	});

	it("increments multiple items independently", async () => {
		sut.addProduct("prd_a", 2).addProduct("prd_b", 7);
		await sut.usecase.execute(
			sut.input({
				items: [
					{ productId: "prd_a", quantity: 5 },
					{ productId: "prd_b", quantity: 1 },
				],
			}),
		);
		const a = await sut.productRepo.findById("prd_a");
		const b = await sut.productRepo.findById("prd_b");
		assert.equal(a!.get("stock"), 7);
		assert.equal(b!.get("stock"), 8);
	});

	it("skips gracefully when product is not found", async () => {
		const result = await sut.usecase.execute(sut.input());
		assert.equal(result.success, true);
	});

	it("retries increment once on 409 conflict and succeeds", async () => {
		sut.addProduct();
		sut.productRepo.failNextNUpdates(1);
		const result = await sut.usecase.execute(sut.input());
		assert.equal(result.success, true);
		assert.ok(sut.productRepo.updateCallCount >= 2);
	});

	it("propagates non-409 errors", async () => {
		sut.addProduct();
		sut.productRepo.failNextNUpdates(10, new AppError("internal error", 500));
		await assert.rejects(
			() => sut.usecase.execute(sut.input()),
			(err: any) => {
				assert.equal(err.statusCode, 500);
				return true;
			},
		);
	});
});
