import type {
	IOrderRepository,
	IPaymentRepository,
	IProductRepository,
	ISagaRepository,
	QueueMessage,
} from "@casecellshop/shared";
import {
	type Order,
	type Payment,
	type Product,
	QueueAdapter,
	type SagaStepName,
} from "@casecellshop/shared";

export class InMemoryOrderRepository implements IOrderRepository {
	public orders: Order[] = [];

	async create(order: Order): Promise<void> {
		this.orders.push(order);
	}

	async findById(id: string): Promise<Order | null> {
		return this.orders.find((o) => o.get("id") === id) ?? null;
	}

	async findMany(
		page: number,
		limit: number,
	): Promise<{ items: Order[]; totalItems: number }> {
		const offset = (page - 1) * limit;
		const items = this.orders.slice(offset, offset + limit);
		return { items, totalItems: this.orders.length };
	}

	async findByIdempotencyKey(key: string): Promise<Order | null> {
		return this.orders.find((o) => o.get("idempotencyKey") === key) ?? null;
	}

	async updateStatus(order: Order): Promise<void> {
		const idx = this.orders.findIndex((o) => o.get("id") === order.get("id"));
		if (idx !== -1) this.orders[idx] = order;
	}
}

export class InMemoryProductRepository implements IProductRepository {
	public products: Product[] = [];

	async create(product: Product): Promise<void> {
		this.products.push(product);
	}

	async findById(id: string): Promise<Product | null> {
		return this.products.find((p) => p.get("id") === id) ?? null;
	}

	async findByIds(ids: string[]): Promise<Product[] | null> {
		return this.products.filter((p) => ids.includes(p.get("id") ?? ""));
	}

	async findMany(
		page: number,
		limit: number,
	): Promise<{ items: Product[]; totalItems: number }> {
		const active = this.products.filter((p) => !p.get("deletedAt"));
		const offset = (page - 1) * limit;
		const items = active.slice(offset, offset + limit);
		return { items, totalItems: active.length };
	}

	async updateStock(product: Product): Promise<void> {
		const idx = this.products.findIndex(
			(p) => p.get("id") === product.get("id"),
		);
		if (idx !== -1) this.products[idx] = product;
	}
}

export class InMemoryPaymentRepository implements IPaymentRepository {
	public payments: Payment[] = [];

	async create(payment: Payment): Promise<void> {
		this.payments.push(payment);
	}

	async findByOrderId(orderId: string): Promise<Payment | null> {
		return this.payments.find((p) => p.get("orderId") === orderId) ?? null;
	}

	async updateStatus(payment: Payment): Promise<void> {
		const idx = this.payments.findIndex(
			(p) => p.get("id") === payment.get("id"),
		);
		if (idx !== -1) this.payments[idx] = payment;
	}
}

export class InMemorySagaRepository implements ISagaRepository {
	public sagas: Array<{
		id: string;
		orderId: string;
		currentStep: SagaStepName;
		status?: string;
		error?: string;
	}> = [];

	async create(data: {
		id: string;
		orderId: string;
		currentStep: SagaStepName;
	}): Promise<void> {
		this.sagas.push({ ...data, status: "pending" });
	}

	async update(
		id: string,
		data: { currentStep?: SagaStepName; status: any; error?: string },
	): Promise<void> {
		const saga = this.sagas.find((s) => s.id === id);
		if (saga) Object.assign(saga, data);
	}
}

export class MockQueueAdapter extends QueueAdapter {
	public published: Array<{ queue: SagaStepName; message: unknown }> = [];
	private _connected = false;

	async connect(): Promise<void> {
		this._connected = true;
	}
	async disconnect(): Promise<void> {
		this._connected = false;
	}
	isConnected(): boolean {
		return this._connected;
	}

	async publish<T>(queueName: SagaStepName, message: T): Promise<string> {
		this.published.push({ queue: queueName, message });
		return "mock-msg-id";
	}

	async publishBatch<T>(
		queueName: SagaStepName,
		messages: T[],
	): Promise<string[]> {
		for (const message of messages) {
			this.published.push({ queue: queueName, message });
		}
		return messages.map(() => "mock-msg-id");
	}

	async publishV2<T>(queueName: SagaStepName, message: T): Promise<string> {
		return this.publish(queueName, message);
	}

	async ack(_message: QueueMessage): Promise<void> {}
}
