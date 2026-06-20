import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IMediationRepository } from "@ledger/shared";
import {
	Infraction,
	InfractionStatus,
	InfractionType,
	Mediation,
	MediationNotFoundError,
} from "@ledger/shared";
import { FindMediationById } from "@/application/usecase/Mediation/FindMediationById";

const MEDIATION_ID = "00000000-0000-0000-0000-000000000020";
const INFRACTION_ID = "00000000-0000-0000-0000-000000000010";

function makeMediation(): Mediation {
	return Mediation.restore({
		id: MEDIATION_ID,
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
		externalId: "ext_001",
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
		findById: async () => null,
		findByInfractionId: async () => null,
		existsByInfractionId: async () => false,
		findMany: async () => ({ items: [], totalItems: 0 }),
		...overrides,
	};
}

describe("FindMediationById — use case", () => {
	it("forwards the mediationId to the repository", async () => {
		let receivedId: string | undefined;
		const repo = makeRepo({
			findById: async (id) => {
				receivedId = id;
				return { mediation: makeMediation(), infraction: makeInfraction() };
			},
		});

		await new FindMediationById(repo).execute({ mediationId: MEDIATION_ID });

		assert.equal(receivedId, MEDIATION_ID);
	});

	it("maps the mediation and infraction detail when found", async () => {
		const mediation = makeMediation();
		const infraction = makeInfraction();
		const repo = makeRepo({
			findById: async () => ({ mediation, infraction }),
		});

		const result = await new FindMediationById(repo).execute({
			mediationId: MEDIATION_ID,
		});

		assert.deepEqual(result, {
			mediation: {
				id: mediation.get("id"),
				infractionId: mediation.get("infractionId"),
				defense: mediation.get("defense"),
				attachments: mediation.get("attachments"),
				createdAt: mediation.get("createdAt"),
				updatedAt: mediation.get("updatedAt"),
			},
			infraction: {
				id: infraction.get("id"),
				transactionId: infraction.get("transactionId"),
				externalId: infraction.get("externalId"),
				walletId: infraction.get("walletId"),
				accountId: infraction.get("accountId"),
				merchantId: infraction.get("merchantId"),
				providerCode: infraction.get("providerCode"),
				status: infraction.get("status"),
				type: infraction.get("type"),
				amount: infraction.get("amount"),
				createdAt: infraction.get("createdAt"),
				updatedAt: infraction.get("updatedAt"),
			},
		});
	});

	it("throws MediationNotFoundError when the mediation does not exist", async () => {
		await assert.rejects(
			() => new FindMediationById(makeRepo()).execute({ mediationId: "ghost" }),
			(e) => e instanceof MediationNotFoundError,
		);
	});

	it("the thrown error has statusCode 404", async () => {
		await assert.rejects(
			() => new FindMediationById(makeRepo()).execute({ mediationId: "ghost" }),
			(e) => (e as MediationNotFoundError).statusCode === 404,
		);
	});
});
