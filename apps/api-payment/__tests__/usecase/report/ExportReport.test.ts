/**
 * ExportReport — use case unit tests.
 *
 * IReportRepository is fully mocked. SQSAdapter.prototype methods are
 * stubbed per-test via t.mock.method so dispatch() never reaches AWS.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IReportRepository,
	IWalletRepository,
	TryInsertReportResult,
	Wallet,
} from "@ledger/shared";
import { Report, SQSAdapter, WalletNotFoundError } from "@ledger/shared";
import { ReportExport } from "@/application/usecase/Report/ExportReport";

type Input = Parameters<ReportExport["execute"]>[0];

function makeInput(overrides: Partial<Input> = {}): Input {
	return {
		walletId: "wal_001",
		type: "extract",
		format: "pdf",
		query: {
			startDate: "2026-04-16T14:30:00.000Z",
			endDate: "2026-05-16T19:30:59.999Z",
		},
		...overrides,
	} as Input;
}

type RepoStubs = {
	tryInsertResults?: TryInsertReportResult[];
	findResult?: Report | null;
	onTryInsert?: (report: Report) => void;
	onFindByIdempotencyKey?: (key: string) => void;
};

function makeRepo(stubs: RepoStubs = {}): IReportRepository {
	const results = [...(stubs.tryInsertResults ?? [])];
	return {
		tryInsert: async (report) => {
			stubs.onTryInsert?.(report);
			const next = results.shift();
			if (next) return next;
			return { inserted: true, report };
		},
		findByIdempotencyKey: async (key) => {
			stubs.onFindByIdempotencyKey?.(key);
			return stubs.findResult ?? null;
		},
		findById: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
		deleteById: async () => false,
	};
}

function makeWalletRepo(opts: { exists?: boolean } = {}): IWalletRepository {
	const exists = opts.exists ?? true;
	return {
		findById: async () => (exists ? ({} as Wallet) : null),
		create: async () => {},
		createTx: async () => {},
		findByAccountId: async () => null,
		findByMerchantId: async () => null,
		findByPixKey: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		updateTx: async () => {},
	};
}

function stubSqs(t: {
	mock: { method: typeof import("node:test").mock.method };
}) {
	const publish = t.mock.method(
		SQSAdapter.prototype,
		"publish",
		async () => "msg-id",
	);
	t.mock.method(SQSAdapter.prototype, "connect", async () => {});
	t.mock.method(SQSAdapter.prototype, "disconnect", async () => {});
	return { publish };
}

describe("ReportExport — use case", () => {
	it("queues a new export when tryInsert succeeds", async (t) => {
		const { publish } = stubSqs(t);
		const uc = new ReportExport(makeRepo(), makeWalletRepo());

		const result = await uc.execute(makeInput());

		assert.equal(result.status, "queued");
		assert.match(result.requestId, /^rpt_/);
		assert.ok(result.createdAt instanceof Date);
		assert.equal(publish.mock.callCount(), 1);
	});

	it("dispatches a message containing reportId and idempotencyKey", async (t) => {
		const { publish } = stubSqs(t);
		const uc = new ReportExport(makeRepo(), makeWalletRepo());

		const result = await uc.execute(makeInput());

		const [, message] = publish.mock.calls[0]!.arguments as [
			string,
			Record<string, unknown>,
		];
		assert.equal(message.reportId, result.requestId);
		assert.equal(message.walletId, "wal_001");
		assert.equal(message.type, "extract");
		assert.equal(message.format, "pdf");
		assert.equal(typeof message.idempotencyKey, "string");
	});

	it("does not dispatch when tryInsert reports a conflict", async (t) => {
		const { publish } = stubSqs(t);
		const repo = makeRepo({
			tryInsertResults: [{ inserted: false }],
			findResult: Report.restore({
				id: "rpt_existing",
				walletId: "wal_001",
				type: "extract",
				format: "pdf",
				fileName: "f.pdf",
				s3Url: null,
				s3Key: null,
				s3Bucket: null,
				completed: false,
				idempotencyKey: "existing-key",
				queryParams: null,
			}),
		});
		const uc = new ReportExport(repo, makeWalletRepo());

		await uc.execute(makeInput());

		assert.equal(publish.mock.callCount(), 0);
	});

	it("returns ready when the existing report is completed", async (t) => {
		stubSqs(t);
		const fixedDate = new Date("2026-05-21T20:00:00.000Z");
		const existing = Report.restore({
			id: "rpt_existing",
			walletId: "wal_001",
			type: "extract",
			format: "pdf",
			fileName: "f.pdf",
			s3Url: "https://s3/file.pdf",
			s3Key: "file.pdf",
			s3Bucket: "bucket",
			completed: true,
			idempotencyKey: "existing-key",
			queryParams: null,
			createdAt: fixedDate,
		});
		const uc = new ReportExport(
			makeRepo({
				tryInsertResults: [{ inserted: false }],
				findResult: existing,
			}),
			makeWalletRepo(),
		);

		const result = await uc.execute(makeInput());

		assert.equal(result.status, "ready");
		assert.equal(result.requestId, "rpt_existing");
		assert.equal(result.createdAt, fixedDate);
	});

	it("returns pending when the existing report is still being generated", async (t) => {
		stubSqs(t);
		const fixedDate = new Date("2026-05-21T20:00:00.000Z");
		const existing = Report.restore({
			id: "rpt_existing",
			walletId: "wal_001",
			type: "extract",
			format: "pdf",
			fileName: "f.pdf",
			s3Url: null,
			s3Key: null,
			s3Bucket: null,
			completed: false,
			idempotencyKey: "existing-key",
			queryParams: null,
			createdAt: fixedDate,
		});
		const uc = new ReportExport(
			makeRepo({
				tryInsertResults: [{ inserted: false }],
				findResult: existing,
			}),
			makeWalletRepo(),
		);

		const result = await uc.execute(makeInput());

		assert.equal(result.status, "pending");
		assert.equal(result.requestId, "rpt_existing");
		assert.equal(result.createdAt, fixedDate);
	});

	it("throws when tryInsert conflicts but the conflicting row is gone", async (t) => {
		stubSqs(t);
		const uc = new ReportExport(
			makeRepo({
				tryInsertResults: [{ inserted: false }],
				findResult: null,
			}),
			makeWalletRepo(),
		);

		await assert.rejects(
			() => uc.execute(makeInput()),
			/idempotencyKey=.* could not be retrieved/,
		);
	});

	it("produces the same idempotencyKey within the 5-minute window for the same inputs", async (t) => {
		stubSqs(t);
		const keys: string[] = [];
		const repo = makeRepo({
			onTryInsert: (r) => keys.push(r.get("idempotencyKey")),
		});
		const uc = new ReportExport(repo, makeWalletRepo());

		const baseNow = Date.UTC(2026, 4, 21, 12, 0, 0);
		t.mock.timers.enable({ apis: ["Date"], now: baseNow });

		await uc.execute(makeInput());
		t.mock.timers.tick(60_000); // +1 min, same 5-min bucket
		await uc.execute(makeInput());

		assert.equal(keys.length, 2);
		assert.equal(keys[0], keys[1]);
	});

	it("produces a different idempotencyKey once the 5-minute window rolls over", async (t) => {
		stubSqs(t);
		const keys: string[] = [];
		const repo = makeRepo({
			onTryInsert: (r) => keys.push(r.get("idempotencyKey")),
		});
		const uc = new ReportExport(repo, makeWalletRepo());

		const baseNow = Date.UTC(2026, 4, 21, 12, 0, 0);
		t.mock.timers.enable({ apis: ["Date"], now: baseNow });

		await uc.execute(makeInput());
		t.mock.timers.tick(5 * 60_000 + 1);
		await uc.execute(makeInput());

		assert.notEqual(keys[0], keys[1]);
	});

	it("produces different idempotencyKeys for different walletIds", async (t) => {
		stubSqs(t);
		const keys: string[] = [];
		const repo = makeRepo({
			onTryInsert: (r) => keys.push(r.get("idempotencyKey")),
		});
		const uc = new ReportExport(repo, makeWalletRepo());

		await uc.execute(makeInput({ walletId: "wal_A" }));
		await uc.execute(makeInput({ walletId: "wal_B" }));

		assert.notEqual(keys[0], keys[1]);
	});

	it("normalises invalid query dates to undefined before hashing", async (t) => {
		stubSqs(t);
		const keys: string[] = [];
		const repo = makeRepo({
			onTryInsert: (r) => keys.push(r.get("idempotencyKey")),
		});
		const uc = new ReportExport(repo, makeWalletRepo());

		const baseNow = Date.UTC(2026, 4, 21, 12, 0, 0);
		t.mock.timers.enable({ apis: ["Date"], now: baseNow });

		await uc.execute(
			makeInput({
				query: { startDate: "not-a-date", endDate: "also-bogus" } as never,
			}),
		);
		await uc.execute(
			makeInput({
				query: { startDate: undefined, endDate: undefined } as never,
			}),
		);

		assert.equal(keys[0], keys[1]);
	});

	it("persists normalised query params on the inserted report", async (t) => {
		stubSqs(t);
		let captured: Report | undefined;
		const repo = makeRepo({
			onTryInsert: (r) => {
				captured = r;
			},
		});
		const uc = new ReportExport(repo, makeWalletRepo());

		await uc.execute(
			makeInput({
				query: {
					startDate: "2026-04-16T14:30:00.000Z",
					endDate: "2026-05-16T19:30:59.999Z",
					type: "pix-in",
				} as never,
			}),
		);

		assert.ok(captured);
		const params = captured!.get("queryParams") as Record<string, unknown>;
		assert.equal(params.startDate, "2026-04-16T14:30:00.000Z");
		assert.equal(params.endDate, "2026-05-16T19:30:59.999Z");
		assert.equal(params.type, "pix-in");
	});

	describe("unhappy paths", () => {
		it("throws WalletNotFoundError when the wallet does not exist", async (t) => {
			const { publish } = stubSqs(t);
			const repo = makeRepo();
			const uc = new ReportExport(repo, makeWalletRepo({ exists: false }));

			await assert.rejects(
				() => uc.execute(makeInput({ walletId: "wal_missing" })),
				(err: unknown) =>
					err instanceof WalletNotFoundError &&
					err.statusCode === 404 &&
					err.message.includes("wal_missing"),
			);
			assert.equal(publish.mock.callCount(), 0);
		});

		it("propagates errors thrown by tryInsert (e.g. FK violation)", async (t) => {
			const { publish } = stubSqs(t);
			const repo: IReportRepository = {
				tryInsert: async () => {
					const err = new Error("foreign key violation") as Error & {
						code: string;
					};
					err.code = "23503";
					throw err;
				},
				findByIdempotencyKey: async () => null,
				findById: async () => null,
				findMany: async () => ({ items: [], totalItems: 0 }),
				deleteById: async () => false,
			};
			const uc = new ReportExport(repo, makeWalletRepo());

			await assert.rejects(
				() => uc.execute(makeInput()),
				(err: unknown) =>
					(err as { code?: string }).code === "23503" &&
					(err as Error).message.includes("foreign key"),
			);
			assert.equal(publish.mock.callCount(), 0);
		});

		it("propagates errors thrown by findByIdempotencyKey on the replay path", async (t) => {
			stubSqs(t);
			const repo: IReportRepository = {
				tryInsert: async () => ({ inserted: false }),
				findByIdempotencyKey: async () => {
					throw new Error("db down");
				},
				findById: async () => null,
				findMany: async () => ({ items: [], totalItems: 0 }),
				deleteById: async () => false,
			};
			const uc = new ReportExport(repo, makeWalletRepo());

			await assert.rejects(() => uc.execute(makeInput()), /db down/);
		});

		it("propagates publish failures and still tears down the SQS adapter", async (t) => {
			t.mock.method(SQSAdapter.prototype, "connect", async () => {});
			t.mock.method(SQSAdapter.prototype, "publish", async () => {
				throw new Error("sqs unreachable");
			});
			const disconnect = t.mock.method(
				SQSAdapter.prototype,
				"disconnect",
				async () => {},
			);

			const uc = new ReportExport(makeRepo(), makeWalletRepo());

			await assert.rejects(() => uc.execute(makeInput()), /sqs unreachable/);
			assert.equal(
				disconnect.mock.callCount(),
				1,
				"disconnect must run via finally even when publish throws",
			);
		});

		it("propagates connect failures without ever calling publish", async (t) => {
			t.mock.method(SQSAdapter.prototype, "connect", async () => {
				throw new Error("connect failed");
			});
			const publish = t.mock.method(
				SQSAdapter.prototype,
				"publish",
				async () => "msg-id",
			);
			t.mock.method(SQSAdapter.prototype, "disconnect", async () => {});

			const uc = new ReportExport(makeRepo(), makeWalletRepo());

			await assert.rejects(() => uc.execute(makeInput()), /connect failed/);
			assert.equal(publish.mock.callCount(), 0);
		});

		it("treats a missing query field as an empty object for hashing", async (t) => {
			stubSqs(t);
			const keys: string[] = [];
			const repo = makeRepo({
				onTryInsert: (r) => keys.push(r.get("idempotencyKey")),
			});
			const uc = new ReportExport(repo, makeWalletRepo());

			const baseNow = Date.UTC(2026, 4, 21, 12, 0, 0);
			t.mock.timers.enable({ apis: ["Date"], now: baseNow });

			await uc.execute(makeInput({ query: undefined }));
			await uc.execute(makeInput({ query: null as never }));

			assert.equal(keys[0], keys[1]);
		});
	});
});
