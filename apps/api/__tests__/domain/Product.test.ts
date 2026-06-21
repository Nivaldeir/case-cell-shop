import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Product } from "@casecellshop/shared";

function makeProduct(
	overrides: Partial<{ name: string; price: number; stock: number }> = {},
) {
	return Product.create({
		name: overrides.name ?? "Test Product",
		price: overrides.price ?? 100,
		stock: overrides.stock ?? 10,
		version: 1,
		deletedAt: null,
	});
}

describe("Product domain", () => {
	describe("Product.create()", () => {
		it("creates with version 1", () => {
			const product = makeProduct();
			assert.equal(product.get("version"), 1);
		});

		it("generates an id with prd_ prefix", () => {
			const product = makeProduct();
			assert.match(product.get("id") ?? "", /^prd_/);
		});

		it("sets deletedAt to null", () => {
			const product = makeProduct();
			assert.equal(product.get("deletedAt"), null);
		});

		it("stores name, price, and stock", () => {
			const product = makeProduct({
				name: "Widget Pro",
				price: 29.99,
				stock: 50,
			});
			assert.equal(product.get("name"), "Widget Pro");
			assert.equal(product.get("price"), 29.99);
			assert.equal(product.get("stock"), 50);
		});

		it("sets createdAt and updatedAt", () => {
			const before = new Date();
			const product = makeProduct();
			assert.ok(product.get("createdAt") >= before);
		});
	});

	describe("Product.restore()", () => {
		it("restores from existing props", () => {
			const now = new Date();
			const product = Product.restore({
				id: "prd_restored",
				name: "Restored Product",
				price: 99,
				stock: 5,
				version: 3,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			});
			assert.equal(product.get("id"), "prd_restored");
			assert.equal(product.get("version"), 3);
		});
	});

	describe("incrementStock()", () => {
		it("increases stock by given quantity", () => {
			const product = makeProduct({ stock: 10 });
			product.incrementStock(5);
			assert.equal(product.get("stock"), 15);
		});

		it("bumps version", () => {
			const product = makeProduct({ stock: 10 });
			product.incrementStock(5);
			assert.equal(product.get("version"), 2);
		});

		it("throws when quantity is zero", () => {
			const product = makeProduct();
			assert.throws(() => product.incrementStock(0), /acima 0/);
		});

		it("throws when quantity is negative", () => {
			const product = makeProduct();
			assert.throws(() => product.incrementStock(-3), /acima 0/);
		});
	});

	describe("decrementStock()", () => {
		it("decreases stock by given quantity", () => {
			const product = makeProduct({ stock: 10 });
			product.decrementStock(4);
			assert.equal(product.get("stock"), 6);
		});

		it("bumps version", () => {
			const product = makeProduct({ stock: 10 });
			product.decrementStock(4);
			assert.equal(product.get("version"), 2);
		});

		it("throws when quantity is zero", () => {
			const product = makeProduct();
			assert.throws(() => product.decrementStock(0), /acima 0/);
		});

		it("throws when quantity is negative", () => {
			const product = makeProduct();
			assert.throws(() => product.decrementStock(-1), /acima 0/);
		});

		it("throws when quantity exceeds available stock", () => {
			const product = makeProduct({ stock: 5 });
			assert.throws(() => product.decrementStock(6), /insuficiente/);
		});

		it("allows decrementing exactly all available stock", () => {
			const product = makeProduct({ stock: 5 });
			product.decrementStock(5);
			assert.equal(product.get("stock"), 0);
		});
	});

	describe("desatived() / actived()", () => {
		it("desatived() sets deletedAt to a Date", () => {
			const product = makeProduct();
			product.desatived();
			assert.ok(product.get("deletedAt") instanceof Date);
		});

		it("actived() clears deletedAt back to null", () => {
			const product = makeProduct();
			product.desatived();
			product.actived();
			assert.equal(product.get("deletedAt"), null);
		});
	});
});
