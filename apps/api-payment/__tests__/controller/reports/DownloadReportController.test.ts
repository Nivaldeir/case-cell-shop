/**
 * DownloadReportController — unit tests.
 *
 * The use case is stubbed. Verifies the controller's HTTP shape and that
 * the route :id param is forwarded to the use case.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReportNotFoundError, ReportNotReadyError } from "@ledger/shared";
import type { Request, Response } from "express";
import type {
	DownloadReport,
	DownloadReportOutput,
} from "@/application/usecase/Report/DownloadReport";
import { DownloadReportController } from "@/presentation/api/controllers/reports/DownloadReportController";

function stubUseCase(
	result: DownloadReportOutput | Error,
	onExecute?: (input: unknown) => void,
): DownloadReport {
	return {
		execute: async (input: unknown) => {
			onExecute?.(input);
			if (result instanceof Error) throw result;
			return result;
		},
	} as unknown as DownloadReport;
}

function makeReq(id: string): Request {
	return { params: { id }, body: {}, query: {} } as unknown as Request;
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

describe("DownloadReportController — unit", () => {
	it("responds 200 with { error:false, message, data:{ id, s3Url } }", async () => {
		const ctrl = new DownloadReportController(
			stubUseCase({
				id: "rpt_ok",
				s3Url: "https://s3.example.test/exports/rpt_ok.pdf?sig=abc",
			}),
		);
		const res = makeRes();

		await ctrl.handle(makeReq("rpt_ok"), res as unknown as Response);

		assert.equal(res.statusCode, 200);
		assert.deepEqual(res.body, {
			error: false,
			message: "Download URL generated successfully",
			data: {
				id: "rpt_ok",
				s3Url: "https://s3.example.test/exports/rpt_ok.pdf?sig=abc",
			},
		});
	});

	it("forwards the route :id param to the use case", async () => {
		let captured: unknown;
		const ctrl = new DownloadReportController(
			stubUseCase({ id: "rpt_42", s3Url: "https://example/x" }, (input) => {
				captured = input;
			}),
		);

		await ctrl.handle(makeReq("rpt_42"), makeRes() as unknown as Response);

		assert.deepEqual(captured, { id: "rpt_42" });
	});

	describe("unhappy paths", () => {
		it("propagates ReportNotFoundError (mapped to 404 by global error middleware)", async () => {
			const ctrl = new DownloadReportController(
				stubUseCase(new ReportNotFoundError("rpt_missing")),
			);
			const res = makeRes();

			await assert.rejects(
				() => ctrl.handle(makeReq("rpt_missing"), res as unknown as Response),
				(err: unknown) =>
					err instanceof ReportNotFoundError && err.statusCode === 404,
			);
			assert.equal(res.statusCode, 0);
		});

		it("propagates ReportNotReadyError (mapped to 409 by global error middleware)", async () => {
			const ctrl = new DownloadReportController(
				stubUseCase(new ReportNotReadyError("rpt_pending")),
			);
			const res = makeRes();

			await assert.rejects(
				() => ctrl.handle(makeReq("rpt_pending"), res as unknown as Response),
				(err: unknown) =>
					err instanceof ReportNotReadyError && err.statusCode === 409,
			);
			assert.equal(res.statusCode, 0);
		});
	});
});
