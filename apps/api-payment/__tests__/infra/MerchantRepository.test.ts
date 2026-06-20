/**
 * MerchantRepository — integration tests.
 *
 * Uses the PostgreSQL testcontainer started in setup.ts.
 * Organizations are created as FK prerequisites.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import {
	MerchantRepository,
	Merchants,
	OrganizationRepository,
	Organizations,
} from "@ledger/shared";

function makeOrg(): Organizations {
	return Organizations.create({
		externalId: randomUUID(),
		parentOrganizationId: null,
		legalName: `Org ${Date.now()} ${Math.random().toString(36).slice(2)}`,
		legalDocument: `${Math.floor(Math.random() * 9e13)
			.toString()
			.padStart(14, "0")}`,
		status: "active",
	});
}

function makeMerchant(
	organizationId: string,
	overrides: Partial<{
		legalName: string;
		legalDocument: string;
		status: "active" | "inactive" | "suspended" | "blocked";
	}> = {},
): Merchants {
	return Merchants.create({
		organizationId,
		legalName:
			overrides.legalName ??
			`Merchant ${Date.now()} ${Math.random().toString(36).slice(2)}`,
		legalDocument:
			overrides.legalDocument ??
			`${Math.floor(Math.random() * 9e13)
				.toString()
				.padStart(14, "0")}`,
		status: overrides.status ?? "active",
	});
}

describe("MerchantRepository (integration)", { timeout: 30_000 }, () => {
	let merchantRepo: MerchantRepository;
	let orgRepo: OrganizationRepository;
	let sharedOrg: Organizations;

	before(async () => {
		merchantRepo = new MerchantRepository();
		orgRepo = new OrganizationRepository();
		sharedOrg = makeOrg();
		await orgRepo.create(sharedOrg);
	});

	describe("create() + findById()", () => {
		it("persists a merchant and retrieves it by ID", async () => {
			const merchant = makeMerchant(sharedOrg.get("id"));
			await merchantRepo.create(merchant);

			const found = await merchantRepo.findById(merchant.get("id"));
			assert.ok(found, "should find the inserted merchant");
			assert.equal(found.get("id"), merchant.get("id"));
			assert.equal(found.get("organizationId"), sharedOrg.get("id"));
			assert.equal(found.get("legalName"), merchant.get("legalName"));
			assert.equal(found.get("legalDocument"), merchant.get("legalDocument"));
			assert.equal(found.get("status"), "active");
		});

		it("returns null for a non-existent ID", async () => {
			const result = await merchantRepo.findById("mer_does_not_exist");
			assert.equal(result, null);
		});
	});

	describe("findByOrganizationId()", () => {
		it("returns merchants for a given organization", async () => {
			const org2 = makeOrg();
			await orgRepo.create(org2);
			const m1 = makeMerchant(org2.get("id"));
			const m2 = makeMerchant(org2.get("id"));
			await merchantRepo.create(m1);
			await merchantRepo.create(m2);

			const results = await merchantRepo.findByOrganizationId(org2.get("id"));
			const ids = results.map((m) => m.get("id"));
			assert.ok(ids.includes(m1.get("id")));
			assert.ok(ids.includes(m2.get("id")));
		});

		it("returns empty when organization has no merchants", async () => {
			const emptyOrg = makeOrg();
			await orgRepo.create(emptyOrg);
			const results = await merchantRepo.findByOrganizationId(
				emptyOrg.get("id"),
			);
			assert.deepEqual(results, []);
		});
	});

	describe("findMany()", () => {
		it("returns merchants filtered by legalName search", async () => {
			const uniqueTag = `MerchSearch_${Date.now()}`;
			const m = makeMerchant(sharedOrg.get("id"), {
				legalName: `${uniqueTag} Corp`,
			});
			await merchantRepo.create(m);

			const result = await merchantRepo.findMany(1, 10, uniqueTag);
			assert.ok(result.items.some((mer) => mer.get("id") === m.get("id")));
			assert.ok(result.totalItems >= 1);
		});

		it("returns empty when no match found", async () => {
			const result = await merchantRepo.findMany(
				1,
				10,
				"ZZZNOMATCH_MERCH_XYZ_9999",
			);
			assert.equal(result.items.length, 0);
			assert.equal(result.totalItems, 0);
		});

		it("respects pagination", async () => {
			const tag = `PAG_MERCH_${Date.now()}`;
			const org3 = makeOrg();
			await orgRepo.create(org3);
			await Promise.all([
				merchantRepo.create(
					makeMerchant(org3.get("id"), { legalName: `${tag}_0` }),
				),
				merchantRepo.create(
					makeMerchant(org3.get("id"), { legalName: `${tag}_1` }),
				),
				merchantRepo.create(
					makeMerchant(org3.get("id"), { legalName: `${tag}_2` }),
				),
			]);

			const page1 = await merchantRepo.findMany(1, 2, tag);
			const page2 = await merchantRepo.findMany(2, 2, tag);
			assert.equal(page1.items.length, 2);
			assert.equal(page2.items.length, 1);

			const page1Ids = new Set(page1.items.map((m) => m.get("id")));
			for (const m of page2.items) {
				assert.ok(!page1Ids.has(m.get("id")), "pages should not overlap");
			}
		});

		it("filters by organizationId when provided", async () => {
			const org4 = makeOrg();
			await orgRepo.create(org4);
			const m = makeMerchant(org4.get("id"));
			await merchantRepo.create(m);

			const result = await merchantRepo.findMany(1, 10, "", org4.get("id"));
			assert.ok(
				result.items.every(
					(mer) => mer.get("organizationId") === org4.get("id"),
				),
			);
			assert.ok(result.items.some((mer) => mer.get("id") === m.get("id")));
		});
	});

	describe("update()", () => {
		it("persists changes to mutable fields", async () => {
			const merchant = makeMerchant(sharedOrg.get("id"));
			await merchantRepo.create(merchant);

			merchant.set("legalName", "Updated Corp LTDA");
			merchant.set("status", "inactive");
			await merchantRepo.update(merchant);

			const updated = await merchantRepo.findById(merchant.get("id"));
			assert.ok(updated);
			assert.equal(updated.get("legalName"), "Updated Corp LTDA");
			assert.equal(updated.get("status"), "inactive");
		});

		it("does not affect other merchants when updating one", async () => {
			const m1 = makeMerchant(sharedOrg.get("id"));
			const m2 = makeMerchant(sharedOrg.get("id"));
			await merchantRepo.create(m1);
			await merchantRepo.create(m2);

			m1.set("legalName", "Only M1 Changed");
			await merchantRepo.update(m1);

			const found2 = await merchantRepo.findById(m2.get("id"));
			assert.notEqual(found2?.get("legalName"), "Only M1 Changed");
		});
	});
});
