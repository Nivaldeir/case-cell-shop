import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { CreateOrderUsecase } from "@/application/usecase/order/CreateOrderUsecase";
import { GetOrderStatusUsecase } from "@/application/usecase/order/GetOrderStatusUsecase";
import { CreateProductUsecase } from "@/application/usecase/product/CreateProductUsecase";
import { FindManyProductUsecase } from "@/application/usecase/product/FindManyProductUsecase";
import { CreateOrderController } from "@/presentation/api/controllers/order/CreateOrderController";
import { GetOrderStatusController } from "@/presentation/api/controllers/order/GetOrderStatusController";
import { CreateProductController } from "@/presentation/api/controllers/product/CreateProductController";
import { FindManyProductController } from "@/presentation/api/controllers/product/FindManyProductController";
import { createTestServer } from "../helpers/createTestServer";
import {
	InMemoryOrderRepository,
	InMemoryPaymentRepository,
	InMemoryProductRepository,
	InMemorySagaRepository,
	MockQueueAdapter,
} from "../helpers/inMemoryRepositories";

function buildApp() {
	const orderRepo = new InMemoryOrderRepository();
	const productRepo = new InMemoryProductRepository();
	const paymentRepo = new InMemoryPaymentRepository();
	const sagaRepo = new InMemorySagaRepository();
	const queue = new MockQueueAdapter();

	const createOrderUsecase = new CreateOrderUsecase(
		orderRepo,
		productRepo,
		sagaRepo,
		queue,
	);
	const getOrderStatusUsecase = new GetOrderStatusUsecase(
		orderRepo,
		paymentRepo,
	);
	const createProductUsecase = new CreateProductUsecase(productRepo);
	const findManyProductUsecase = new FindManyProductUsecase(productRepo);

	const controllers = [
		new CreateOrderController(createOrderUsecase),
		new GetOrderStatusController(getOrderStatusUsecase),
		new CreateProductController(createProductUsecase),
		new FindManyProductController(findManyProductUsecase),
	];

	return {
		controllers,
		repos: { orderRepo, productRepo, paymentRepo, sagaRepo, queue },
	};
}

describe("E2E: Product endpoints", () => {
	let url: string;
	let close: () => Promise<void>;

	before(async () => {
		const { controllers } = buildApp();
		const server = await createTestServer(controllers);
		url = server.url;
		close = server.close;
	});

	after(() => close());

	it("POST /api/v1/product — creates a product and returns 201", async () => {
		const res = await fetch(`${url}/api/v1/product`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Smart Watch", price: 499.99, stock: 30 }),
		});

		assert.equal(res.status, 201);
		const body = (await res.json()) as any;
		assert.equal(body.error, false);
		assert.match(body.data.productId, /^prd_/);
	});

	it("POST /api/v1/product — returns 400 with validation error for short name", async () => {
		const res = await fetch(`${url}/api/v1/product`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "AB", price: 100, stock: 1 }),
		});

		assert.equal(res.status, 400);
		const body = (await res.json()) as any;
		assert.equal(body.error, true);
	});

	it("POST /api/v1/product — returns 400 when price is missing", async () => {
		const res = await fetch(`${url}/api/v1/product`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Valid Name", stock: 5 }),
		});

		assert.equal(res.status, 400);
	});

	it("GET /api/v1/product — returns items array and pagination", async () => {
		const res = await fetch(`${url}/api/v1/product`);

		assert.equal(res.status, 202);
		const body = (await res.json()) as any;
		assert.equal(body.error, false);
		assert.ok(Array.isArray(body.data));
		assert.ok(body.pagination);
		assert.ok("totalItems" in body.pagination);
		assert.ok("page" in body.pagination);
	});

	it("GET /api/v1/product — lists created products", async () => {
		await fetch(`${url}/api/v1/product`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: "Notebook", price: 2500, stock: 5 }),
		});

		const res = await fetch(`${url}/api/v1/product`);
		const body = (await res.json()) as any;

		assert.ok(body.data.length >= 1);
	});

	it("GET /api/v1/product — respects limit query param", async () => {
		const res = await fetch(`${url}/api/v1/product?page=1&limit=5`);
		const body = (await res.json()) as any;
		assert.equal(body.pagination.limit, 5);
	});

	it("GET /api/v1/product — returns 400 when limit exceeds 100", async () => {
		const res = await fetch(`${url}/api/v1/product?limit=999`);
		assert.equal(res.status, 400);
	});
});

