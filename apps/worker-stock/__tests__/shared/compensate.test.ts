import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { Product } from "@casecellshop/shared";
import { compensate } from "../../src/shared/compensate";
import { InMemoryProductRepository } from "../helpers/inMemoryRepositories";

class SUT {
	productRepo: InMemoryProductRepository;

	constructor() {
		this.productRepo = new InMemoryProductRepository();
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
}

describe("compensate", () => {
	let sut: SUT;

	beforeEach(() => {
		sut = new SUT();
	});

	it("restores stock for a compensated item", async () => {
		sut.addProduct("prd_test", 5);
		await compensate(sut.productRepo, [{ productId: "prd_test", quantity: 3 }]);
		const product = await sut.productRepo.findById("prd_test");
		assert.equal(product!.get("stock"), 8);
	});

	it("skips gracefully when product is not found", async () => {
		await assert.doesNotReject(() =>
			compensate(sut.productRepo, [{ productId: "prd_missing", quantity: 2 }]),
		);
	});

	it("restores stock for multiple items", async () => {
		sut.addProduct("prd_a", 3).addProduct("prd_b", 7);
		await compensate(sut.productRepo, [
			{ productId: "prd_a", quantity: 4 },
			{ productId: "prd_b", quantity: 1 },
		]);
		const a = await sut.productRepo.findById("prd_a");
		const b = await sut.productRepo.findById("prd_b");
		assert.equal(a!.get("stock"), 7);
		assert.equal(b!.get("stock"), 8);
	});

	it("continues after a failed item and restores remaining", async () => {
		sut.addProduct("prd_b", 2);
		await assert.doesNotReject(() =>
			compensate(sut.productRepo, [
				{ productId: "prd_missing", quantity: 5 },
				{ productId: "prd_b", quantity: 3 },
			]),
		);
		const b = await sut.productRepo.findById("prd_b");
		assert.equal(b!.get("stock"), 5);
	});
});
