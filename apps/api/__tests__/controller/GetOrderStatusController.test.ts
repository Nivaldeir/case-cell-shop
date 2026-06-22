import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import { AppError, OrdemItem, Order, Payment } from "@casecellshop/shared";
import { GetOrderStatusUsecase } from "@/application/usecase/order/GetOrderStatusUsecase";
import { GetOrderStatusController } from "@/presentation/api/controllers/order/GetOrderStatusController";
import { mockReq, mockRes } from "../helpers/createTestServer";
import {
	InMemoryOrderRepository,
	InMemoryPaymentRepository,
} from "../helpers/inMemoryRepositories";

type FakeOutput = {
	orderId: string;
	status: string;
	amount: number;
	items: Array<{ productId: string; quantity: number; price: number }>;
	payment: {
		paymentId: string;
		status: string;
		type: string;
		amount: number;
	} | null;
};

class SUT {
	executeFn: (input: any) => Promise<FakeOutput>;
	controller: GetOrderStatusController;

	private static readonly defaultOutput: FakeOutput = {
		orderId: "ord_abc",
		status: "pending",
		amount: 100,
		items: [{ productId: "prd_111", quantity: 2, price: 50 }],
		payment: null,
	};

	constructor() {
		this.executeFn = async () => ({ ...SUT.defaultOutput });
		const mockUsecase = {
			execute: async (i: any) => this.executeFn(i),
		} as unknown as GetOrderStatusUsecase;
		this.controller = new GetOrderStatusController(mockUsecase);
	}

	validReq(orderId = "ord_abc") {
		return mockReq({ params: { orderId } });
	}

	static withRealDeps() {
		const orderRepo = new InMemoryOrderRepository();
		const paymentRepo = new InMemoryPaymentRepository();

		const now = new Date();
		const item = OrdemItem.create({
			productId: "prd_111",
			price: 50,
			quantity: 2,
		});
		const order = Order.restore({
			id: "ord_real",
			ordemItems: [item],
			status: "pending",
			amount: 100,
			createdAt: now,
			updatedAt: now,
			idempotencyKey: randomUUID(),
		});
		orderRepo.orders.push(order);

		const payment = Payment.restore({
			id: "pay_real",
			orderId: "ord_real",
			status: "paid",
			type: "pix",
			amount: 100,
			createdAt: now,
			updatedAt: now,
		});
		paymentRepo.payments.push(payment);

		const usecase = new GetOrderStatusUsecase(orderRepo, paymentRepo);
		return {
			controller: new GetOrderStatusController(usecase),
			orderRepo,
			paymentRepo,
		};
	}
}

describe("GetOrderStatusController", () => {
	let sut: SUT;

	beforeEach(() => {
		sut = new SUT();
	});

	it("returns 202 on a valid request", async () => {
		const res = mockRes();
		await sut.controller.handle(sut.validReq(), res);
		assert.equal(res.statusCode, 202);
	});

	it("returns order data in response envelope", async () => {
		const res = mockRes();
		await sut.controller.handle(sut.validReq(), res);
		assert.equal(res.data.error, false);
		assert.equal(res.data.data.orderId, "ord_abc");
		assert.equal(res.data.data.status, "pending");
		assert.equal(res.data.data.amount, 100);
	});

	it("returns null payment when order has no payment", async () => {
		const res = mockRes();
		await sut.controller.handle(sut.validReq(), res);
		assert.equal(res.data.data.payment, null);
	});

	it("returns payment data when payment exists", async () => {
		sut.executeFn = async () => ({
			orderId: "ord_abc",
			status: "pending",
			amount: 100,
			items: [{ productId: "prd_111", quantity: 2, price: 50 }],
			payment: {
				paymentId: "pay_xyz",
				status: "paid",
				type: "pix",
				amount: 100,
			},
		});

		const res = mockRes();
		await sut.controller.handle(sut.validReq(), res);
		assert.equal(res.data.data.payment.paymentId, "pay_xyz");
		assert.equal(res.data.data.payment.status, "paid");
	});

	it("throws ZodError when orderId param is missing", async () => {
		await assert.rejects(
			() => sut.controller.handle(mockReq({ params: {} }), mockRes()),
			(err: any) => err.name === "ZodError",
		);
	});

	it("propagates AppError 404 from the usecase", async () => {
		sut.executeFn = async () => {
			throw new AppError("Pedido ord_missing não encontrado", 404);
		};
		await assert.rejects(
			() => sut.controller.handle(sut.validReq("ord_missing"), mockRes()),
			(err: any) => {
				assert.equal(err.statusCode, 404);
				return true;
			},
		);
	});

	it("works with real use case and in-memory repos", async () => {
		const { controller } = SUT.withRealDeps();
		const res = mockRes();
		await controller.handle(mockReq({ params: { orderId: "ord_real" } }), res);
		assert.equal(res.statusCode, 202);
		assert.equal(res.data.data.orderId, "ord_real");
		assert.equal(res.data.data.payment.status, "paid");
	});
});
