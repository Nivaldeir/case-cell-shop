import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { CreateProductUsecase } from "@/application/usecase/product/CreateProductUsecase";
import { InMemoryProductRepository } from "../helpers/inMemoryRepositories";

describe("CreateProductUsecase", () => {
	let productRepo: InMemoryProductRepository;
	let usecase: CreateProductUsecase;

	beforeEach(() => {
		productRepo = new InMemoryProductRepository();
		usecase = new CreateProductUsecase(productRepo);
	});

	it("returns a productId with prd_ prefix", async () => {
		const result = await usecase.execute({
			name: "Notebook Pro",
			price: 2999,
			stock: 10,
		});

		assert.ok(result.productId);
		assert.match(result.productId, /^prd_/);
	});

	it("persists the product to the repository", async () => {
		await usecase.execute({ name: "Notebook Pro", price: 2999, stock: 10 });

		assert.equal(productRepo.products.length, 1);
	});

	it("stores the correct product properties", async () => {
		await usecase.execute({
			name: "Smart TV",
			price: 1500,
			stock: 5,
			description: "55 inches 4K",
		});

		const saved = productRepo.products[0]!;
		assert.equal(saved.get("name"), "Smart TV");
		assert.equal(saved.get("price"), 1500);
		assert.equal(saved.get("stock"), 5);
		assert.equal(saved.get("description"), "55 inches 4K");
	});

	it("creates the product with version 1", async () => {
		await usecase.execute({ name: "Tablet", price: 800, stock: 20 });

		const saved = productRepo.products[0]!;
		assert.equal(saved.get("version"), 1);
	});

	it("persists multiple products independently", async () => {
		await usecase.execute({ name: "Product A", price: 10, stock: 1 });
		await usecase.execute({ name: "Product B", price: 20, stock: 2 });

		assert.equal(productRepo.products.length, 2);
	});
});
