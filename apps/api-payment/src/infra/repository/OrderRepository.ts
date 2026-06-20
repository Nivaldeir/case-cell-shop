import { randomUUID } from "crypto";
import { count, eq, inArray, isNull } from "drizzle-orm";

import {
	Order,
	OrdemItem,
	type IOrderRepository,
} from "@ledger/shared";

import {
	ordersTable,
	orderItemsTable,
} from "@ledger/db";

import {
	type AnyDbClient,
	runInTransaction,
} from "../db/client";

export class OrderRepository implements IOrderRepository {
	constructor(private readonly db: AnyDbClient) {}

	private toOrderItem(
		item: typeof orderItemsTable.$inferSelect,
	): OrdemItem {
		return OrdemItem.restore({
			id: item.id,
			productId: item.productId,
			quantity: item.quantity,
			price: Number(item.price),
		});
	}

	private toOrder(
		orderRow: typeof ordersTable.$inferSelect,
		items: typeof orderItemsTable.$inferSelect[],
	): Order {
		return Order.restore({
			id: orderRow.id,
			total: Number(orderRow.total),
			status: orderRow.status,
			ordemItems: items.map((item) => this.toOrderItem(item)),
			createdAt: orderRow.createdAt,
			updatedAt: orderRow.updatedAt,
		});
	}

	async create(
		order: Order,
		clientDB?: AnyDbClient,
	): Promise<void> {
		const props = order.toJSON();

		const execute = async (tx: AnyDbClient) => {
			await tx.insert(ordersTable).values({
				id: props.id,
				total: String(props.total),
				status: props.status,
				createdAt: props.createdAt,
				updatedAt: props.updatedAt,
			});

			const orderItems = props.ordemItems.map((item) => ({
				id: randomUUID(),
				orderId: props.id,
				productId: item.get("productId"),
				quantity: item.get("quantity"),
				price: String(item.get("price")),
				createdAt: new Date(),
			}));

			if (orderItems.length > 0) {
				await tx.insert(orderItemsTable).values(orderItems);
			}
		};

		if (clientDB) {
			await execute(clientDB);
			return;
		}

		await runInTransaction(execute);
	}

	async findById(id: string): Promise<Order | null> {
		const [orderRow] = await this.db
			.select()
			.from(ordersTable)
			.where(eq(ordersTable.id, id))
			.limit(1);

		if (!orderRow) {
			return null;
		}

		const items = await this.db
			.select()
			.from(orderItemsTable)
			.where(eq(orderItemsTable.orderId, id));

		return this.toOrder(orderRow, items);
	}

	async updateStatus(order: Order): Promise<void> {
		const props = order.toJSON();
		await this.db
			.update(ordersTable)
			.set({ status: props.status, updatedAt: props.updatedAt })
			.where(eq(ordersTable.id, props.id));
	}

	async findMany(
		page: number,
		limit: number,
	): Promise<{ items: Order[]; totalItems: number }> {
		const offset = (page - 1) * limit;

		const [orderRows, [totalResult]] = await Promise.all([
			this.db
				.select()
				.from(ordersTable)
				.where(isNull(ordersTable.deletedAt))
				.limit(limit)
				.offset(offset),

			this.db
				.select({
					total: count(),
				})
				.from(ordersTable)
				.where(isNull(ordersTable.deletedAt)),
		]);

		if (orderRows.length === 0) {
			return {
				items: [],
				totalItems: totalResult?.total ?? 0,
			};
		}

		const orderIds = orderRows.map((order) => order.id);

		const allItems = await this.db
			.select()
			.from(orderItemsTable)
			.where(inArray(orderItemsTable.orderId, orderIds));

		const itemsByOrderId = new Map<
			string,
			typeof orderItemsTable.$inferSelect[]
		>();

		for (const item of allItems) {
			const items = itemsByOrderId.get(item.orderId) ?? [];
			items.push(item);
			itemsByOrderId.set(item.orderId, items);
		}

		const orders = orderRows.map((orderRow) =>
			this.toOrder(
				orderRow,
				itemsByOrderId.get(orderRow.id) ?? [],
			),
		);

		return {
			items: orders,
			totalItems: totalResult?.total ?? 0,
		};
	}
}