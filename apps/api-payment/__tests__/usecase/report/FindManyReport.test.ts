/**
 * FindManyReport — use case unit tests.
 *
 * The repository is mocked. Goal: verify filter pass-through, pagination
 * math (totalPages), domain → DTO mapping, and empty-result handling.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type FindManyReportsFilters,
	type IReportRepository,
	Report,
} from "@ledger/shared";
import { FindManyReport } from "@/application/usecase/Report/FindManyReport";

function makeReport(
	overrides: Partial<{ id: string; walletId: string; completed: boolean }> = {},
): Report {
	return Report.restore({
		id: overrides.id ?? "rpt_1",
		walletId: overrides.walletId ?? "wal_1",
		type: "extract",
		format: "pdf",
		fileName: "export_wal_1_pdf_1.pdf",
		s3Url: null,
		s3Key: null,
		s3Bucket: "test-bucket",
		completed: overrides.completed ?? false,
		idempotencyKey: `idem_${overrides.id ?? "rpt_1"}`,
		queryParams: null,
		createdAt: new Date("2026-05-01T12:00:00.000Z"),
		updatedAt: new Date("2026-05-01T12:00:00.000Z"),
	});
}

type FindManyStub = {
	items?: Report[];
	totalItems?: number;
	onCall?: (filters: FindManyReportsFilters) => void;
};

function makeRepo(stub: FindManyStub = {}): IReportRepository {
	return {
		tryInsert: async () => ({ inserted: false }),
		findByIdempotencyKey: async () => null,
		findById: async () => null,
		findMany: async (filters) => {
			stub.onCall?.(filters);
			return {
				items: stub.items ?? [],
				totalItems: stub.totalItems ?? stub.items?.length ?? 0,
			};
		},
		deleteById: async () => false,
	};
}

const DEFAULT_FILTERS: FindManyReportsFilters = {
	walletId: "wal_1",
	page: 1,
	limit: 10,
	sortBy: "createdAt",
	sortOrder: "desc",
};

describe("FindManyReport — use case", () => {
	it("returns items mapped to the DTO shape and computes pagination", async () => {
		const reports = [
			makeReport({ id: "rpt_1" }),
			makeReport({ id: "rpt_2", completed: true }),
		];
		const uc = new FindManyReport(makeRepo({ items: reports, totalItems: 23 }));

		const result = await uc.execute(DEFAULT_FILTERS);

		assert.equal(result.items.length, 2);
		assert.equal(result.items[0]?.id, "rpt_1");
		assert.equal(result.items[0]?.completed, false);
		assert.equal(result.items[1]?.id, "rpt_2");
		assert.equal(result.items[1]?.completed, true);
		assert.deepEqual(result.pagination, {
			page: 1,
			limit: 10,
			totalItems: 23,
			totalPages: 3, // ceil(23 / 10)
		});
	});

	it("passes filters through to the repository unchanged", async () => {
		let captured: FindManyReportsFilters | undefined;
		const uc = new FindManyReport(
			makeRepo({
				onCall: (filters) => {
					captured = filters;
				},
			}),
		);

		const input: FindManyReportsFilters = {
			walletId: "wal_99",
			page: 3,
			limit: 25,
			sortBy: "fileName",
			sortOrder: "asc",
			search: "extract",
			startDate: "2026-04-01",
			endDate: "2026-04-30",
		};

		await uc.execute(input);

		assert.deepEqual(captured, input);
	});

	it("returns an empty page with totalPages=0 when there are no results", async () => {
		const uc = new FindManyReport(makeRepo({ items: [], totalItems: 0 }));

		const result = await uc.execute(DEFAULT_FILTERS);

		assert.deepEqual(result.items, []);
		assert.deepEqual(result.pagination, {
			page: 1,
			limit: 10,
			totalItems: 0,
			totalPages: 0,
		});
	});

	it("computes totalPages=1 when totalItems is non-zero but less than limit", async () => {
		const uc = new FindManyReport(
			makeRepo({ items: [makeReport()], totalItems: 3 }),
		);

		const result = await uc.execute({ ...DEFAULT_FILTERS, limit: 10 });

		assert.equal(result.pagination.totalPages, 1);
	});

	it("includes both s3Bucket and s3Key in the DTO (download lookups need them)", async () => {
		const reports = [makeReport({ id: "rpt_ready" })];
		const uc = new FindManyReport(makeRepo({ items: reports, totalItems: 1 }));

		const result = await uc.execute(DEFAULT_FILTERS);

		const item = result.items[0];
		assert.ok(item);
		assert.equal(item.s3Bucket, "test-bucket");
		assert.equal(item.s3Key, null);
	});
});
