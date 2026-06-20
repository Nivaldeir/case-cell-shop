import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IMediationRepository } from "@ledger/shared";
import {
	Infraction,
	InfractionStatus,
	InfractionType,
	Mediation,
} from "@ledger/shared";
import type { Request, Response } from "express";
import { FindMediations } from "@/application/usecase/Mediation/FindMediations";
import { FindMediationsController } from "@/presentation/api/controllers/mediation/FindMediationsController";

const VALID_MERCHANT = "mer_001";

function makeMediation(id: string): Mediation {
	return Mediation.restore({
		id,
		infractionId: "00000000-0000-0000-0000-000000000010",
		defense: "the transaction was authorized",
		attachments: ["https://s3/evidence.png"],
		createdAt: new Date("2026-02-01"),
		updatedAt: new Date("2026-02-01"),
	} as Parameters<typeof Mediation.restore>[0]);
}

function makeInfraction(): Infraction {
	return Infraction.restore({
		id: "00000000-0000-0000-0000-000000000010",
		transactionId: "00000000-0000-0000-0000-000000000011",
		walletId: "wal_001",
		accountId: "acc_001",
		merchantId: VALID_MERCHANT,
		providerCode: "fyhub",
		status: InfractionStatus.APPROVED,
		type: InfractionType.FRAUD,
		amount: 1500.75,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-01"),
	} as Parameters<typeof Infraction.restore>[0]);
}

function makeRepo(
	overrides: Partial<IMediationRepository> = {},
): IMediationRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByInfractionId: async () => null,
		existsByInfractionId: async () => false,
		findMany: async () => ({ items: [], totalItems: 0 }),
		...overrides,
	};
}

function makeController(repo = makeRepo()) {
	return new FindMediationsController(new FindMediations(repo));
}

function makeReq(
	headers: Record<string, unknown>,
	query: Record<string, unknown> = {},
): Request {
	return { headers, query } as unknown as Request;
}

type MockResponse = {
	statusCode: number;
	body: unknown;
	status: (code: number) => MockResponse;
	json: (data: unknown) => MockResponse;
};

function makeRes(): MockResponse {
	const res: MockResponse = {
		statusCode: 200,
		body: undefined,
		status(code) {
			this.statusCode = code;
			return this;
		},
		json(data) {
			this.body = data;
			return this;
		},
	};
	return res;
}

describe("FindMediationsController — unit", () => {
	it("responds 200 with data and pagination using the X-MerchantId header", async () => {
		const controller = makeController(
			makeRepo({
				findMany: async () => ({
					items: [
						{ mediation: makeMediation("med_1"), infraction: makeInfraction() },
					],
					totalItems: 1,
				}),
			}),
		);
		const res = makeRes();

		await controller.handle(
			makeReq({ "x-merchantid": VALID_MERCHANT }),
			res as unknown as Response,
		);

		assert.equal(res.statusCode, 200);
		const body = res.body as {
			error: boolean;
			message: string;
			data: Array<{ mediation: { id: string }; infraction: { id: string } }>;
			pagination: { totalItems: number };
		};
		assert.equal(body.error, false);
		assert.equal(body.message, "Mediations found successfully");
		assert.equal(body.data.length, 1);
		assert.equal(body.data[0]?.mediation.id, "med_1");
		assert.equal(body.pagination.totalItems, 1);
	});

	it("forwards optional accountId/walletId filters and default page/limit", async () => {
		let receivedFilters: {
			merchantId: string;
			accountId?: string;
			walletId?: string;
			page: number;
			limit: number;
		} | null = null;
		const controller = makeController(
			makeRepo({
				findMany: async (filters) => {
					receivedFilters = filters;
					return { items: [], totalItems: 0 };
				},
			}),
		);

		await controller.handle(
			makeReq(
				{ "x-merchantid": VALID_MERCHANT },
				{ accountId: "acc_001", walletId: "wal_001" },
			),
			makeRes() as unknown as Response,
		);

		assert.equal(receivedFilters!.merchantId, VALID_MERCHANT);
		assert.equal(receivedFilters!.accountId, "acc_001");
		assert.equal(receivedFilters!.walletId, "wal_001");
		assert.equal(receivedFilters!.page, 1);
		assert.equal(receivedFilters!.limit, 10);
	});

	it("forwards a valid status filter to the repository", async () => {
		let receivedStatus: InfractionStatus | undefined;
		const controller = makeController(
			makeRepo({
				findMany: async (filters) => {
					receivedStatus = filters.status;
					return { items: [], totalItems: 0 };
				},
			}),
		);

		await controller.handle(
			makeReq(
				{ "x-merchantid": VALID_MERCHANT },
				{ status: InfractionStatus.OPEN },
			),
			makeRes() as unknown as Response,
		);

		assert.equal(receivedStatus, InfractionStatus.OPEN);
	});

	it("ignores an empty status, accountId and walletId", async () => {
		let receivedFilters: {
			status?: InfractionStatus;
			accountId?: string;
			walletId?: string;
		} | null = null;
		const controller = makeController(
			makeRepo({
				findMany: async (filters) => {
					receivedFilters = filters;
					return { items: [], totalItems: 0 };
				},
			}),
		);

		const res = makeRes();
		await controller.handle(
			makeReq(
				{ "x-merchantid": VALID_MERCHANT },
				{ status: "", accountId: "", walletId: "" },
			),
			res as unknown as Response,
		);

		assert.equal(res.statusCode, 200);
		assert.equal(receivedFilters!.status, undefined);
		assert.equal(receivedFilters!.accountId, undefined);
		assert.equal(receivedFilters!.walletId, undefined);
	});

	it("rejects an invalid status value", async () => {
		const controller = makeController();

		await assert.rejects(() =>
			controller.handle(
				makeReq({ "x-merchantid": VALID_MERCHANT }, { status: "bogus" }),
				makeRes() as unknown as Response,
			),
		);
	});

	it("rejects when the X-MerchantId header is missing", async () => {
		const controller = makeController();

		await assert.rejects(() =>
			controller.handle(makeReq({}), makeRes() as unknown as Response),
		);
	});

	it("rejects when the X-MerchantId header is empty", async () => {
		const controller = makeController();

		await assert.rejects(() =>
			controller.handle(
				makeReq({ "x-merchantid": "" }),
				makeRes() as unknown as Response,
			),
		);
	});
});
