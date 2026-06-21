import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Payment } from "@casecellshop/shared";

function makePayment() {
	return Payment.create({
		orderId: "ord_test123",
		type: "pix",
		amount: 200,
	});
}

describe("Payment domain", () => {
	describe("Payment.create()", () => {
		it("creates with pending status", () => {
			const payment = makePayment();
			assert.equal(payment.get("status"), "pending");
		});

		it("generates an id with pay_ prefix", () => {
			const payment = makePayment();
			assert.match(payment.get("id"), /^pay_/);
		});

		it("stores orderId, type, and amount", () => {
			const payment = makePayment();
			assert.equal(payment.get("orderId"), "ord_test123");
			assert.equal(payment.get("type"), "pix");
			assert.equal(payment.get("amount"), 200);
		});

		it("sets createdAt and updatedAt", () => {
			const before = new Date();
			const payment = makePayment();
			assert.ok(payment.get("createdAt") >= before);
			assert.ok(payment.get("updatedAt") >= before);
		});

		it("generates unique ids across instances", () => {
			const a = makePayment();
			const b = makePayment();
			assert.notEqual(a.get("id"), b.get("id"));
		});
	});

	describe("Payment.restore()", () => {
		it("restores from existing props", () => {
			const now = new Date();
			const payment = Payment.restore({
				id: "pay_restored",
				orderId: "ord_abc",
				type: "boleto",
				status: "paid",
				amount: 500,
				createdAt: now,
				updatedAt: now,
			});
			assert.equal(payment.get("id"), "pay_restored");
			assert.equal(payment.get("status"), "paid");
		});
	});

	describe("status transitions", () => {
		it("markAsPaid() sets status to paid", () => {
			const payment = makePayment();
			payment.markAsPaid();
			assert.equal(payment.get("status"), "paid");
		});

		it("markAsFailed() sets status to failed", () => {
			const payment = makePayment();
			payment.markAsFailed();
			assert.equal(payment.get("status"), "failed");
		});

		it("refund() sets status to refunded", () => {
			const payment = makePayment();
			payment.refund();
			assert.equal(payment.get("status"), "refunded");
		});

		it("status transitions update updatedAt", () => {
			const payment = makePayment();
			const original = payment.get("updatedAt");
			payment.markAsPaid();
			assert.ok(payment.get("updatedAt") >= original);
		});
	});
});
