import type { SagaStatus } from "@casecellshop/shared";
import {
	AppError,
	type IOrderRepository,
	type IProductRepository,
	type ISagaRepository,
	type Order,
	type Product,
	type SagaStepName,
} from "@casecellshop/shared";

export class InMemoryProductRepository implements IProductRepository {
	public products: Product[] = [];
	public updateCallCount = 0;
	private _failNextN = 0;
	private _failWith: AppError = new AppError("conflict", 409);

	failNextNUpdates(n: number, err = new AppError("conflict", 409)) {
		this._failNextN = n;
		this._failWith = err;
	}

	async create(product: Product): Promise<void> {
		this.products.push(product);
	}

	async findById(id: string): Promise<Product | null> {
		return this.products.find((p) => p.get("id") === id) ?? null;
	}

	async findByIds(ids: string[]): Promise<Product[] | null> {
		return this.products.filter((p) => ids.includes(p.get("id") ?? ""));
	}

	async findMany(): Promise<{ items: Product[]; totalItems: number }> {
		return { items: this.products, totalItems: this.products.length };
	}

	async updateStock(product: Product): Promise<void> {
		this.updateCallCount++;
		if (this._failNextN > 0) {
			this._failNextN--;
			throw this._failWith;
		}
		const idx = this.products.findIndex(
			(p) => p.get("id") === product.get("id"),
		);
		if (idx !== -1) this.products[idx] = product;
	}
}

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

export class InMemorySagaRepository implements ISagaRepository {
	public sagas: Array<{
		id: string;
		orderId: string;
		currentStep: SagaStepName;
		status?: SagaStatus;
		error?: string;
	}> = [];
	public updates: Array<{
		id: string;
		data: Parameters<ISagaRepository["update"]>[1];
	}> = [];

	async create(data: {
		id: string;
		orderId: string;
		currentStep: SagaStepName;
	}): Promise<void> {
		this.sagas.push({ ...data });
	}

	async update(
		id: string,
		data: Parameters<ISagaRepository["update"]>[1],
	): Promise<void> {
		this.updates.push({ id, data });
		const saga = this.sagas.find((s) => s.id === id);
		if (saga) Object.assign(saga, data);
	}
}
