import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { Product } from "@casecellshop/shared";
import { FindManyProductUsecase } from "@/application/usecase/product/FindManyProductUsecase";
import { InMemoryProductRepository } from "../helpers/inMemoryRepositories";

function makeProductFixture(name: string, price = 100) {
	return Product.create({
		name,
		price,
		stock: 10,
		version: 1,
		deletedAt: null,
	});
}

describe("FindManyProductUsecase", () => {
	let productRepo: InMemoryProductRepository;
	let usecase: FindManyProductUsecase;

	beforeEach(() => {
		productRepo = new InMemoryProductRepository();
		usecase = new FindManyProductUsecase(productRepo);
	});

	it("returns items and pagination metadata", async () => {
		productRepo.products.push(makeProductFixture("Produto A"));
		productRepo.products.push(makeProductFixture("Produto B"));

		const result = await usecase.execute({ page: 1, limit: 10 });

		assert.equal(result.items.length, 2);
		assert.equal(result.pagination.totalItems, 2);
		assert.equal(result.pagination.page, 1);
		assert.equal(result.pagination.limit, 10);
	});

	it("returns empty items when no products exist", async () => {
		const result = await usecase.execute({ page: 1, limit: 10 });

		assert.equal(result.items.length, 0);
		assert.equal(result.pagination.totalItems, 0);
		assert.equal(result.pagination.totalPages, 1);
	});

	it("sets hasNextPage to true when there are more pages", async () => {
		for (let i = 0; i < 15; i++) {
			productRepo.products.push(makeProductFixture(`Produto ${i}`));
		}

		const result = await usecase.execute({ page: 1, limit: 10 });

		assert.equal(result.pagination.hasNextPage, true);
		assert.equal(result.pagination.hasPreviousPage, false);
	});

	it("sets hasPreviousPage to true when page > 1", async () => {
		for (let i = 0; i < 15; i++) {
			productRepo.products.push(makeProductFixture(`Produto ${i}`));
		}

		const result = await usecase.execute({ page: 2, limit: 10 });

		assert.equal(result.pagination.hasPreviousPage, true);
		assert.equal(result.pagination.hasNextPage, false);
	});

	it("calculates correct totalPages", async () => {
		for (let i = 0; i < 25; i++) {
			productRepo.products.push(makeProductFixture(`Produto ${i}`));
		}

		const result = await usecase.execute({ page: 1, limit: 10 });

		assert.equal(result.pagination.totalPages, 3);
	});

	it("excludes soft-deleted products", async () => {
		const active = makeProductFixture("Produto Ativo");
		const deleted = makeProductFixture("Produto Deletado");
		deleted.desatived();

		productRepo.products.push(active, deleted);

		const result = await usecase.execute({ page: 1, limit: 10 });

		assert.equal(result.items.length, 1);
		assert.equal(result.pagination.totalItems, 1);
	});

	it("respects limit for pagination", async () => {
		for (let i = 0; i < 5; i++) {
			productRepo.products.push(makeProductFixture(`Produto ${i}`));
		}

		const result = await usecase.execute({ page: 1, limit: 3 });

		assert.equal(result.items.length, 3);
		assert.equal(result.pagination.totalItems, 5);
		assert.equal(result.pagination.totalPages, 2);
	});
});
