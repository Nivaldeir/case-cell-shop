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
import { FindMediationById } from "@/application/usecase/Mediation/FindMediationById";
import { FindMediationByIdController } from "@/presentation/api/controllers/mediation/FindMediationByIdController";

const VALID_ID = "00000000-0000-0000-0000-000000000020";
const INFRACTION_ID = "00000000-0000-0000-0000-000000000010";

function makeMediation(id: string): Mediation {
	return Mediation.restore({
		id,
		infractionId: INFRACTION_ID,
		defense: "the transaction was authorized",
		attachments: ["https://s3/evidence.png"],
		createdAt: new Date("2026-02-01"),
		updatedAt: new Date("2026-02-02"),
	} as Parameters<typeof Mediation.restore>[0]);
}

function makeInfraction(): Infraction {
	return Infraction.restore({
		id: INFRACTION_ID,
		transactionId: "00000000-0000-0000-0000-000000000011",
		walletId: "wal_001",
		accountId: "acc_001",
		merchantId: "mer_001",
		providerCode: "fyhub",
		status: InfractionStatus.APPROVED,
		type: InfractionType.FRAUD,
		amount: 1500.75,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-02"),
	} as Parameters<typeof Infraction.restore>[0]);
}

function makeRepo(
	overrides: Partial<IMediationRepository> = {},
): IMediationRepository {
	return {
		create: async () => {},
		findById: async () => ({
			mediation: makeMediation(VALID_ID),
			infraction: makeInfraction(),
		}),
		findByInfractionId: async () => null,
		existsByInfractionId: async () => false,
		findMany: async () => ({ items: [], totalItems: 0 }),
		...overrides,
	};
}

function makeController(repo = makeRepo()) {
	return new FindMediationByIdController(new FindMediationById(repo));
}

function makeReq(mediationId: string): Request {
	return {
		params: { mediationId },
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

describe("FindMediationByIdController — unit", () => {
	it("responds 200 with the mediation and infraction detail", async () => {
		const controller = makeController();
		const res = makeRes();

		await controller.handle(makeReq(VALID_ID), res as unknown as Response);

		assert.equal(res.statusCode, 200);
		const body = res.body as {
			error: boolean;
			message: string;
			data: {
				mediation: { id: string };
				infraction: { id: string };
			};
		};
		assert.equal(body.error, false);
		assert.equal(body.message, "Mediation found successfully");
		assert.equal(body.data.mediation.id, VALID_ID);
		assert.equal(body.data.infraction.id, INFRACTION_ID);
	});

	it("forwards the mediationId to the use case", async () => {
		let capturedId: string | undefined;
		const controller = makeController(
			makeRepo({
				findById: async (id) => {
					capturedId = id;
					return {
						mediation: makeMediation(id),
						infraction: makeInfraction(),
					};
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
