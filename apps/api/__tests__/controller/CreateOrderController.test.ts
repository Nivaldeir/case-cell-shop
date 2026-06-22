import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import { AppError, OrdemItem, Order, Product } from "@casecellshop/shared";
import { CreateOrderUsecase } from "@/application/usecase/order/CreateOrderUsecase";
import { CreateOrderController } from "@/presentation/api/controllers/order/CreateOrderController";
import { mockReq, mockRes } from "../helpers/createTestServer";
import {
	InMemoryOrderRepository,
	InMemoryProductRepository,
	InMemorySagaRepository,
	MockQueueAdapter,
} from "../helpers/inMemoryRepositories";

class SUT {
	executeFn: (input: any) => Promise<any>;
	controller: CreateOrderController;

	constructor() {
		const now = new Date();
		const item = OrdemItem.create({
			productId: "prd_111",
			price: 50,
			quantity: 2,
		});
		const fakeOrder = Order.restore({
			id: "ord_abc",
			ordemItems: [item],
			status: "pending",
			amount: 100,
			createdAt: now,
			updatedAt: now,
			idempotencyKey: randomUUID(),
		}).toJSON();

		this.executeFn = async () => fakeOrder;
		const mockUsecase = {
			execute: async (i: any) => this.executeFn(i),
		} as unknown as CreateOrderUsecase;
		this.controller = new CreateOrderController(mockUsecase);
	}

	validReq(overrides: { body?: any; headers?: any } = {}) {
		return mockReq({
			body: overrides.body ?? {
				items: [{ productId: "prd_111", quantity: 2 }],
			},
			headers: { "idempotency-key": randomUUID(), ...overrides.headers },
		});
	}

	static withRealDeps() {
		const productRepo = new InMemoryProductRepository();
		const now = new Date();
		productRepo.products.push(
			Product.restore({
				id: "prd_real",
				name: "Real Product",
				price: 75,
				stock: 10,
				version: 1,
				deletedAt: null,
				createdAt: now,
				updatedAt: now,
			}),
		);
		const usecase = new CreateOrderUsecase(
			new InMemoryOrderRepository(),
			productRepo,
			new InMemorySagaRepository(),
			new MockQueueAdapter(),
		);
		return new CreateOrderController(usecase);
	}
}

describe("CreateOrderController", () => {
	let sut: SUT;

	beforeEach(() => {
		sut = new SUT();
	});

	it("returns 202 on a valid request", async () => {
		const res = mockRes();
		await sut.controller.handle(sut.validReq(), res);
		assert.equal(res.statusCode, 202);
	});

	it("returns success envelope with order data", async () => {
		const res = mockRes();
		await sut.controller.handle(sut.validReq(), res);
		assert.equal(res.data.error, false);
		assert.ok(res.data.data);
		assert.equal(res.data.data.id, "ord_abc");
	});

	it("throws AppError 400 when idempotency-key header is missing", async () => {
		await assert.rejects(
			() =>
				sut.controller.handle(
					mockReq({ body: { items: [{ productId: "prd_111", quantity: 1 }] } }),
					mockRes(),
				),
			(err: any) => {
				assert.equal(err.statusCode, 400);
				return true;
			},
		);
	});

	it("throws ZodError when items array is empty", async () => {
		await assert.rejects(
			() =>
				sut.controller.handle(sut.validReq({ body: { items: [] } }), mockRes()),
			(err: any) => err.name === "ZodError",
		);
	});

	it("throws ZodError when body is missing", async () => {
		await assert.rejects(
			() =>
				sut.controller.handle(
					mockReq({ headers: { "idempotency-key": randomUUID() } }),
					mockRes(),
				),
			(err: any) => err.name === "ZodError",
		);
	});

	it("throws ZodError when quantity is not a positive integer", async () => {
		await assert.rejects(
			() =>
				sut.controller.handle(
					sut.validReq({
						body: { items: [{ productId: "prd_111", quantity: -1 }] },
					}),
					mockRes(),
				),
			(err: any) => err.name === "ZodError",
		);
	});

	it("propagates AppError from the usecase", async () => {
		sut.executeFn = async () => {
			throw new AppError("Produto não encontrado", 404);
		};
		await assert.rejects(
			() =>
				sut.controller.handle(
					sut.validReq({
						body: { items: [{ productId: "prd_missing", quantity: 1 }] },
					}),
					mockRes(),
				),
			(err: any) => {
				assert.equal(err.statusCode, 404);
				return true;
			},
		);
	});

	it("works with real use case and in-memory repos", async () => {
		const ctrl = SUT.withRealDeps();
		const res = mockRes();
		await ctrl.handle(
			mockReq({
				body: { items: [{ productId: "prd_real", quantity: 1 }] },
				headers: { "idempotency-key": randomUUID() },
			}),
			res,
		);
		assert.equal(res.statusCode, 202);
		assert.equal(res.data.data.amount, 75);
	});
});
