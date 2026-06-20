/**
 * DeleteReportController — unit tests.
 *
 * The use case is stubbed. Verifies 200 + { error:false, message } on
 * success and that ReportNotFoundError propagates untouched.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ReportNotFoundError } from "@ledger/shared";
import type { Request, Response } from "express";
import type { DeleteReport } from "@/application/usecase/Report/DeleteReport";
import { DeleteReportController } from "@/presentation/api/controllers/reports/DeleteReportController";

function stubUseCase(
	behaviour: "ok" | Error,
	onExecute?: (input: unknown) => void,
): DeleteReport {
	return {
		execute: async (input: unknown) => {
			onExecute?.(input);
			if (behaviour !== "ok") throw behaviour;
		},
	} as unknown as DeleteReport;
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

describe("DeleteReportController — unit", () => {
	it("responds 200 with { error:false, message } on success", async () => {
		const ctrl = new DeleteReportController(stubUseCase("ok"));
		const res = makeRes();

		await ctrl.handle(makeReq("rpt_existing"), res as unknown as Response);

		assert.equal(res.statusCode, 200);
		assert.deepEqual(res.body, {
			error: false,
			message: "Report deleted successfully",
		});
	});

	it("forwards the route :id param to the use case", async () => {
		let captured: unknown;
		const ctrl = new DeleteReportController(
			stubUseCase("ok", (input) => {
				captured = input;
			}),
		);

		await ctrl.handle(makeReq("rpt_42"), makeRes() as unknown as Response);

		assert.deepEqual(captured, { id: "rpt_42" });
	});

	it("propagates ReportNotFoundError (mapped to 404 by global error middleware)", async () => {
		const ctrl = new DeleteReportController(
			stubUseCase(new ReportNotFoundError("rpt_missing")),
		);
		const res = makeRes();

		await assert.rejects(
			() => ctrl.handle(makeReq("rpt_missing"), res as unknown as Response),
			(err: unknown) =>
				err instanceof ReportNotFoundError && err.statusCode === 404,
		);
		assert.equal(res.statusCode, 0);
		assert.equal(res.body, undefined);
	});
});