describe("E2E: Order endpoints", () => {
	let url: string;
	let close: () => Promise<void>;
	let repos: ReturnType<typeof buildApp>["repos"];
	let createdProductId: string;

	before(async () => {
		const app = buildApp();
		repos = app.repos;
		const server = await createTestServer(app.controllers);
		url = server.url;
		close = server.close;

		// Create a product to use in order tests
		const res = await fetch(`${url}/api/v1/product`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Order Item Product",
				price: 150,
				stock: 100,
			}),
		});
		const body = (await res.json()) as any;
		createdProductId = body.data.productId;
	});

	after(() => close());

	it("POST /api/v1/checkout — creates an order and returns 202", async () => {
		const res = await fetch(`${url}/api/v1/checkout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"idempotency-key": randomUUID(),
			},
			body: JSON.stringify({
				items: [{ productId: createdProductId, quantity: 2 }],
			}),
		});

		assert.equal(res.status, 202);
		const body = (await res.json()) as any;
		assert.equal(body.error, false);
		assert.match(body.data.id, /^ord_/);
		assert.equal(body.data.status, "pending");
	});

	it("POST /api/v1/checkout — computes amount correctly", async () => {
		const res = await fetch(`${url}/api/v1/checkout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"idempotency-key": randomUUID(),
			},
			body: JSON.stringify({
				items: [{ productId: createdProductId, quantity: 3 }],
			}),
		});

		const body = (await res.json()) as any;
		assert.equal(body.data.amount, 450); // 150 * 3
	});

	it("POST /api/v1/checkout — publishes to the saga queue", async () => {
		await fetch(`${url}/api/v1/checkout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"idempotency-key": randomUUID(),
			},
			body: JSON.stringify({
				items: [{ productId: createdProductId, quantity: 1 }],
			}),
		});

		assert.ok(repos.queue.published.length >= 1);
	});

	it("POST /api/v1/checkout — returns 404 when product does not exist", async () => {
		const res = await fetch(`${url}/api/v1/checkout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"idempotency-key": randomUUID(),
			},
			body: JSON.stringify({
				items: [{ productId: "prd_doesnotexist", quantity: 1 }],
			}),
		});

		assert.equal(res.status, 404);
		const body = (await res.json()) as any;
		assert.equal(body.error, true);
	});

	it("POST /api/v1/checkout — returns 400 when items array is empty", async () => {
		const res = await fetch(`${url}/api/v1/checkout`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ items: [] }),
		});

		assert.equal(res.status, 400);
	});

	it("GET /api/v1/checkout/:orderId/status — returns order status", async () => {
		const createRes = await fetch(`${url}/api/v1/checkout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"idempotency-key": randomUUID(),
			},
			body: JSON.stringify({
				items: [{ productId: createdProductId, quantity: 1 }],
			}),
		});
		const createBody = (await createRes.json()) as any;
		const orderId = createBody.data.id;

		const statusRes = await fetch(`${url}/api/v1/checkout/${orderId}/status`);
		assert.equal(statusRes.status, 202);

		const statusBody = (await statusRes.json()) as any;
		assert.equal(statusBody.error, false);
		assert.equal(statusBody.data.orderId, orderId);
		assert.equal(statusBody.data.status, "pending");
		assert.equal(statusBody.data.payment, null);
	});

	it("GET /api/v1/checkout/:orderId/status — returns 404 for unknown order", async () => {
		const res = await fetch(`${url}/api/v1/checkout/ord_unknown123/status`);
		assert.equal(res.status, 404);

		const body = (await res.json()) as any;
		assert.equal(body.error, true);
	});

	it("Full flow: create product → create order → check status", async () => {
		// Create product
		const productRes = await fetch(`${url}/api/v1/product`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				name: "Full Flow Product",
				price: 200,
				stock: 50,
			}),
		});
		const {
			data: { productId },
		} = (await productRes.json()) as any;

		// Create order
		const orderRes = await fetch(`${url}/api/v1/checkout`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"idempotency-key": randomUUID(),
			},
			body: JSON.stringify({ items: [{ productId, quantity: 2 }] }),
		});
		const { data: order } = (await orderRes.json()) as any;

		assert.equal(order.amount, 400);
		assert.equal(order.status, "pending");

		// Check status
		const statusRes = await fetch(`${url}/api/v1/checkout/${order.id}/status`);
		const { data: status } = (await statusRes.json()) as any;

		assert.equal(status.orderId, order.id);
		assert.equal(status.items.length, 1);
		assert.equal(status.items[0].productId, productId);
		assert.equal(status.payment, null);
	});
});
