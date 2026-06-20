import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IInfractionRepository } from "@ledger/shared";
import { Infraction, InfractionStatus, InfractionType } from "@ledger/shared";
import type { Request, Response } from "express";
import { FindInfractions } from "@/application/usecase/Infraction/FindInfractions";
import { FindInfractionsController } from "@/presentation/api/controllers/infractions/FindInfractionsController";

const VALID_WALLET = "wal_001";

function makeInfraction(id: string): Infraction {
	return Infraction.restore({
		id,
		transactionId: "00000000-0000-0000-0000-000000000011",
		walletId: VALID_WALLET,
		providerCode: "fyhub",
		status: InfractionStatus.OPEN,
		type: InfractionType.FRAUD,
		amount: 1500.75,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-01"),
	} as Parameters<typeof Infraction.restore>[0]);
}

function makeRepo(
	overrides: Partial<IInfractionRepository> = {},
): IInfractionRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByTransactionId: async () => null,
		existsByTransactionId: async () => false,
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		...overrides,
	};
}

function makeController(repo = makeRepo()) {
	return new FindInfractionsController(new FindInfractions(repo));
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

describe("FindInfractionsController — unit", () => {
	it("responds 200 with data and pagination using the X-WalletId header", async () => {
		const controller = makeController(
			makeRepo({
				findMany: async () => ({
					items: [makeInfraction("inf_1")],
					totalItems: 1,
				}),
			}),
		);
		const res = makeRes();

		await controller.handle(
			makeReq({ "x-walletid": VALID_WALLET }),
			res as unknown as Response,
		);

		assert.equal(res.statusCode, 200);
		const body = res.body as {
			error: boolean;
			message: string;
			data: Array<{ id: string }>;
			pagination: { totalItems: number };
		};
		assert.equal(body.error, false);
		assert.equal(body.message, "Infractions found successfully");
		assert.equal(body.data.length, 1);
		assert.equal(body.data[0]?.id, "inf_1");
		assert.equal(body.pagination.totalItems, 1);
	});

	it("applies default page and limit when absent from the query", async () => {
		let receivedFilters: {
			walletId: string;
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
			makeReq({ "x-walletid": VALID_WALLET }),
			makeRes() as unknown as Response,
		);

		assert.equal(receivedFilters!.walletId, VALID_WALLET);
		assert.equal(receivedFilters!.page, 1);
		assert.equal(receivedFilters!.limit, 10);
	});

	it("rejects when the X-WalletId header is missing", async () => {
		const controller = makeController();

		await assert.rejects(() =>
			controller.handle(makeReq({}), makeRes() as unknown as Response),
		);
	});

	it("rejects when the X-WalletId header is empty", async () => {
		const controller = makeController();

		await assert.rejects(() =>
			controller.handle(
				makeReq({ "x-walletid": "" }),
				makeRes() as unknown as Response,
			),
		);
	});
});
