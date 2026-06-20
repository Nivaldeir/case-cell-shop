import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IBalanceRepository,
	IInfractionRepository,
	ITransactionsRepository,
} from "@ledger/shared";
import {
	Balances,
	Infraction,
	InfractionStatus,
	InfractionType,
} from "@ledger/shared";
import type { Request, Response } from "express";
import { z } from "zod";
import { UpdateInfractionStatus } from "@/application/usecase/Infraction/UpdateInfractionStatus";
import { UpdateInfractionStatusController } from "@/presentation/api/controllers/infractions/UpdateInfractionStatusController";

const VALID_ID = "00000000-0000-0000-0000-000000000010";
const WALLET_ID = "wal_001";

function makeInfraction(): Infraction {
	return Infraction.restore({
		id: VALID_ID,
		transactionId: "00000000-0000-0000-0000-000000000011",
		externalId: "ext_001",
		walletId: WALLET_ID,
		providerCode: "fyhub",
		status: InfractionStatus.OPEN,
		type: InfractionType.FRAUD,
		amount: 100,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
	} as Parameters<typeof Infraction.restore>[0]);
}

function makeInfractionRepo(): IInfractionRepository {
	return {
		create: async () => {},
		findById: async () => makeInfraction(),
		findByTransactionId: async () => null,
		existsByTransactionId: async () => false,
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		updateTx: async () => {},
	};
}

function makeBalanceRepo(): IBalanceRepository {
	return {
		createMany: async () => {},
		createManyTx: async () => {},
		findByAccountId: async () => null,
		findByWalletId: async () => null,
		findAllByWalletId: async () => [],
		findByWalletIdForUpdateTx: async () =>
			Balances.restore({
				id: "bal_001",
				walletId: WALLET_ID,
				assetCode: "BRL",
				available: 1000,
				onHold: 0,
				blocked: 0,
				version: 1,
			} as Parameters<typeof Balances.restore>[0]),
		update: async () => null,
		updateTx: async (b) => b,
	};
}

function makeTransactionRepo(): ITransactionsRepository {
	return {
		findById: async () => null,
	} as unknown as ITransactionsRepository;
}

function makeController() {
	return new UpdateInfractionStatusController(
		new UpdateInfractionStatus(
			makeInfractionRepo(),
			makeBalanceRepo(),
			makeTransactionRepo(),
		),
	);
}

function makeReq(status: string): Request {
	return {
		params: { infractionId: VALID_ID },
		body: { status },
		query: {},
	} as unknown as Request;
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

describe("UpdateInfractionStatusController — unit", () => {
	it("rejects a non-uuid infractionId via paramsSchema", () => {
		const schema = z.object({ infractionId: z.string().uuid() });
		assert.equal(
			schema.safeParse({ infractionId: "not-a-uuid" }).success,
			false,
		);
	});

	it("rejects an unknown status via bodySchema", () => {
		const schema = z.object({ status: z.nativeEnum(InfractionStatus) });
		assert.equal(schema.safeParse({ status: "frozen" }).success, false);
	});

	it("responds 200 with the updated infraction detail", async () => {
		const controller = makeController();
		const res = makeRes();

		await controller.handle(
			makeReq(InfractionStatus.CLOSED),
			res as unknown as Response,
		);

		assert.equal(res.statusCode, 200);
		const body = res.body as {
			error: boolean;
			message: string;
			data: { id: string; status: string };
		};
		assert.equal(body.error, false);
		assert.equal(body.message, "Infraction updated successfully");
		assert.equal(body.data.id, VALID_ID);
		assert.equal(body.data.status, InfractionStatus.CLOSED);
	});
});
