import type { SagaStatus } from "@casecellshop/shared";
import {
	type IOrderRepository,
	type IPaymentRepository,
	type ISagaRepository,
	type Order,
	type Payment,
	QueueAdapter,
	type QueueMessage,
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

	async findByIdempotencyKey(): Promise<Order | null> {
		return null;
	}

	async findMany(): Promise<{ items: Order[]; totalItems: number }> {
		return { items: this.orders, totalItems: this.orders.length };
	}

	async updateStatus(order: Order): Promise<void> {
		const idx = this.orders.findIndex((o) => o.get("id") === order.get("id"));
		if (idx !== -1) this.orders[idx] = order;
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
	public updates: Array<{
		id: string;
		data: Parameters<ISagaRepository["update"]>[1];
	}> = [];

	async create(): Promise<void> {}

	async update(
		id: string,
		data: Parameters<ISagaRepository["update"]>[1],
	): Promise<void> {
		this.updates.push({ id, data });
	}
}

export class MockQueueAdapter extends QueueAdapter {
	public published: Array<{ queue: SagaStepName; message: unknown }> = [];

	async connect(): Promise<void> {}
	async disconnect(): Promise<void> {}
	isConnected(): boolean {
		return true;
	}

	async publish<T>(queueName: SagaStepName, message: T): Promise<string> {
		this.published.push({ queue: queueName, message });
		return "mock-id";
	}

	async publishBatch<T>(
		queueName: SagaStepName,
		messages: T[],
	): Promise<string[]> {
		for (const m of messages)
			this.published.push({ queue: queueName, message: m });
		return messages.map(() => "mock-id");
	}

	async ack(_msg: QueueMessage): Promise<void> {}
}
