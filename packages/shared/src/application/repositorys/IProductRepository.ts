import type { Product } from "../../domain/Product";

export interface IProductRepository {
	create(product: Product): Promise<void>;
	findById(id: string): Promise<Product | null>;
	findByIds(ids: string[]): Promise<Product[] | null>
	findMany(
		page: number,
		limit: number,
	): Promise<{ items: Product[]; totalItems: number }>;
	updateStock(product: Product, tx?: unknown): Promise<void>;
}
