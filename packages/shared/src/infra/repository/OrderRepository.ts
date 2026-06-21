import { randomUUID } from "node:crypto";
import { orderItemsTable, ordersTable } from "@casecellshop/db";
import { count, eq, inArray, isNull } from "drizzle-orm";
import type { IOrderRepository } from "../../application/repositorys/IOrderRepository";
import { OrdemItem } from "../../domain/OrdemItem";
import { Order } from "../../domain/Order";

import { type AnyDbClient, db, runInTransaction } from "../db/client";
import { RedisAdapter } from "../redis";

export class OrderRepository implements IOrderRepository {
	private redis = RedisAdapter.getClient();

	private key(...parts: string[]) {
		return ["order", ...parts].join(":");
	}
	private toOrderItem(item: typeof orderItemsTable.$inferSelect): OrdemItem {
		return OrdemItem.restore({
			id: item.id,
			productId: item.productId,
			quantity: item.quantity,
			price: Number(item.price),
		});
	}

	private toOrder(
		orderRow: typeof ordersTable.$inferSelect,
		items: (typeof orderItemsTable.$inferSelect)[],
	): Order {
		return Order.restore({
			id: orderRow.id,
			idempotencyKey: orderRow.idempotente,
			amount: Number(orderRow.total),
			status: orderRow.status,
			ordemItems: items.map((item) => this.toOrderItem(item)),
			createdAt: orderRow.createdAt,
			updatedAt: orderRow.updatedAt,
		});
	}

	async create(order: Order, clientDB?: AnyDbClient): Promise<void> {
		const props = order.toJSON();

		const execute = async (tx: AnyDbClient) => {
			await tx.insert(ordersTable).values({
				id: props.id,
				idempotente: props.idempotencyKey,
				total: String(props.amount),
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

		await runInTransaction(db, execute);
	}

	async findById(id: string): Promise<Order | null> {
		const cacheKey = this.key(id);

		const cached = await this.redis.get(cacheKey);

		if (cached) {
			const parsed = JSON.parse(cached);
			return Order.restore({
				...parsed,
				ordemItems: parsed.ordemItems.map((item: any) =>
					OrdemItem.restore(item),
				),
				createdAt: new Date(parsed.createdAt),
				updatedAt: new Date(parsed.updatedAt),
			});
		}

		const [orderRow] = await db
			.select()
			.from(ordersTable)
			.where(eq(ordersTable.id, id))
			.limit(1);

		if (!orderRow) {
			return null;
		}

		const items = await db
			.select()
			.from(orderItemsTable)
			.where(eq(orderItemsTable.orderId, id));

		const order = this.toOrder(orderRow, items);

		await this.redis.set(cacheKey, JSON.stringify(order.toJSON()));

		return order;
	}

	async findByIdempotencyKey(key: string): Promise<Order | null> {
		const cacheKey = this.key("idem", key);

		const cached = await this.redis.get(cacheKey);

		if (cached) {
			const parsed = JSON.parse(cached);
			return Order.restore({
				...parsed,
				ordemItems: parsed.ordemItems.map((item: any) =>
					OrdemItem.restore(item),
				),
				createdAt: new Date(parsed.createdAt),
				updatedAt: new Date(parsed.updatedAt),
			});
		}

		const [orderRow] = await db
			.select()
			.from(ordersTable)
			.where(eq(ordersTable.idempotente, key))
			.limit(1);

		if (!orderRow) return null;

		const items = await db
			.select()
			.from(orderItemsTable)
			.where(eq(orderItemsTable.orderId, orderRow.id));

		const order = this.toOrder(orderRow, items);

		await this.redis.set(cacheKey, JSON.stringify(order.toJSON()));

		return order;
	}

	async updateStatus(order: Order): Promise<void> {
		const props = order.toJSON();
		await db
			.update(ordersTable)
			.set({ status: props.status, updatedAt: props.updatedAt })
			.where(eq(ordersTable.id, props.id));

		await this.redis.del(this.key(props.id));
	}

	async findMany(
		page: number,
		limit: number,
	): Promise<{ items: Order[]; totalItems: number }> {
		const offset = (page - 1) * limit;

		const [orderRows, [totalResult]] = await Promise.all([
			db
				.select()
				.from(ordersTable)
				.where(isNull(ordersTable.deletedAt))
				.limit(limit)
				.offset(offset),

			db
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

		const allItems = await db
			.select()
			.from(orderItemsTable)
			.where(inArray(orderItemsTable.orderId, orderIds));

		const itemsByOrderId = new Map<
			string,
			(typeof orderItemsTable.$inferSelect)[]
		>();

		for (const item of allItems) {
			const items = itemsByOrderId.get(item.orderId) ?? [];
			items.push(item);
			itemsByOrderId.set(item.orderId, items);
		}

		const orders = orderRows.map((orderRow) =>
			this.toOrder(orderRow, itemsByOrderId.get(orderRow.id) ?? []),
		);

		return {
			items: orders,
			totalItems: totalResult?.total ?? 0,
		};
	}
}
