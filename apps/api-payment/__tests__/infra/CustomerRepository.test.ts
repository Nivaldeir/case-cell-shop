/**
 * CustomerRepository — integration tests.
 *
 * Uses the PostgreSQL testcontainer started in setup.ts.
 * Org + Merchant are created as FK prerequisites.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import {
	CustomerRepository,
	Customers,
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

function makeMerchant(organizationId: string): Merchants {
	return Merchants.create({
		organizationId,
		legalName: `Merchant ${Date.now()} ${Math.random().toString(36).slice(2)}`,
		legalDocument: `${Math.floor(Math.random() * 9e13)
			.toString()
			.padStart(14, "0")}`,
		status: "active",
	});
}

function makeCustomer(
	merchantId: string,
	overrides: Partial<{
		name: string;
		documentNumber: string;
		email: string;
		externalId: string;
		status: "active" | "inactive" | "blocked";
	}> = {},
): Customers {
	return Customers.create({
		merchantId,
		name:
			overrides.name ??
			`Customer ${Date.now()} ${Math.random().toString(36).slice(2)}`,
		documentNumber:
			overrides.documentNumber ??
			`${Math.floor(Math.random() * 9e10)
				.toString()
				.padStart(11, "0")}`,
		email: overrides.email,
		externalId: overrides.externalId,
		status: overrides.status ?? "active",
	});
}

describe("CustomerRepository (integration)", { timeout: 30_000 }, () => {
	let customerRepo: CustomerRepository;
	let sharedMerchant: Merchants;

	before(async () => {
		customerRepo = new CustomerRepository();
		const orgRepo = new OrganizationRepository();
		const merchantRepo = new MerchantRepository();

		const org = makeOrg();
		await orgRepo.create(org);
		sharedMerchant = makeMerchant(org.get("id"));
		await merchantRepo.create(sharedMerchant);
	});

	describe("create() + findById()", () => {
		it("persists a customer and retrieves it by ID", async () => {
			const customer = makeCustomer(sharedMerchant.get("id"), {
				email: "test@example.com",
			});
			await customerRepo.create(customer);

			const found = await customerRepo.findById(customer.get("id"));
			assert.ok(found, "should find the inserted customer");
			assert.equal(found.get("id"), customer.get("id"));
			assert.equal(found.get("merchantId"), sharedMerchant.get("id"));
			assert.equal(found.get("name"), customer.get("name"));
			assert.equal(found.get("email"), "test@example.com");
			assert.equal(found.get("status"), "active");
		});

		it("returns null for a non-existent ID", async () => {
			const result = await customerRepo.findById("cus_does_not_exist");
			assert.equal(result, null);
		});
	});

	describe("findByExternalIdAndMerchantId()", () => {
		it("returns the customer when externalId + merchantId match", async () => {
			const extId = randomUUID();
			const customer = makeCustomer(sharedMerchant.get("id"), {
				externalId: extId,
			});
			await customerRepo.create(customer);

			const found = await customerRepo.findByExternalIdAndMerchantId(
				extId,
				sharedMerchant.get("id"),
			);
			assert.ok(found);
			assert.equal(found.get("id"), customer.get("id"));
		});

		it("returns null when externalId does not exist", async () => {
			const result = await customerRepo.findByExternalIdAndMerchantId(
				randomUUID(),
				sharedMerchant.get("id"),
			);
			assert.equal(result, null);
		});
	});

	describe("findByMerchantId()", () => {
		it("returns all customers for the given merchant", async () => {
			const orgRepo = new OrganizationRepository();
			const merchantRepo = new MerchantRepository();
			const org2 = makeOrg();
			await orgRepo.create(org2);
			const merchant2 = makeMerchant(org2.get("id"));
			await merchantRepo.create(merchant2);

			const c1 = makeCustomer(merchant2.get("id"));
			const c2 = makeCustomer(merchant2.get("id"));
			await customerRepo.create(c1);
			await customerRepo.create(c2);

			const results = await customerRepo.findByMerchantId(merchant2.get("id"));
			const ids = results.map((c) => c.get("id"));
			assert.ok(ids.includes(c1.get("id")));
			assert.ok(ids.includes(c2.get("id")));
		});

		it("returns empty when merchant has no customers", async () => {
			const orgRepo = new OrganizationRepository();
			const merchantRepo = new MerchantRepository();
			const emptyOrg = makeOrg();
			await orgRepo.create(emptyOrg);
			const emptyMerchant = makeMerchant(emptyOrg.get("id"));
			await merchantRepo.create(emptyMerchant);

			const results = await customerRepo.findByMerchantId(
				emptyMerchant.get("id"),
			);
			assert.deepEqual(results, []);
		});
	});

	describe("findMany()", () => {
		it("returns customers filtered by name search", async () => {
			const uniqueTag = `CusSearch_${Date.now()}`;
			const customer = makeCustomer(sharedMerchant.get("id"), {
				name: `${uniqueTag} User`,
			});
			await customerRepo.create(customer);

			const result = await customerRepo.findMany(
				1,
				10,
				uniqueTag,
				sharedMerchant.get("id"),
			);
			assert.ok(result.items.some((c) => c.get("id") === customer.get("id")));
			assert.ok(result.totalItems >= 1);
		});

		it("returns empty when no match found", async () => {
			const result = await customerRepo.findMany(
				1,
				10,
				"ZZZNOMATCH_CUS_XYZ_9999",
				sharedMerchant.get("id"),
			);
			assert.equal(result.items.length, 0);
			assert.equal(result.totalItems, 0);
		});

		it("respects pagination", async () => {
			const orgRepo = new OrganizationRepository();
			const merchantRepo = new MerchantRepository();
			const tag = `PAG_CUS_${Date.now()}`;
			const org3 = makeOrg();
			await orgRepo.create(org3);
			const merchant3 = makeMerchant(org3.get("id"));
			await merchantRepo.create(merchant3);

			await Promise.all([
				customerRepo.create(
					makeCustomer(merchant3.get("id"), { name: `${tag}_0` }),
				),
				customerRepo.create(
					makeCustomer(merchant3.get("id"), { name: `${tag}_1` }),
				),
				customerRepo.create(
					makeCustomer(merchant3.get("id"), { name: `${tag}_2` }),
				),
			]);

			const page1 = await customerRepo.findMany(1, 2, tag, merchant3.get("id"));
			const page2 = await customerRepo.findMany(2, 2, tag, merchant3.get("id"));
			assert.equal(page1.items.length, 2);
			assert.equal(page2.items.length, 1);

			const page1Ids = new Set(page1.items.map((c) => c.get("id")));
			for (const c of page2.items) {
				assert.ok(!page1Ids.has(c.get("id")), "pages should not overlap");
			}
		});
	});

	describe("update()", () => {
		it("persists changes to mutable fields", async () => {
			const customer = makeCustomer(sharedMerchant.get("id"), {
				email: "old@example.com",
			});
			await customerRepo.create(customer);

			customer.set("name", "Updated Name");
			customer.set("status", "inactive");
			customer.set("email", "new@example.com");
			await customerRepo.update(customer);

			const updated = await customerRepo.findById(customer.get("id"));
			assert.ok(updated);
			assert.equal(updated.get("name"), "Updated Name");
			assert.equal(updated.get("status"), "inactive");
			assert.equal(updated.get("email"), "new@example.com");
		});

		it("does not affect other customers when updating one", async () => {
			const c1 = makeCustomer(sharedMerchant.get("id"));
			const c2 = makeCustomer(sharedMerchant.get("id"));
			await customerRepo.create(c1);
			await customerRepo.create(c2);

			c1.set("name", "Only C1 Changed");
			await customerRepo.update(c1);

			const found2 = await customerRepo.findById(c2.get("id"));
			assert.notEqual(found2?.get("name"), "Only C1 Changed");
		});
	});
});
