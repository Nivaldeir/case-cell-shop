import type { Order } from "../../domain/Order";

export interface IOrderRepository {
	create(order: Order, tx?: any): Promise<void>;
	findById(id: string): Promise<Order | null>;
	findMany(
		page: number,
		limit: number,
	): Promise<{ items: Order[]; totalItems: number }>;
	updateStatus(order: Order): Promise<void>;
}
