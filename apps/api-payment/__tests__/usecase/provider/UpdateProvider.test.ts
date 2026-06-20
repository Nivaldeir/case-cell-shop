import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IProviderRepository } from "@ledger/shared";
import {
	ProviderCodeAlreadyExists,
	ProviderNotFound,
	ProviderSlugAlreadyExists,
	Providers,
} from "@ledger/shared";
import { UpdateProvider } from "@/application/usecase/Provider/UpdateProvider";

function makeProvider(): Providers {
	return Providers.restore({
		id: "prov_001",
		code: "BANK_A",
		name: "Bank A",
		slug: "bank-a",
		pixIn: false,
		pixOut: false,
		dict: false,
		refund: false,
		status: "active",
		description: "Old desc",
	});
}

function makeRepo(
	provider: Providers | null = makeProvider(),
	overrides: Partial<IProviderRepository> = {},
): IProviderRepository {
	return {
		create: async () => {},
		findById: async () => provider,
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

describe("UpdateProvider — use case", () => {
	it("returns the providerId", async () => {
		const result = await new UpdateProvider(makeRepo()).execute({
			providerId: "prov_001",
			name: "New",
		});
		assert.equal(result.providerId, "prov_001");
	});

	it("throws ProviderNotFound when provider does not exist", async () => {
		await assert.rejects(
			() => new UpdateProvider(makeRepo(null)).execute({ providerId: "ghost" }),
			(e) => e instanceof ProviderNotFound,
		);
	});

	it("throws ProviderCodeAlreadyExists when another provider uses the same code", async () => {
		const repo = makeRepo(makeProvider(), {
			findIdByCodeExcluding: async () => "prov_other",
		});
		await assert.rejects(
			() =>
				new UpdateProvider(repo).execute({
					providerId: "prov_001",
					code: "TAKEN",
				}),
			(e) => e instanceof ProviderCodeAlreadyExists,
		);
	});

	it("throws ProviderSlugAlreadyExists when another provider uses the same slug", async () => {
		const repo = makeRepo(makeProvider(), {
			findIdBySlugExcluding: async () => "prov_other",
		});
		await assert.rejects(
			() =>
				new UpdateProvider(repo).execute({
					providerId: "prov_001",
					slug: "taken-slug",
				}),
			(e) => e instanceof ProviderSlugAlreadyExists,
		);
	});

	it("updates code when it is unique", async () => {
		let saved: any;
		const repo = makeRepo(makeProvider(), {
			update: async (p) => {
				saved = p;
			},
		});
		await new UpdateProvider(repo).execute({
			providerId: "prov_001",
			code: "NEW_CODE",
		});
		assert.equal(saved.get("code"), "NEW_CODE");
	});

	it("updates slug when it is unique", async () => {
		let saved: any;
		const repo = makeRepo(makeProvider(), {
			update: async (p) => {
				saved = p;
			},
		});
		await new UpdateProvider(repo).execute({
			providerId: "prov_001",
			slug: "new-slug",
		});
		assert.equal(saved.get("slug"), "new-slug");
	});

	it("updates name, description and boolean flags", async () => {
		let saved: any;
		const repo = makeRepo(makeProvider(), {
			update: async (p) => {
				saved = p;
			},
		});
		await new UpdateProvider(repo).execute({
			providerId: "prov_001",
			name: "New Name",
			description: "New desc",
			pixIn: true,
			refund: true,
		});
		assert.equal(saved.get("name"), "New Name");
		assert.equal(saved.get("description"), "New desc");
		assert.equal(saved.get("pixIn"), true);
		assert.equal(saved.get("refund"), true);
	});

	it("does not overwrite code/slug when they are undefined", async () => {
		let saved: any;
		const repo = makeRepo(makeProvider(), {
			update: async (p) => {
				saved = p;
			},
		});
		await new UpdateProvider(repo).execute({
			providerId: "prov_001",
			name: "Only Name",
		});
		assert.equal(saved.get("code"), "BANK_A"); // unchanged
		assert.equal(saved.get("slug"), "bank-a"); // unchanged
	});

	it("updates status to deactivated", async () => {
		let saved: any;
		const repo = makeRepo(makeProvider(), {
			update: async (p) => {
				saved = p;
			},
		});
		await new UpdateProvider(repo).execute({
			providerId: "prov_001",
			status: "deactivated",
		});
		assert.equal(saved.get("status"), "deactivated");
	});

	it("passes providerId to findIdByCodeExcluding for self-exclusion check", async () => {
		let excludedId: string | undefined;
		const repo = makeRepo(makeProvider(), {
			findIdByCodeExcluding: async (_c, id) => {
				excludedId = id;
				return null;
			},
		});
		await new UpdateProvider(repo).execute({
			providerId: "prov_001",
			code: "NEW",
		});
		assert.equal(excludedId, "prov_001");
	});
});
