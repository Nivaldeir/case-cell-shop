import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OrdemItem, Order } from "@casecellshop/shared";

function makeItem(price = 10, quantity = 2) {
	return OrdemItem.create({ productId: "prd_abc123", price, quantity });
}

describe("Order domain", () => {
	describe("Order.create()", () => {
		it("creates an order with pending status", () => {
			const order = Order.create({ ordemItems: [makeItem()] });
			assert.equal(order.get("status"), "pending");
		});

		it("generates an id with ord_ prefix", () => {
			const order = Order.create({ ordemItems: [makeItem()] });
			assert.match(order.get("id"), /^ord_/);
		});

		it("computes total amount from a single item", () => {
			const order = Order.create({ ordemItems: [makeItem(50, 3)] });
			assert.equal(order.get("amount"), 150);
		});

		it("sums amount across multiple items", () => {
			const order = Order.create({
				ordemItems: [makeItem(10, 2), makeItem(5, 4)],
			});
			assert.equal(order.get("amount"), 40);
		});

		it("throws when created with empty item list", () => {
			assert.throws(() => Order.create({ ordemItems: [] }), /Nenhum produto/);
		});

		it("sets createdAt and updatedAt to current time", () => {
			const before = new Date();
			const order = Order.create({ ordemItems: [makeItem()] });
			const after = new Date();
			assert.ok(order.get("createdAt") >= before);
			assert.ok(order.get("createdAt") <= after);
			assert.ok(order.get("updatedAt") >= before);
		});
	});

	describe("Order.restore()", () => {
		it("restores an order with the given props", () => {
			const item = makeItem(100, 1);
			const now = new Date();
			const order = Order.restore({
				id: "ord_test123",
				ordemItems: [item],
				status: "paid",
				amount: 100,
				createdAt: now,
				updatedAt: now,
			});
			assert.equal(order.get("id"), "ord_test123");
			assert.equal(order.get("status"), "paid");
		});
	});

	describe("status transitions", () => {
		it("markAsPaid() sets status to paid", () => {
			const order = Order.create({ ordemItems: [makeItem()] });
			order.markAsPaid();
			assert.equal(order.get("status"), "paid");
		});

		it("markAsShipped() sets status to shipped", () => {
			const order = Order.create({ ordemItems: [makeItem()] });
			order.markAsShipped();
			assert.equal(order.get("status"), "shipped");
		});

		it("markAsDelivered() sets status to delivered", () => {
			const order = Order.create({ ordemItems: [makeItem()] });
			order.markAsDelivered();
			assert.equal(order.get("status"), "delivered");
		});

		it("cancel() sets status to cancelled", () => {
			const order = Order.create({ ordemItems: [makeItem()] });
			order.cancel();
			assert.equal(order.get("status"), "cancelled");
		});

		it("status transitions update updatedAt", () => {
			const order = Order.create({ ordemItems: [makeItem()] });
			const original = order.get("updatedAt");
			order.markAsPaid();
			assert.ok(order.get("updatedAt") >= original);
		});
	});

	describe("toJSON()", () => {
		it("returns a frozen snapshot of the order", () => {
			const order = Order.create({ ordemItems: [makeItem(20, 2)] });
			const json = order.toJSON();
			assert.equal(json.status, "pending");
			assert.equal(json.amount, 40);
			assert.ok(Object.isFrozen(json));
		});
	});
});
