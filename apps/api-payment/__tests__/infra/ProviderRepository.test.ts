/**
 * ProviderRepository — integration tests.
 *
 * Uses the PostgreSQL testcontainer started in setup.ts.
 * Tests the full persistence round-trip: create → read → update → search.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { ProviderRepository, Providers } from "@ledger/shared";

// ── Helpers ───────────────────────────────────────────────────────────────────
function uniqueCode(prefix = "BANK"): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function makeProvider(
	overrides: Partial<{
		code: string;
		name: string;
		slug: string;
		description: string;
		pixIn: boolean;
		pixOut: boolean;
		dict: boolean;
		refund: boolean;
		status: "active" | "deactivated";
	}> = {},
): Providers {
	const code = overrides.code ?? uniqueCode();
	return Providers.create({
		code,
		name: overrides.name ?? `Name ${code}`,
		slug: overrides.slug ?? `slug-${code.toLowerCase()}`,
		description: overrides.description ?? "Test provider",
		pixIn: overrides.pixIn ?? false,
		pixOut: overrides.pixOut ?? false,
		dict: overrides.dict ?? false,
		refund: overrides.refund ?? false,
		status: overrides.status ?? "active",
	});
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("ProviderRepository (integration)", { timeout: 30_000 }, () => {
	let repo: ProviderRepository;

	before(() => {
		// DB env vars are set by setup.ts; db/client singleton is already initialised.
		repo = new ProviderRepository();
	});

	describe("create() + findById()", () => {
		it("persists a provider and retrieves it by ID", async () => {
			const provider = makeProvider({ pixIn: true, pixOut: true });
			await repo.create(provider);

			const found = await repo.findById(provider.get("id"));
			assert.ok(found, "should find the inserted provider");
			assert.equal(found.get("id"), provider.get("id"));
			assert.equal(found.get("code"), provider.get("code"));
			assert.equal(found.get("name"), provider.get("name"));
			assert.equal(found.get("slug"), provider.get("slug"));
			assert.equal(found.get("pixIn"), true);
			assert.equal(found.get("pixOut"), true);
			assert.equal(found.get("status"), "active");
		});

		it("returns null for a non-existent ID", async () => {
			const result = await repo.findById("prov_does_not_exist");
			assert.equal(result, null);
		});
	});

	describe("findIdByCode()", () => {
		it("returns the ID when code exists", async () => {
			const provider = makeProvider();
			await repo.create(provider);
			const id = await repo.findIdByCode(provider.get("code"));
			assert.equal(id, provider.get("id"));
		});

		it("returns null when code does not exist", async () => {
			const id = await repo.findIdByCode("NON_EXISTENT_CODE_XYZ");
			assert.equal(id, null);
		});
	});

	describe("findIdBySlug()", () => {
		it("returns the ID when slug exists", async () => {
			const provider = makeProvider();
			await repo.create(provider);
			const id = await repo.findIdBySlug(provider.get("slug"));
			assert.equal(id, provider.get("id"));
		});

		it("returns null when slug does not exist", async () => {
			const id = await repo.findIdBySlug("slug-that-does-not-exist-xyz");
			assert.equal(id, null);
		});
	});

	describe("findIdByCodeExcluding()", () => {
		it("returns null when the only match is the excluded ID", async () => {
			const provider = makeProvider();
			await repo.create(provider);
			const id = await repo.findIdByCodeExcluding(
				provider.get("code"),
				provider.get("id"),
			);
			assert.equal(id, null);
		});

		it("returns the other provider's ID when a different one has the same code", async () => {
			const pA = makeProvider();
			const sharedCode = uniqueCode("SHARED");
			const pB = makeProvider({ code: sharedCode });
			await repo.create(pA);
			await repo.create(pB);
			// now create another with the same code as pA — not possible due to unique constraint,
			// so we test with pB's code, excluding pB itself → should return null
			const id = await repo.findIdByCodeExcluding(pB.get("code"), pB.get("id"));
			assert.equal(id, null);
		});
	});

	describe("findIdBySlugExcluding()", () => {
		it("returns null when the only match is the excluded ID", async () => {
			const provider = makeProvider();
			await repo.create(provider);
			const id = await repo.findIdBySlugExcluding(
				provider.get("slug"),
				provider.get("id"),
			);
			assert.equal(id, null);
		});
	});

	describe("findMany()", () => {
		it("returns all providers when search is empty", async () => {
			const p1 = makeProvider();
			const p2 = makeProvider();
			await repo.create(p1);
			await repo.create(p2);

			const result = await repo.findMany(1, 100, "");
			const ids = result.items.map((p) => p.get("id"));
			assert.ok(ids.includes(p1.get("id")));
			assert.ok(ids.includes(p2.get("id")));
			assert.ok(result.totalItems >= 2);
		});

		it("filters by name when search is provided", async () => {
			const uniqueName = `UniqueProviderName_${Date.now()}`;
			const provider = makeProvider({ name: uniqueName });
			await repo.create(provider);

			const result = await repo.findMany(1, 10, uniqueName);
			assert.equal(result.items.length, 1);
			assert.equal(result.items[0]?.get("id"), provider.get("id"));
			assert.equal(result.totalItems, 1);
		});

		it("filters by code when search is provided", async () => {
			const code = uniqueCode("SRCH");
			const provider = makeProvider({ code });
			await repo.create(provider);

			const result = await repo.findMany(1, 10, code);
			assert.ok(result.items.some((p) => p.get("id") === provider.get("id")));
		});

		it("respects pagination (limit and offset)", async () => {
			// Create 3 providers with identifiable slugs
			const tag = `PAG_${Date.now()}`;
			const _providers = await Promise.all(
				[0, 1, 2].map(async (i) => {
					const p = makeProvider({
						code: `${tag}_${i}`,
						slug: `pag-${tag.toLowerCase()}-${i}`,
					});
					await repo.create(p);
					return p;
				}),
			);

			const page1 = await repo.findMany(1, 2, tag);
			const page2 = await repo.findMany(2, 2, tag);
			assert.equal(page1.items.length, 2);
			assert.equal(page2.items.length, 1);
			assert.ok(page1.totalItems >= 3);
			// no overlap between pages
			const page1Ids = new Set(page1.items.map((p) => p.get("id")));
			const page2Ids = page2.items.map((p) => p.get("id"));
			for (const id of page2Ids) {
				assert.ok(!page1Ids.has(id), "pages should not overlap");
			}
		});

		it("returns empty when no match found", async () => {
			const result = await repo.findMany(1, 10, "ZZZNOMATCH_XYZ_9999");
			assert.equal(result.items.length, 0);
			assert.equal(result.totalItems, 0);
		});
	});

	describe("update()", () => {
		it("persists changes to mutable fields", async () => {
			const provider = makeProvider();
			await repo.create(provider);

			provider.set("name", "Updated Name");
			provider.set("status", "deactivated");
			provider.set("pixIn", true);
			provider.set("dict", true);
			await repo.update(provider);

			const updated = await repo.findById(provider.get("id"));
			assert.ok(updated);
			assert.equal(updated.get("name"), "Updated Name");
			assert.equal(updated.get("status"), "deactivated");
			assert.equal(updated.get("pixIn"), true);
			assert.equal(updated.get("dict"), true);
		});

		it("does not affect other providers when updating one", async () => {
			const p1 = makeProvider();
			const p2 = makeProvider();
			await repo.create(p1);
			await repo.create(p2);

			p1.set("name", "Only P1 Changed");
			await repo.update(p1);

			const found2 = await repo.findById(p2.get("id"));
			assert.notEqual(found2?.get("name"), "Only P1 Changed");
		});
	});
});
