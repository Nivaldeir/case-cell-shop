import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OrdemItem } from "@casecellshop/shared";

describe("OrdemItem domain", () => {
	describe("OrdemItem.create()", () => {
		it("stores productId, price, and quantity", () => {
			const item = OrdemItem.create({
				productId: "prd_abc",
				price: 25.5,
				quantity: 3,
			});
			assert.equal(item.get("productId"), "prd_abc");
			assert.equal(item.get("price"), 25.5);
			assert.equal(item.get("quantity"), 3);
		});

		it("auto-generates a unique id", () => {
			const item = OrdemItem.create({
				productId: "prd_abc",
				price: 10,
				quantity: 1,
			});
			assert.ok(typeof item.get("id") === "string");
			assert.ok(item.get("id").length > 0);
		});

		it("generates distinct ids per instance", () => {
			const a = OrdemItem.create({
				productId: "prd_abc",
				price: 10,
				quantity: 1,
			});
			const b = OrdemItem.create({
				productId: "prd_abc",
				price: 10,
				quantity: 1,
			});
			assert.notEqual(a.get("id"), b.get("id"));
		});
	});

	describe("OrdemItem.restore()", () => {
		it("restores with the provided id", () => {
			const item = OrdemItem.restore({
				id: "uuid-fixed-123",
				productId: "prd_xyz",
				price: 15,
				quantity: 2,
			});
			assert.equal(item.get("id"), "uuid-fixed-123");
			assert.equal(item.get("productId"), "prd_xyz");
			assert.equal(item.get("price"), 15);
			assert.equal(item.get("quantity"), 2);
		});
	});

	describe("toJSON()", () => {
		it("returns a frozen snapshot", () => {
			const item = OrdemItem.create({
				productId: "prd_abc",
				price: 10,
				quantity: 2,
			});
			const json = item.toJSON();
			assert.equal(json.price, 10);
			assert.ok(Object.isFrozen(json));
		});
	});
});
