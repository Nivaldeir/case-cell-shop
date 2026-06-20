import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IMerchantRepository } from "@ledger/shared";
import { MerchantNotFound, Merchants } from "@ledger/shared";
import { UpdateMerchant } from "@/application/usecase/Merchant/UpdateMerchant";

function makeMerchant(): Merchants {
	return Merchants.restore({
		id: "merch_001",
		organizationId: "org_001",
		legalName: "Old Name",
		legalDocument: "12345678000100",
		status: "active",
	});
}

function makeRepo(
	merchant: Merchants | null = makeMerchant(),
	overrides: Partial<IMerchantRepository> = {},
): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => merchant,
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		...overrides,
	};
}

describe("UpdateMerchant — use case", () => {
	it("returns merchantId", async () => {
		const result = await new UpdateMerchant(makeRepo()).execute({
			merchantId: "merch_001",
			legalName: "New",
		});
		assert.equal(result.merchantId, "merch_001");
	});

	it("throws MerchantNotFound when merchant does not exist", async () => {
		await assert.rejects(
			() => new UpdateMerchant(makeRepo(null)).execute({ merchantId: "ghost" }),
			(e) => e instanceof MerchantNotFound,
		);
	});

	it("updates legalName", async () => {
		let saved: any;
		await new UpdateMerchant(
			makeRepo(makeMerchant(), {
				update: async (m) => {
					saved = m;
				},
			}),
		).execute({ merchantId: "merch_001", legalName: "New Corp" });
		assert.equal(saved.get("legalName"), "New Corp");
	});

	it("updates legalDocument", async () => {
		let saved: any;
		await new UpdateMerchant(
			makeRepo(makeMerchant(), {
				update: async (m) => {
					saved = m;
				},
			}),
		).execute({ merchantId: "merch_001", legalDocument: "98765432000100" });
		assert.equal(saved.get("legalDocument"), "98765432000100");
	});

	it("updates status", async () => {
		let saved: any;
		await new UpdateMerchant(
			makeRepo(makeMerchant(), {
				update: async (m) => {
					saved = m;
				},
			}),
		).execute({ merchantId: "merch_001", status: "suspended" });
		assert.equal(saved.get("status"), "suspended");
	});

	it("does not overwrite fields when undefined is passed", async () => {
		let saved: any;
		await new UpdateMerchant(
			makeRepo(makeMerchant(), {
				update: async (m) => {
					saved = m;
				},
			}),
		).execute({ merchantId: "merch_001", legalName: undefined });
		assert.equal(saved.get("legalName"), "Old Name"); // unchanged
	});

	it("calls update exactly once", async () => {
		let count = 0;
		await new UpdateMerchant(
			makeRepo(makeMerchant(), {
				update: async () => {
					count++;
				},
			}),
		).execute({ merchantId: "merch_001", legalName: "X" });
		assert.equal(count, 1);
	});
});
