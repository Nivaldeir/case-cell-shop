/**
 * DeleteReport — use case unit tests.
 *
 * Two branches:
 *   - deleteById returns true  → resolves void
 *   - deleteById returns false → throws ReportNotFoundError
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { type IReportRepository, ReportNotFoundError } from "@ledger/shared";
import { DeleteReport } from "@/application/usecase/Report/DeleteReport";

function makeRepo(opts: {
	deleted?: boolean;
	onCall?: (id: string) => void;
	throwOnDelete?: Error;
}): IReportRepository {
	return {
		tryInsert: async () => ({ inserted: false }),
		findByIdempotencyKey: async () => null,
		findById: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
		deleteById: async (id) => {
			opts.onCall?.(id);
			if (opts.throwOnDelete) throw opts.throwOnDelete;
			return opts.deleted ?? true;
		},
	};
}

describe("DeleteReport — use case", () => {
	it("resolves void when the repository reports a row was deleted", async () => {
		let calledWith: string | undefined;
		const uc = new DeleteReport(
			makeRepo({
				deleted: true,
				onCall: (id) => {
					calledWith = id;
				},
			}),
		);

		const result = await uc.execute({ id: "rpt_existing" });

		assert.equal(result, undefined);
		assert.equal(calledWith, "rpt_existing");
	});

	it("throws ReportNotFoundError when no row was deleted", async () => {
		const uc = new DeleteReport(makeRepo({ deleted: false }));

		await assert.rejects(
			() => uc.execute({ id: "rpt_missing" }),
			(err: unknown) =>
				err instanceof ReportNotFoundError &&
				err.statusCode === 404 &&
				err.message.includes("rpt_missing"),
		);
	});

	it("propagates errors thrown by the repository", async () => {
		const uc = new DeleteReport(
			makeRepo({ throwOnDelete: new Error("db down") }),
		);

		await assert.rejects(() => uc.execute({ id: "rpt_any" }), /db down/);
	});
});
