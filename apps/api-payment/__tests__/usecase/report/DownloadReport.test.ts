/**
 * DownloadReport — use case unit tests.
 *
 * Verifies the three branches:
 *   - report missing       → ReportNotFoundError
 *   - report exists w/o s3 → ReportNotReadyError
 *   - report ready         → S3 presign called with stored s3Key
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type IReportRepository,
	Report,
	ReportNotFoundError,
	ReportNotReadyError,
} from "@ledger/shared";
import { DownloadReport } from "@/application/usecase/Report/DownloadReport";
import type { S3Service } from "@/infra/services/S3Service";

function makeReport(opts: { id?: string; s3Key?: string | null } = {}): Report {
	return Report.restore({
		id: opts.id ?? "rpt_1",
		walletId: "wal_1",
		type: "extract",
		format: "pdf",
		fileName: "export_wal_1_pdf_1.pdf",
		s3Url: null,
		s3Key: opts.s3Key ?? null,
		s3Bucket: "test-bucket",
		completed: opts.s3Key != null,
		idempotencyKey: "idem_1",
		queryParams: null,
		createdAt: new Date("2026-05-01T12:00:00.000Z"),
		updatedAt: new Date("2026-05-01T12:00:00.000Z"),
	});
}

function makeRepo(report: Report | null): IReportRepository {
	return {
		tryInsert: async () => ({ inserted: false }),
		findByIdempotencyKey: async () => null,
		findById: async () => report,
		findMany: async () => ({ items: [], totalItems: 0 }),
		deleteById: async () => false,
	};
}

function makeS3(
	stub: { url?: string; onCall?: (key: string) => void } = {},
): S3Service {
	return {
		getSignedDownloadUrl: async (key: string) => {
			stub.onCall?.(key);
			return stub.url ?? `https://s3.example.test/${key}?sig=fake`;
		},
	} as unknown as S3Service;
}

describe("DownloadReport — use case", () => {
	it("returns a presigned URL for a completed report", async () => {
		let s3KeyPassedToS3: string | undefined;
		const uc = new DownloadReport(
			makeRepo(makeReport({ id: "rpt_ok", s3Key: "exports/rpt_ok.pdf" })),
			makeS3({
				url: "https://s3.example.test/exports/rpt_ok.pdf?sig=abc",
				onCall: (k) => {
					s3KeyPassedToS3 = k;
				},
			}),
		);

		const result = await uc.execute({ id: "rpt_ok" });

		assert.equal(result.id, "rpt_ok");
		assert.equal(
			result.s3Url,
			"https://s3.example.test/exports/rpt_ok.pdf?sig=abc",
		);
		assert.equal(
			s3KeyPassedToS3,
			"exports/rpt_ok.pdf",
			"S3 presign must receive the row's stored s3Key, not the row id",
		);
	});

	it("throws ReportNotFoundError when the row is missing", async () => {
		const uc = new DownloadReport(makeRepo(null), makeS3());

		await assert.rejects(
			() => uc.execute({ id: "rpt_missing" }),
			(err: unknown) =>
				err instanceof ReportNotFoundError &&
				err.statusCode === 404 &&
				err.message.includes("rpt_missing"),
		);
	});

	it("throws ReportNotReadyError when s3Key is null (worker hasn't finished)", async () => {
		const uc = new DownloadReport(
			makeRepo(makeReport({ id: "rpt_pending", s3Key: null })),
			makeS3(),
		);

		await assert.rejects(
			() => uc.execute({ id: "rpt_pending" }),
			(err: unknown) =>
				err instanceof ReportNotReadyError &&
				err.statusCode === 409 &&
				err.message.includes("rpt_pending"),
		);
	});

	it("does not call S3 when the report is not ready", async () => {
		let s3Called = false;
		const s3 = {
			getSignedDownloadUrl: async () => {
				s3Called = true;
				return "should-not-reach";
			},
		} as unknown as S3Service;
		const uc = new DownloadReport(
			makeRepo(makeReport({ id: "rpt_pending", s3Key: null })),
			s3,
		);

		await assert.rejects(
			() => uc.execute({ id: "rpt_pending" }),
			ReportNotReadyError,
		);
		assert.equal(s3Called, false);
	});

	it("propagates errors from the S3 client", async () => {
		const s3 = {
			getSignedDownloadUrl: async () => {
				throw new Error("s3 unreachable");
			},
		} as unknown as S3Service;
		const uc = new DownloadReport(
			makeRepo(makeReport({ id: "rpt_x", s3Key: "exports/rpt_x.pdf" })),
			s3,
		);

		await assert.rejects(() => uc.execute({ id: "rpt_x" }), /s3 unreachable/);
	});
});
