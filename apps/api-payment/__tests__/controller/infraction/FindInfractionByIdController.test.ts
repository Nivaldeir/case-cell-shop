import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IInfractionRepository } from "@ledger/shared";
import { Infraction, InfractionStatus, InfractionType } from "@ledger/shared";
import type { Request, Response } from "express";
import { FindInfractionById } from "@/application/usecase/Infraction/FindInfractionById";
import { FindInfractionByIdController } from "@/presentation/api/controllers/infractions/FindInfractionByIdController";

const VALID_ID = "00000000-0000-0000-0000-000000000010";

function makeInfraction(id: string): Infraction {
	return Infraction.restore({
		id,
		transactionId: "00000000-0000-0000-0000-000000000011",
		externalId: "ext_001",
		walletId: "wal_001",
		providerCode: "fyhub",
		status: InfractionStatus.OPEN,
		type: InfractionType.FRAUD,
		amount: 1500.75,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
	} as Parameters<typeof Infraction.restore>[0]);
}

function makeRepo(
	overrides: Partial<IInfractionRepository> = {},
): IInfractionRepository {
	return {
		create: async () => {},
		findById: async () => makeInfraction(VALID_ID),
		findByTransactionId: async () => null,
		existsByTransactionId: async () => false,
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		...overrides,
	};
}

function makeController(repo = makeRepo()) {
	return new FindInfractionByIdController(new FindInfractionById(repo));
}

function makeReq(infractionId: string): Request {
	return {
		params: { infractionId },
		body: {},
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

describe("FindInfractionByIdController — unit", () => {
	it("responds 200 with the infraction detail", async () => {
		const controller = makeController();
		const res = makeRes();

		await controller.handle(makeReq(VALID_ID), res as unknown as Response);

		assert.equal(res.statusCode, 200);
		const body = res.body as {
			error: boolean;
			message: string;
			data: { id: string };
		};
		assert.equal(body.error, false);
		assert.equal(body.message, "Infraction found successfully");
		assert.equal(body.data.id, VALID_ID);
	});

	it("forwards the infractionId to the use case", async () => {
		let capturedId: string | undefined;
		const controller = makeController(
			makeRepo({
				findById: async (id) => {
					capturedId = id;
					return makeInfraction(id);
				},
			}),
		);

		await controller.handle(
			makeReq(VALID_ID),
			makeRes() as unknown as Response,
		);

		assert.equal(capturedId, VALID_ID);
	});
});
