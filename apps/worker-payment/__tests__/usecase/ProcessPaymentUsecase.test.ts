import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import {
	OrdemItem,
	Order,
	SagaStatus,
	SagaStepName,
} from "@casecellshop/shared";
import { ProcessPaymentUsecase } from "../../src/application/usecase/ProcessPaymentUsecase";
import {
	InMemoryOrderRepository,
	InMemoryPaymentRepository,
	InMemorySagaRepository,
	MockQueueAdapter,
} from "../helpers/inMemoryRepositories";

class SUT {
	orderRepo: InMemoryOrderRepository;
	paymentRepo: InMemoryPaymentRepository;
	sagaRepo: InMemorySagaRepository;
	queue: MockQueueAdapter;

	readonly sagaId = "saga_test";
	readonly orderId = "ord_test";

	private _resolvePayment: () => boolean = () => true;

	get usecase() {
		return new ProcessPaymentUsecase(
			this.orderRepo,
			this.paymentRepo,
			this.sagaRepo,
			this.queue,
			this._resolvePayment,
		);
	}

	constructor() {
		this.orderRepo = new InMemoryOrderRepository();
		this.paymentRepo = new InMemoryPaymentRepository();
		this.sagaRepo = new InMemorySagaRepository();
		this.queue = new MockQueueAdapter();
	}

	approvePayment() {
		this._resolvePayment = () => true;
		return this;
	}

	declinePayment() {
		this._resolvePayment = () => false;
		return this;
	}

	addOrder(id = "ord_test", amount = 300) {
		const now = new Date();
		const item = OrdemItem.create({
			productId: "prd_test",
			price: amount,
			quantity: 1,
		});
		this.orderRepo.orders.push(
			Order.restore({
				id,
				ordemItems: [item],
				status: "pending",
				amount,
				createdAt: now,
				updatedAt: now,
				idempotencyKey: randomUUID(),
			}),
		);
		return this;
	}

	input(
		overrides: Partial<{ sagaId: string; orderId: string; items: any[] }> = {},
	) {
		return {
			sagaId: this.sagaId,
			orderId: this.orderId,
			items: [{ productId: "prd_test", quantity: 1 }],
			...overrides,
		};
	}
}

describe("ProcessPaymentUsecase", () => {
	let sut: SUT;

	beforeEach(() => {
		sut = new SUT();
	});

	describe("payment approved", () => {
		it("returns { approved: true }", async () => {
			sut.approvePayment().addOrder();
			const result = await sut.usecase.execute(sut.input());
			assert.equal(result.approved, true);
		});

		it("creates a payment with pix type and correct amount", async () => {
			sut.approvePayment().addOrder("ord_test", 500);
			await sut.usecase.execute(sut.input());
			const payment = await sut.paymentRepo.findByOrderId(sut.orderId);
			assert.ok(payment);
			assert.equal(payment.get("type"), "pix");
			assert.equal(payment.get("amount"), 500);
		});

		it("marks payment as paid", async () => {
			sut.approvePayment().addOrder();
			await sut.usecase.execute(sut.input());
			const payment = await sut.paymentRepo.findByOrderId(sut.orderId);
			assert.equal(payment!.get("status"), "paid");
		});

		it("marks order as paid", async () => {
			sut.approvePayment().addOrder();
			await sut.usecase.execute(sut.input());
			const order = await sut.orderRepo.findById(sut.orderId);
			assert.equal(order!.get("status"), "paid");
		});

		it("updates saga to COMPLETED", async () => {
			sut.approvePayment().addOrder();
			await sut.usecase.execute(sut.input());
			const completedUpdate = sut.sagaRepo.updates.find(
				(u) => u.data.status === SagaStatus.COMPLETED,
			);
			assert.ok(completedUpdate);
		});

		it("does NOT publish RELEASE_STOCK when approved", async () => {
			sut.approvePayment().addOrder();
			await sut.usecase.execute(sut.input());
			const releaseMsg = sut.queue.published.find(
				(p) => p.queue === SagaStepName.RELEASE_STOCK,
			);
			assert.equal(releaseMsg, undefined);
		});
	});

	describe("payment declined", () => {
		it("returns { approved: false }", async () => {
			sut.declinePayment().addOrder();
			const result = await sut.usecase.execute(sut.input());
			assert.equal(result.approved, false);
		});

		it("includes error message in result", async () => {
			sut.declinePayment().addOrder();
			const result = await sut.usecase.execute(sut.input());
			assert.ok(result.error);
			assert.match(result.error, /Pagamento recusado/);
		});

		it("marks payment as failed", async () => {
			sut.declinePayment().addOrder();
			await sut.usecase.execute(sut.input());
			const payment = await sut.paymentRepo.findByOrderId(sut.orderId);
			assert.equal(payment!.get("status"), "failed");
		});

		it("updates saga to COMPENSATED with error", async () => {
			sut.declinePayment().addOrder();
			await sut.usecase.execute(sut.input());
			const compensated = sut.sagaRepo.updates.find(
				(u) => u.data.status === SagaStatus.COMPENSATED,
			);
			assert.ok(compensated);
			assert.ok(compensated.data.error);
		});

		it("publishes RELEASE_STOCK with correct payload", async () => {
			sut.declinePayment().addOrder();
			await sut.usecase.execute(sut.input());
			const msg = sut.queue.published.find(
				(p) => p.queue === SagaStepName.RELEASE_STOCK,
			);
			assert.ok(msg);
			const body = msg.message as any;
			assert.equal(body.sagaId, sut.sagaId);
			assert.equal(body.orderId, sut.orderId);
		});

		it("cancels the order when payment is declined", async () => {
			sut.declinePayment().addOrder();
			await sut.usecase.execute(sut.input());
			const order = await sut.orderRepo.findById(sut.orderId);
			assert.equal(order!.get("status"), "cancelled");
		});
	});

	describe("order not found", () => {
		it("returns { approved: false } when order does not exist", async () => {
			sut.approvePayment();
			const result = await sut.usecase.execute(sut.input());
			assert.equal(result.approved, false);
		});

		it("updates saga to COMPENSATED when order not found", async () => {
			sut.approvePayment();
			await sut.usecase.execute(sut.input());
			const compensated = sut.sagaRepo.updates.find(
				(u) => u.data.status === SagaStatus.COMPENSATED,
			);
			assert.ok(compensated);
			assert.match(compensated.data.error!, /não encontrado/);
		});

		it("publishes RELEASE_STOCK when order not found", async () => {
			sut.approvePayment();
			await sut.usecase.execute(sut.input());
			const msg = sut.queue.published.find(
				(p) => p.queue === SagaStepName.RELEASE_STOCK,
			);
			assert.ok(msg);
		});
	});
});
