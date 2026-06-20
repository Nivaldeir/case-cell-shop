/**
 * OrganizationRepository — integration tests.
 *
 * Uses the PostgreSQL testcontainer started in setup.ts.
 * Tests the full persistence round-trip: create → read → search.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import { OrganizationRepository, Organizations } from "@ledger/shared";

function makeOrg(
	overrides: Partial<{
		externalId: string;
		parentOrganizationId: string | null;
		legalName: string;
		legalDocument: string;
		status: "active" | "inactive" | "suspended" | "blocked";
	}> = {},
): Organizations {
	return Organizations.create({
		externalId: overrides.externalId ?? randomUUID(),
		parentOrganizationId: overrides.parentOrganizationId ?? null,
		legalName:
			overrides.legalName ??
			`Org ${Date.now()} ${Math.random().toString(36).slice(2)}`,
		legalDocument:
			overrides.legalDocument ??
			`${Math.floor(Math.random() * 9e13)
				.toString()
				.padStart(14, "0")}`,
		status: overrides.status ?? "active",
	});
}

describe("OrganizationRepository (integration)", { timeout: 30_000 }, () => {
	let repo: OrganizationRepository;

	before(() => {
		repo = new OrganizationRepository();
	});

	describe("create() + findById()", () => {
		it("persists an organization and retrieves it by ID", async () => {
			const org = makeOrg({ status: "active" });
			await repo.create(org);

			const found = await repo.findById(org.get("id"));
			assert.ok(found, "should find the inserted org");
			assert.equal(found.get("id"), org.get("id"));
			assert.equal(found.get("externalId"), org.get("externalId"));
			assert.equal(found.get("legalName"), org.get("legalName"));
			assert.equal(found.get("legalDocument"), org.get("legalDocument"));
			assert.equal(found.get("status"), "active");
		});

		it("returns null for a non-existent ID", async () => {
			const result = await repo.findById("org_does_not_exist");
			assert.equal(result, null);
		});
	});

	describe("findByExternalId()", () => {
		it("returns the organization when externalId exists", async () => {
			const extId = randomUUID();
			const org = makeOrg({ externalId: extId });
			await repo.create(org);

			const found = await repo.findByExternalId(extId);
			assert.ok(found);
			assert.equal(found.get("id"), org.get("id"));
			assert.equal(found.get("externalId"), extId);
		});

		it("returns null when externalId does not exist", async () => {
			const result = await repo.findByExternalId(randomUUID());
			assert.equal(result, null);
		});
	});

	describe("findMany()", () => {
		it("returns matching organizations with pagination", async () => {
			const uniqueTag = `OrgSearch_${Date.now()}`;
			const org1 = makeOrg({ legalName: `${uniqueTag}_A` });
			const org2 = makeOrg({ legalName: `${uniqueTag}_B` });
			await repo.create(org1);
			await repo.create(org2);

			const result = await repo.findMany(1, 10, uniqueTag);
			assert.equal(result.items.length, 2);
			assert.equal(result.totalItems, 2);
		});

		it("returns empty when no legalName matches the search", async () => {
			const result = await repo.findMany(1, 10, "ZZZNOMATCH_ORG_XYZ_9999");
			assert.equal(result.items.length, 0);
			assert.equal(result.totalItems, 0);
		});

		it("respects pagination limit and offset", async () => {
			const tag = `PAG_ORG_${Date.now()}`;
			await Promise.all([
				repo.create(makeOrg({ legalName: `${tag}_0` })),
				repo.create(makeOrg({ legalName: `${tag}_1` })),
				repo.create(makeOrg({ legalName: `${tag}_2` })),
			]);

			const page1 = await repo.findMany(1, 2, tag);
			const page2 = await repo.findMany(2, 2, tag);
			assert.equal(page1.items.length, 2);
			assert.equal(page2.items.length, 1);
			assert.ok(page1.totalItems >= 3);

			const page1Ids = new Set(page1.items.map((o) => o.get("id")));
			for (const o of page2.items) {
				assert.ok(!page1Ids.has(o.get("id")), "pages should not overlap");
			}
		});
	});
});
