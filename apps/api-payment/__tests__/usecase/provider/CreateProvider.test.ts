import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IProviderRepository } from "@ledger/shared";
import {
	ProviderCodeAlreadyExists,
	ProviderSlugAlreadyExists,
} from "@ledger/shared";
import { CreateProvider } from "@/application/usecase/Provider/CreateProvider";

// ── Mock factory ─────────────────────────────────────────────────────────────
function makeRepo(
	overrides: Partial<IProviderRepository> = {},
): IProviderRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByIds: async () => [],
		findIdByCode: async () => null,
		findIdBySlug: async () => null,
		findIdByCodeExcluding: async () => null,
		findIdBySlugExcluding: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		...overrides,
	};
}

const baseInput = {
	code: "BANK_A",
	name: "Bank A",
	slug: "bank-a",
	description: "A test bank",
};

describe("CreateProvider — use case", () => {
	it("creates a provider and returns its ID with 'prov_' prefix", async () => {
		const repo = makeRepo();
		const useCase = new CreateProvider(repo);
		const output = await useCase.execute(baseInput);
		assert.match(output.providerId, /^prov_/);
	});

	it("trims whitespace from code, slug, name and description", async () => {
		let captured: any;
		const repo = makeRepo({
			create: async (p) => {
				captured = p;
			},
		});
		const useCase = new CreateProvider(repo);
		await useCase.execute({
			code: "  BANK_B  ",
			name: "  Bank B  ",
			slug: "  bank-b  ",
			description: "  desc  ",
		});
		assert.equal(captured.get("code"), "BANK_B");
		assert.equal(captured.get("slug"), "bank-b");
		assert.equal(captured.get("name"), "Bank B");
		assert.equal(captured.get("description"), "desc");
	});

	it("defaults pixIn, pixOut, dict, refund to false when not provided", async () => {
		let captured: any;
		const repo = makeRepo({
			create: async (p) => {
				captured = p;
			},
		});
		await new CreateProvider(repo).execute(baseInput);
		assert.equal(captured.get("pixIn"), false);
		assert.equal(captured.get("pixOut"), false);
		assert.equal(captured.get("dict"), false);
		assert.equal(captured.get("refund"), false);
	});

	it("defaults status to 'active' when not provided", async () => {
		let captured: any;
		const repo = makeRepo({
			create: async (p) => {
				captured = p;
			},
		});
		await new CreateProvider(repo).execute(baseInput);
		assert.equal(captured.get("status"), "active");
	});

	it("respects explicit capability flags when provided", async () => {
		let captured: any;
		const repo = makeRepo({
			create: async (p) => {
				captured = p;
			},
		});
		await new CreateProvider(repo).execute({
			...baseInput,
			pixIn: true,
			pixOut: true,
			dict: true,
			refund: true,
			status: "deactivated",
		});
		assert.equal(captured.get("pixIn"), true);
		assert.equal(captured.get("pixOut"), true);
		assert.equal(captured.get("dict"), true);
		assert.equal(captured.get("refund"), true);
		assert.equal(captured.get("status"), "deactivated");
	});

	it("throws ProviderCodeAlreadyExists when code is already taken", async () => {
		const repo = makeRepo({
			findIdByCode: async () => "prov_existing",
		});
		await assert.rejects(
			() => new CreateProvider(repo).execute(baseInput),
			(err) => {
				assert.ok(err instanceof ProviderCodeAlreadyExists);
				assert.equal((err as ProviderCodeAlreadyExists).statusCode, 409);
				return true;
			},
		);
	});

	it("throws ProviderSlugAlreadyExists when slug is already taken", async () => {
		const repo = makeRepo({
			findIdByCode: async () => null,
			findIdBySlug: async () => "prov_existing",
		});
		await assert.rejects(
			() => new CreateProvider(repo).execute(baseInput),
			(err) => err instanceof ProviderSlugAlreadyExists,
		);
	});

	it("checks the trimmed code/slug against existing records", async () => {
		let codeChecked: string | undefined;
		let slugChecked: string | undefined;
		const repo = makeRepo({
			findIdByCode: async (c) => {
				codeChecked = c;
				return null;
			},
			findIdBySlug: async (s) => {
				slugChecked = s;
				return null;
			},
		});
		await new CreateProvider(repo).execute({
			...baseInput,
			code: " CODE ",
			slug: " slug ",
		});
		assert.equal(codeChecked, "CODE");
		assert.equal(slugChecked, "slug");
	});
});
