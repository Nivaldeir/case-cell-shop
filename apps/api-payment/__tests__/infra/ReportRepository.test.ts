/**
 * ReportRepository — integration tests.
 *
 * Uses the PostgreSQL testcontainer started in setup.ts.
 * Org + Merchant + Wallet are created as FK prerequisites for report.wallet_id.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import {
	MerchantRepository,
	Merchants,
	OrganizationRepository,
	Organizations,
	Report,
	ReportRepository,
	Wallet,
	WalletRepository,
} from "@ledger/shared";

function makeOrg(): Organizations {
	return Organizations.create({
		externalId: randomUUID(),
		parentOrganizationId: null,
		legalName: `Org ${randomUUID().slice(0, 8)}`,
		legalDocument: String(Math.floor(Math.random() * 9e13)).padStart(14, "0"),
		status: "active",
	});
}

function makeMerchant(organizationId: string): Merchants {
	return Merchants.create({
		organizationId,
		legalName: `Merchant ${randomUUID().slice(0, 8)}`,
		legalDocument: String(Math.floor(Math.random() * 9e13)).padStart(14, "0"),
		status: "active",
	});
}

function makeWallet(merchantId: string): Wallet {
	return Wallet.create({ merchantId });
}

function makeReport(
	walletId: string,
	overrides: Partial<{
		type: string;
		format: string;
		idempotencyKey: string;
		queryParams: unknown;
		s3Bucket: string | null;
	}> = {},
): Report {
	return Report.create({
		walletId,
		type: overrides.type ?? "extract",
		format: overrides.format ?? "pdf",
		idempotencyKey: overrides.idempotencyKey ?? randomUUID().replace(/-/g, ""),
		queryParams: overrides.queryParams ?? {
			startDate: "2026-04-16T14:30:00.000Z",
			endDate: "2026-05-16T19:30:59.999Z",
		},
		s3Bucket: overrides.s3Bucket ?? null,
	});
}

describe("ReportRepository (integration)", { timeout: 30_000 }, () => {
	let reportRepo: ReportRepository;
	let sharedWalletId: string;

	before(async () => {
		reportRepo = new ReportRepository();

		const orgRepo = new OrganizationRepository();
		const merchantRepo = new MerchantRepository();
		const walletRepo = new WalletRepository();

		const org = makeOrg();
		await orgRepo.create(org);

		const merchant = makeMerchant(org.get("id"));
		await merchantRepo.create(merchant);

		const wallet = makeWallet(merchant.get("id"));
		await walletRepo.create(wallet);
		sharedWalletId = wallet.get("id");
	});

	describe("tryInsert()", () => {
		it("inserts a new report and returns the persisted domain object", async () => {
			const report = makeReport(sharedWalletId);

			const result = await reportRepo.tryInsert(report);

			assert.equal(result.inserted, true);
			if (!result.inserted) return;
			assert.equal(result.report.get("id"), report.get("id"));
			assert.equal(result.report.get("walletId"), sharedWalletId);
			assert.equal(result.report.get("type"), "extract");
			assert.equal(result.report.get("format"), "pdf");
			assert.equal(result.report.get("completed"), false);
			assert.ok(result.report.get("createdAt") instanceof Date);
		});

		it("returns inserted:false on idempotencyKey conflict without throwing", async () => {
			const idempotencyKey = randomUUID().replace(/-/g, "");
			const first = makeReport(sharedWalletId, { idempotencyKey });
			const second = makeReport(sharedWalletId, { idempotencyKey });

			const firstResult = await reportRepo.tryInsert(first);
			assert.equal(firstResult.inserted, true);

			const secondResult = await reportRepo.tryInsert(second);
			assert.equal(secondResult.inserted, false);
		});

		it("rethrows non-unique errors (e.g. FK violation on wallet_id)", async () => {
			const orphan = makeReport("wal_does_not_exist_xyz");

			await assert.rejects(
				() => reportRepo.tryInsert(orphan),
				(err: unknown) => {
					const code = (err as { code?: unknown }).code;
					return code === "23503";
				},
			);
		});
	});

	describe("findByIdempotencyKey()", () => {
		it("returns the persisted report when the key exists", async () => {
			const idempotencyKey = randomUUID().replace(/-/g, "");
			const report = makeReport(sharedWalletId, { idempotencyKey });
			await reportRepo.tryInsert(report);

			const found = await reportRepo.findByIdempotencyKey(idempotencyKey);

			assert.ok(found);
			assert.equal(found.get("id"), report.get("id"));
			assert.equal(found.get("idempotencyKey"), idempotencyKey);
			assert.equal(found.get("walletId"), sharedWalletId);
		});

		it("preserves queryParams round-trip through JSON column", async () => {
			const idempotencyKey = randomUUID().replace(/-/g, "");
			const queryParams = {
				startDate: "2026-04-16T14:30:00.000Z",
				endDate: "2026-05-16T19:30:59.999Z",
				nested: { foo: "bar", n: 42 },
			};
			await reportRepo.tryInsert(
				makeReport(sharedWalletId, { idempotencyKey, queryParams }),
			);

			const found = await reportRepo.findByIdempotencyKey(idempotencyKey);

			assert.deepEqual(found?.get("queryParams"), queryParams);
		});

		it("returns null when the key does not exist", async () => {
			const result = await reportRepo.findByIdempotencyKey(
				"does-not-exist-key-xyz",
			);
			assert.equal(result, null);
		});
	});

	describe("findById()", () => {
		it("returns the persisted report when the id exists", async () => {
			const report = makeReport(sharedWalletId);
			await reportRepo.tryInsert(report);

			const found = await reportRepo.findById(report.get("id"));

			assert.ok(found);
			assert.equal(found.get("id"), report.get("id"));
			assert.equal(found.get("walletId"), sharedWalletId);
			assert.equal(found.get("completed"), false);
		});

		it("returns null when the id does not exist", async () => {
			const result = await reportRepo.findById("rpt_does_not_exist");
			assert.equal(result, null);
		});
	});

	describe("findMany()", () => {
		let scopedWalletId: string;
		let otherWalletId: string;

		before(async () => {
			// A dedicated wallet so this block's pagination expectations don't
			// fight with rows from the tryInsert tests above.
			const orgRepo = new OrganizationRepository();
			const merchantRepo = new MerchantRepository();
			const walletRepo = new WalletRepository();

			const org = makeOrg();
			await orgRepo.create(org);
			const merchant = makeMerchant(org.get("id"));
			await merchantRepo.create(merchant);

			const w1 = makeWallet(merchant.get("id"));
			await walletRepo.create(w1);
			scopedWalletId = w1.get("id");

			const w2 = makeWallet(merchant.get("id"));
			await walletRepo.create(w2);
			otherWalletId = w2.get("id");

			// Seed 5 reports on the scoped wallet, with different fileNames + types
			// so we can exercise search/sort/filter.
			const types = [
				"extract",
				"consolidated",
				"extract",
				"extract",
				"consolidated",
			];
			for (let i = 0; i < 5; i++) {
				const r = Report.create({
					walletId: scopedWalletId,
					type: types[i] ?? "extract",
					format: "pdf",
					idempotencyKey: `seed_${scopedWalletId}_${i}`,
				});
				await reportRepo.tryInsert(r);
			}

			// And one row on the other wallet, to verify scoping.
			await reportRepo.tryInsert(
				Report.create({
					walletId: otherWalletId,
					type: "extract",
					format: "pdf",
					idempotencyKey: `seed_other_${otherWalletId}`,
				}),
			);
		});

		it("paginates results scoped to the given walletId", async () => {
			const page1 = await reportRepo.findMany({
				walletId: scopedWalletId,
				page: 1,
				limit: 2,
				sortBy: "createdAt",
				sortOrder: "desc",
			});

			assert.equal(page1.totalItems, 5);
			assert.equal(page1.items.length, 2);
			for (const item of page1.items) {
				assert.equal(item.get("walletId"), scopedWalletId);
			}

			const page3 = await reportRepo.findMany({
				walletId: scopedWalletId,
				page: 3,
				limit: 2,
				sortBy: "createdAt",
				sortOrder: "desc",
			});
			assert.equal(page3.items.length, 1, "third page holds the remaining row");
		});

		it("does not return rows from other wallets", async () => {
			const result = await reportRepo.findMany({
				walletId: scopedWalletId,
				page: 1,
				limit: 100,
				sortBy: "createdAt",
				sortOrder: "desc",
			});
			const ids = result.items.map((r) => r.get("walletId"));
			assert.ok(ids.every((w) => w === scopedWalletId));
			assert.equal(result.totalItems, 5);
		});

		it("filters by search on fileName (LIKE %term%)", async () => {
			// Insert a row whose fileName matches a unique term, then look it up.
			const distinctive = `unique_${randomUUID().slice(0, 8)}`;
			const r = Report.create({
				walletId: scopedWalletId,
				type: "extract",
				format: "pdf",
				idempotencyKey: `idem_${distinctive}`,
			});
			// Stamp a custom fileName so the LIKE search has a unique term to hit.
			r.set("fileName", `export_${distinctive}_pdf.pdf`);
			await reportRepo.tryInsert(r);

			const result = await reportRepo.findMany({
				walletId: scopedWalletId,
				page: 1,
				limit: 100,
				sortBy: "createdAt",
				sortOrder: "desc",
				search: distinctive,
			});

			assert.equal(result.totalItems, 1);
			assert.equal(result.items[0]?.get("id"), r.get("id"));
		});

		it("sorts ascending by createdAt when requested", async () => {
			const asc = await reportRepo.findMany({
				walletId: scopedWalletId,
				page: 1,
				limit: 100,
				sortBy: "createdAt",
				sortOrder: "asc",
			});

			for (let i = 1; i < asc.items.length; i++) {
				const prev = asc.items[i - 1]?.get("createdAt");
				const curr = asc.items[i]?.get("createdAt");
				assert.ok(prev && curr);
				assert.ok(
					prev.getTime() <= curr.getTime(),
					"items must be ordered by createdAt ascending",
				);
			}
		});

		it("filters by date range on createdAt", async () => {
			// `before` runs synchronously in sequence, so all seed rows have
			// createdAt = now-ish. A start date in the far future returns nothing.
			const future = await reportRepo.findMany({
				walletId: scopedWalletId,
				page: 1,
				limit: 100,
				sortBy: "createdAt",
				sortOrder: "desc",
				startDate: "2099-01-01",
			});
			assert.equal(future.totalItems, 0);

			// A wide window catches everything.
			const wide = await reportRepo.findMany({
				walletId: scopedWalletId,
				page: 1,
				limit: 100,
				sortBy: "createdAt",
				sortOrder: "desc",
				startDate: "2020-01-01",
				endDate: "2099-01-01",
			});
			assert.ok(wide.totalItems >= 5);
		});

		it("returns empty items + zero total when nothing matches the walletId", async () => {
			const result = await reportRepo.findMany({
				walletId: "wal_no_such_wallet",
				page: 1,
				limit: 10,
				sortBy: "createdAt",
				sortOrder: "desc",
			});
			assert.deepEqual(result.items, []);
			assert.equal(result.totalItems, 0);
		});
	});

	describe("deleteById()", () => {
		it("returns true and removes the row when the id exists", async () => {
			const report = makeReport(sharedWalletId);
			await reportRepo.tryInsert(report);

			const deleted = await reportRepo.deleteById(report.get("id"));
			assert.equal(deleted, true);

			const found = await reportRepo.findById(report.get("id"));
			assert.equal(found, null);
		});

		it("returns false when the id does not exist (no row deleted)", async () => {
			const deleted = await reportRepo.deleteById("rpt_definitely_not_real");
			assert.equal(deleted, false);
		});

		it("does not delete unrelated rows", async () => {
			const keep = makeReport(sharedWalletId);
			const drop = makeReport(sharedWalletId);
			await reportRepo.tryInsert(keep);
			await reportRepo.tryInsert(drop);

			await reportRepo.deleteById(drop.get("id"));

			const stillThere = await reportRepo.findById(keep.get("id"));
			assert.ok(stillThere);
			assert.equal(stillThere.get("id"), keep.get("id"));
		});
	});

	describe("unhappy paths", () => {
		it("a rejected duplicate insert leaves the original row intact", async () => {
			const idempotencyKey = randomUUID().replace(/-/g, "");
			const first = makeReport(sharedWalletId, {
				idempotencyKey,
				type: "extract",
			});
			const second = makeReport(sharedWalletId, {
				idempotencyKey,
				type: "consolidated",
			});

			const ok = await reportRepo.tryInsert(first);
			assert.equal(ok.inserted, true);

			const conflict = await reportRepo.tryInsert(second);
			assert.equal(conflict.inserted, false);

			const found = await reportRepo.findByIdempotencyKey(idempotencyKey);
			assert.ok(found);
			assert.equal(found.get("id"), first.get("id"));
			assert.equal(
				found.get("type"),
				"extract",
				"original row must not be overwritten by the conflicting insert",
			);
		});

		it("the FK error carries the constraint metadata logged by tryInsert", async () => {
			const orphan = makeReport("wal_definitely_not_real");

			await assert.rejects(
				() => reportRepo.tryInsert(orphan),
				(err: unknown) => {
					const e = err as {
						code?: unknown;
						constraint?: unknown;
						table?: unknown;
					};
					assert.equal(e.code, "23503");
					assert.equal(typeof e.constraint, "string");
					assert.equal(e.table, "report");
					return true;
				},
			);
		});
	});
});
