import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { OrdemItem, Order, Payment } from "@casecellshop/shared";
import { GetOrderStatusUsecase } from "@/application/usecase/order/GetOrderStatusUsecase";
import {
	InMemoryOrderRepository,
	InMemoryPaymentRepository,
} from "../helpers/inMemoryRepositories";

function makeOrderFixture(id: string) {
	const item = OrdemItem.create({
		productId: "prd_111",
		price: 100,
		quantity: 2,
	});
	const now = new Date();
	return Order.restore({
		id,
		ordemItems: [item],
		status: "pending",
		amount: 200,
		createdAt: now,
		updatedAt: now,
	});
}

function makePaymentFixture(orderId: string) {
	return Payment.create({ orderId, type: "pix", amount: 200 });
}

describe("GetOrderStatusUsecase", () => {
	let orderRepo: InMemoryOrderRepository;
	let paymentRepo: InMemoryPaymentRepository;
	let usecase: GetOrderStatusUsecase;

	beforeEach(() => {
		orderRepo = new InMemoryOrderRepository();
		paymentRepo = new InMemoryPaymentRepository();
		usecase = new GetOrderStatusUsecase(orderRepo, paymentRepo);
	});

	it("returns order data when order exists", async () => {
		orderRepo.orders.push(makeOrderFixture("ord_test"));

		const result = await usecase.execute({ orderId: "ord_test" });

		assert.equal(result.orderId, "ord_test");
		assert.equal(result.status, "pending");
		assert.equal(result.amount, 200);
	});

	it("returns mapped order items", async () => {
		orderRepo.orders.push(makeOrderFixture("ord_test"));

		const result = await usecase.execute({ orderId: "ord_test" });

		assert.equal(result.items.length, 1);
		assert.equal(result.items[0]!.productId, "prd_111");
		assert.equal(result.items[0]!.quantity, 2);
		assert.equal(result.items[0]!.price, 100);
	});

	it("returns null payment when no payment exists", async () => {
		orderRepo.orders.push(makeOrderFixture("ord_test"));

		const result = await usecase.execute({ orderId: "ord_test" });

		assert.equal(result.payment, null);
	});

	it("returns payment details when payment exists", async () => {
		orderRepo.orders.push(makeOrderFixture("ord_test"));
		const payment = makePaymentFixture("ord_test");
		payment.markAsPaid();
		paymentRepo.payments.push(payment);

		const result = await usecase.execute({ orderId: "ord_test" });

		assert.ok(result.payment !== null);
		assert.equal(result.payment!.status, "paid");
		assert.equal(result.payment!.type, "pix");
		assert.equal(result.payment!.amount, 200);
	});

	it("throws AppError 404 when order is not found", async () => {
		await assert.rejects(
			() => usecase.execute({ orderId: "ord_missing" }),
			(err: any) => {
				assert.equal(err.statusCode, 404);
				assert.ok(err.message.includes("ord_missing"));
				return true;
			},
		);
	});
});
