import { Product } from "@ledger/shared";
import type { IProductRepository } from "@ledger/shared";

type Input = {
	name: string;
	price: number;
	stock: number;
	description?: string;
};

type Output = {
	productId: string;
};

export class CreateProduct {
	constructor(private readonly productRepository: IProductRepository) {}

	async execute(props: Input): Promise<Output> {
		const product = Product.create({
			name: props.name,
			price: props.price,
			stock: props.stock,
			version: 1,
			description: props.description,
			deletedAt: null,
		});

		await this.productRepository.create(product);

		return { productId: product.get("id") };
	}
}
