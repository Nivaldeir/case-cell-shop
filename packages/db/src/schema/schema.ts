import { integer, numeric, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const productsTable = sqliteTable("products", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	price: text("price").notNull(),
	stock: integer("stock").notNull().default(0),
	version: integer("version").notNull().default(1),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const ordersTable = sqliteTable("orders", {
	id: text("id").primaryKey(),
	total: text("total").notNull(),
	idempotente: text("idempotente").notNull().unique(),
	status: text("status", {
		enum: ["pending", "paid", "shipped", "delivered", "cancelled"],
	})
		.notNull()
		.default("pending"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
	deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
});

export const orderItemsTable = sqliteTable("order_items", {
	id: text("id").primaryKey(),
	orderId: text("order_id")
		.notNull()
		.references(() => ordersTable.id),
	productId: text("product_id").notNull(),
	quantity: integer("quantity").notNull(),
	price: numeric("price").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const paymentTable = sqliteTable("payment", {
	id: text("id").primaryKey(),
	orderId: text("order_id")
		.notNull()
		.references(() => ordersTable.id),
	type: text("type", { enum: ["credit_card", "pix", "boleto"] }).notNull(),
	status: text("status", { enum: ["pending", "paid", "failed", "refunded"] })
		.notNull()
		.default("pending"),
	amount: numeric("amount").notNull(),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const sagaExecutionsTable = sqliteTable("saga_executions", {
	id: text("id").primaryKey(),
	orderId: text("order_id")
		.notNull()
		.references(() => ordersTable.id),
	currentStep: text("current_step", {
		enum: ["reserve_stock", "process_payment"],
	}).notNull(),
	status: text("status", {
		enum: ["pending", "running", "completed", "failed", "compensated"],
	})
		.notNull()
		.default("pending"),
	error: text("error"),
	createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
	updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
