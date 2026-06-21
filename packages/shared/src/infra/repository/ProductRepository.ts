import { productsTable } from "@casecellshop/db";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { AppError } from "../../application/AppError";
import type { IProductRepository } from "../../application/repositorys/IProductRepository";
import { Product } from "../../domain/Product";
import type { AnyDbClient } from "../db/client";
import { db } from "../db/client";

export class ProductRepository implements IProductRepository {
	async create(product: Product): Promise<void> {
		const props = product.toJSON();
		await db.insert(productsTable).values({
			id: props.id as string,
			name: props.name,
			description: props.description ?? null,
			price: String(props.price),
			stock: props.stock,
			version: props.version,
			createdAt: props.createdAt,
			updatedAt: props.updatedAt,
			deletedAt: props.deletedAt ?? null,
		});
	}

	async findById(id: string): Promise<Product | null> {
		const rows = await db
			.select()
			.from(productsTable)
			.where(eq(productsTable.id, id))
			.limit(1);

		const row = rows[0];
		if (!row) return null;

		return Product.restore({
			id: row.id,
			name: row.name,
			description: row.description ?? undefined,
			price: Number(row.price),
			stock: row.stock,
			version: row.version,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			deletedAt: row.deletedAt ?? null,
		});
	}

	async findByIds(ids: string[]): Promise<Product[]> {
		const rows = await db
			.select()
			.from(productsTable)
			.where(inArray(productsTable.id, ids));

		return rows.map((row) =>
			Product.restore({
				createdAt: row.createdAt,
				deletedAt: row.deletedAt,
				name: row.name,
				price: Number.parseFloat(row.price),
				stock: row.stock,
				updatedAt: row.updatedAt,
				version: row.version,
				description: row.description ?? "",
				id: row.id,
			}),
		);
	}

	async updateStock(product: Product, tx?: AnyDbClient): Promise<void> {
		const client = tx ?? db;
		const props = product.toJSON();
		const previousVersion = props.version - 1;

		const result = await client
			.update(productsTable)
			.set({
				stock: props.stock,
				version: props.version,
				updatedAt: props.updatedAt,
			})
			.where(
				and(
					eq(productsTable.id, props.id as string),
					eq(productsTable.version, previousVersion),
				),
			);

		if (result.rowsAffected === 0) {
			throw new AppError(
				`Conflito de estoque no produto ${props.id} — tente novamente`,
				409,
			);
		}
	}

	async findMany(
		page: number,
		limit: number,
	): Promise<{ items: Product[]; totalItems: number }> {
		const offset = (page - 1) * limit;

		const [rows, [totals]] = await Promise.all([
			db
				.select()
				.from(productsTable)
				.where(isNull(productsTable.deletedAt))
				.limit(limit)
				.offset(offset),
			db
				.select({ total: count() })
				.from(productsTable)
				.where(isNull(productsTable.deletedAt)),
		]);

		const items = rows.map((row) =>
			Product.restore({
				id: row.id,
				name: row.name,
				description: row.description ?? undefined,
				price: Number(row.price),
				stock: row.stock,
				version: row.version,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				deletedAt: row.deletedAt ?? null,
			}),
		);

		return { items, totalItems: totals?.total ?? 0 };
	}
}
