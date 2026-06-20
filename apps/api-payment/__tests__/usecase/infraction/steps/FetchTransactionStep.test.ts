import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ITransactionsRepository } from "@ledger/shared";
import {
	Infraction,
	InfractionStatus,
	InfractionType,
	PaymentMethod,
	TransactionStatus,
	Transactions,
	TransactionType,
} from "@ledger/shared";
import type { InfractionPipelineContext } from "@/application/usecase/Infraction/InfractionPipeline";
import { FetchTransactionStep } from "@/application/usecase/Infraction/pipeline/FetchTransactionStep";

const TRANSACTION_ID = "00000000-0000-0000-0000-000000000011";

function makeTransaction(): Transactions {
	return Transactions.restore({
		id: TRANSACTION_ID,
		amount: 100,
		currency: "BRL",
		accountId: "acc_001",
		type: TransactionType.PIX_IN,
		externalId: "ext_001",
		customerId: "cus_001",
		providerCode: "fyhub",
		status: TransactionStatus.COMPLETED,
		method: PaymentMethod.PIX,
		walletId: "wal_001",
	} as Parameters<typeof Transactions.restore>[0]);
}

function makeInfraction(): Infraction {
	return Infraction.restore({
		id: "inf_001",
		transactionId: TRANSACTION_ID,
		externalId: "ext_001",
		walletId: "wal_001",
		providerCode: "fyhub",
		status: InfractionStatus.OPEN,
		type: InfractionType.FRAUD,
		amount: 100,
		createdAt: new Date(),
		updatedAt: new Date(),
	} as Parameters<typeof Infraction.restore>[0]);
}

function makeTransactionRepo(
	findById: ITransactionsRepository["findById"] = async () => makeTransaction(),
): ITransactionsRepository {
	return { findById } as unknown as ITransactionsRepository;
}

describe("FetchTransactionStep", () => {
	it("returns ok true and sets ctx.transaction when found", async () => {
		const step = new FetchTransactionStep(makeTransactionRepo());
		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: "inf_001",
				status: InfractionStatus.ANALYSING,
			},
			infraction: makeInfraction(),
		};

		const result = await step.execute(ctx);

		assert.equal(result.ok, true);
		assert.equal(ctx.transaction?.get("id"), TRANSACTION_ID);
	});

	it("returns ok true and leaves ctx.transaction undefined when not found", async () => {
		const step = new FetchTransactionStep(
			makeTransactionRepo(async () => null),
		);
		const ctx: InfractionPipelineContext = {
			input: {
				infractionId: "inf_001",
				status: InfractionStatus.ANALYSING,
			},
			infraction: makeInfraction(),
		};

		const result = await step.execute(ctx);

		assert.equal(result.ok, true);
		assert.equal(ctx.transaction, undefined);
	});
});
