/**
 * ExportReportController — unit tests.
 *
 * The use case is stubbed so the test only exercises the status→HTTP
 * mapping in the controller's handle().
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import type {
	ReportExport,
	ReportExportResult,
} from "@/application/usecase/Report/ExportReport";
import { ExportReportController } from "@/presentation/api/controllers/reports/ExportReportController";

function stubUseCase(
	result: ReportExportResult,
	onExecute?: (input: unknown) => void,
): ReportExport {
	return {
		execute: async (input: unknown) => {
			onExecute?.(input);
			return result;
		},
	} as unknown as ReportExport;
}

function makeReq(body: Record<string, unknown>): Request {
	return { body, params: {}, query: {} } as unknown as Request;
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

const VALID_BODY = {
	walletId: "wal_001",
	type: "extract",
	format: "pdf",
	query: {
		startDate: "2026-04-16T14:30:00.000Z",
		endDate: "2026-05-16T19:30:59.999Z",
	},
};

describe("ExportReportController — unit", () => {
	const FIXED_DATE = new Date("2026-05-21T20:00:00.000Z");

	it("responds 200 with status=queued for a brand-new request", async () => {
		const ctrl = new ExportReportController(
			stubUseCase({
				requestId: "rpt_new",
				status: "queued",
				createdAt: FIXED_DATE,
			}),
		);
		const res = makeRes();

		await ctrl.handle(makeReq(VALID_BODY), res as unknown as Response);

		assert.equal(res.statusCode, 200);
		const body = res.body as {
			message: string;
			requestId: string;
			status: string;
			createdAt: Date;
		};
		assert.equal(body.status, "queued");
		assert.equal(body.requestId, "rpt_new");
		assert.equal(body.createdAt, FIXED_DATE);
		assert.equal(body.message, "Request export started");
		assert.equal(
			(body as Record<string, unknown>).s3Url,
			undefined,
			"s3Url must not be included in the response",
		);
	});

	it("responds 200 with status=ready when the report is already completed", async () => {
		const ctrl = new ExportReportController(
			stubUseCase({
				requestId: "rpt_done",
				status: "ready",
				createdAt: FIXED_DATE,
			}),
		);
		const res = makeRes();

		await ctrl.handle(makeReq(VALID_BODY), res as unknown as Response);

		assert.equal(res.statusCode, 200);
		const body = res.body as {
			message: string;
			status: string;
			createdAt: Date;
		};
		assert.equal(body.status, "ready");
		assert.equal(body.createdAt, FIXED_DATE);
		assert.equal(body.message, "Existing report returned");
	});

	it("responds 202 with status=pending when generation is in flight", async () => {
		const ctrl = new ExportReportController(
			stubUseCase({
				requestId: "rpt_pending",
				status: "pending",
				createdAt: FIXED_DATE,
			}),
		);
		const res = makeRes();

		await ctrl.handle(makeReq(VALID_BODY), res as unknown as Response);

		assert.equal(res.statusCode, 202);
		const body = res.body as { message: string; status: string };
		assert.equal(body.status, "pending");
		assert.equal(body.message, "Existing report is still being generated");
	});

	it("forwards the request body to the use case", async () => {
		let captured: unknown;
		const ctrl = new ExportReportController(
			stubUseCase(
				{ requestId: "rpt_x", status: "queued", createdAt: FIXED_DATE },
				(input) => {
					captured = input;
				},
			),
		);

		await ctrl.handle(makeReq(VALID_BODY), makeRes() as unknown as Response);

		assert.deepEqual(captured, VALID_BODY);
	});

	describe("unhappy paths", () => {
		it("propagates errors thrown by the use case (no res touched)", async () => {
			const ctrl = new ExportReportController({
				execute: async () => {
					throw new Error("boom");
				},
			} as unknown as ReportExport);
			const res = makeRes();

			await assert.rejects(
				() => ctrl.handle(makeReq(VALID_BODY), res as unknown as Response),
				/boom/,
			);
			assert.equal(res.statusCode, 0);
			assert.equal(res.body, undefined);
		});

		it("rethrows synchronous errors from the use case", async () => {
			const ctrl = new ExportReportController({
				execute: () => {
					throw new Error("sync boom");
				},
			} as unknown as ReportExport);

			await assert.rejects(
				() =>
					ctrl.handle(makeReq(VALID_BODY), makeRes() as unknown as Response),
				/sync boom/,
			);
		});
	});
});
