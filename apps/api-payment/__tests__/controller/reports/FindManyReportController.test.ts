/**
 * FindManyReportController — unit tests.
 *
 * The use case is stubbed; the test verifies the controller's HTTP shape:
 * 200 + { error: false, message, data, pagination } and query forwarding.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import type {
	FindManyReport,
	FindManyReportOutput,
} from "@/application/usecase/Report/FindManyReport";
import { FindManyReportController } from "@/presentation/api/controllers/reports/FindManyReportController";

function stubUseCase(
	result: FindManyReportOutput,
	onExecute?: (input: unknown) => void,
): FindManyReport {
	return {
		execute: async (input: unknown) => {
			onExecute?.(input);
			return result;
		},
	} as unknown as FindManyReport;
}

function makeReq(query: Record<string, unknown>): Request {
	return { query, body: {}, params: {} } as unknown as Request;
}

type MockRes = {
	statusCode: number;
	body: unknown;
	status(c: number): MockRes;
	json(d: unknown): MockRes;
};

function makeRes(): MockRes {
	const res: MockRes = {
		statusCode: 0,
		body: undefined,
		status(c) {
			this.statusCode = c;
			return this;
		},
		json(d) {
			this.body = d;
			return this;
		},
	};
	return res;
}

const VALID_QUERY = {
	walletId: "wal_001",
	page: "2",
	limit: "25",
	sortBy: "createdAt",
	sortOrder: "desc",
	search: "extract",
};

const SAMPLE_OUTPUT: FindManyReportOutput = {
	items: [
		{
			id: "rpt_1",
			walletId: "wal_001",
			type: "extract",
			format: "pdf",
			fileName: "export_wal_001_pdf_1.pdf",
			completed: true,
			s3Bucket: "test-bucket",
			s3Key: "exports/rpt_1.pdf",
			createdAt: new Date("2026-05-01T12:00:00.000Z"),
			updatedAt: new Date("2026-05-01T12:00:00.000Z"),
		},
	],
	pagination: { page: 2, limit: 25, totalItems: 27, totalPages: 2 },
};

describe("FindManyReportController — unit", () => {
	it("responds 200 with { error:false, message, data, pagination }", async () => {
		const ctrl = new FindManyReportController(stubUseCase(SAMPLE_OUTPUT));
		const res = makeRes();

		await ctrl.handle(makeReq(VALID_QUERY), res as unknown as Response);

		assert.equal(res.statusCode, 200);
		const body = res.body as {
			error: boolean;
			message: string;
			data: unknown[];
			pagination: unknown;
		};
		assert.equal(body.error, false);
		assert.equal(body.message, "Reports found successfully");
		assert.deepEqual(body.data, SAMPLE_OUTPUT.items);
		assert.deepEqual(body.pagination, SAMPLE_OUTPUT.pagination);
	});

	it("coerces and forwards parsed query params to the use case", async () => {
		let captured: unknown;
		const ctrl = new FindManyReportController(
			stubUseCase(SAMPLE_OUTPUT, (input) => {
				captured = input;
			}),
		);

		await ctrl.handle(makeReq(VALID_QUERY), makeRes() as unknown as Response);

		assert.deepEqual(captured, {
			walletId: "wal_001",
			page: 2, // coerced from "2"
			limit: 25, // coerced from "25"
			sortBy: "createdAt",
			sortOrder: "desc",
			search: "extract",
		});
	});

	it("applies schema defaults when optional query params are omitted", async () => {
		let captured: {
			page?: number;
			limit?: number;
			sortBy?: string;
			sortOrder?: string;
		} = {};
		const ctrl = new FindManyReportController(
			stubUseCase(SAMPLE_OUTPUT, (input) => {
				captured = input as typeof captured;
			}),
		);

		await ctrl.handle(
			makeReq({ walletId: "wal_only" }),
			makeRes() as unknown as Response,
		);

		assert.equal(captured.page, 1);
		assert.equal(captured.limit, 10);
		assert.equal(captured.sortBy, "createdAt");
		assert.equal(captured.sortOrder, "desc");
	});

	it("propagates errors thrown by the use case (no res touched)", async () => {
		const ctrl = new FindManyReportController({
			execute: async () => {
				throw new Error("boom");
			},
		} as unknown as FindManyReport);
		const res = makeRes();

		await assert.rejects(
			() => ctrl.handle(makeReq(VALID_QUERY), res as unknown as Response),
			/boom/,
		);
		assert.equal(res.statusCode, 0);
		assert.equal(res.body, undefined);
	});
});
