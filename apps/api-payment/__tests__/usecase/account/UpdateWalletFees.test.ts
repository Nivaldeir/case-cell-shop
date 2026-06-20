import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IAccountRepository, IFeesRepository } from "@ledger/shared";
import { AccountNotFound, Accounts, FeeNotFound, Fees } from "@ledger/shared";
import { UpdateWalletFees } from "@/application/usecase/Wallet/fees/UpdateWalletFees";

function makeAccount(): Accounts {
	return Accounts.restore({
		id: "acc_001",
		organizationId: "00000000-0000-0000-0000-000000000001",
		parentAccountId: "",
		accPixIn: "pix_in_001",
		accPixOut: "pix_out_001",
		bankName: "Bank of America",
		createdAt: new Date(),
		updatedAt: new Date(),
		bookId: "bk_001",
		customerId: "cus_001",
		merchantId: "merch_001",
		providerId: "prov_001",
		status: "active",
		bankCode: "001",
		bankIspb: "00000000",
		agency: "0001",
		accountNumber: "123456-7",
		documentNumber: "12345678901",
		holder: "John Doe",
		idExternal: "EXT-001",
		costPixIn: 0,
		costPixOut: 0,
	});
}

function makeFees(): Fees {
	return Fees.restore({
		id: "fee_001",
		accountId: "acc_001",
		pixIn: 1.0,
		pixOut: 2.0,
		pixInPercentage: 0.1,
		pixOutPercentage: 0.2,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

function makeAccountRepo(
	account: Accounts | null = makeAccount(),
): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => account,
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
	};
}

function makeFeesRepo(
	fees: Fees | null = makeFees(),
	overrides: Partial<IFeesRepository> = {},
): IFeesRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findByAccountId: async () => fees,
		update: async () => {},
		...overrides,
	};
}

const validInput = {
	accountId: "acc_001",
	pixIn: 3.0,
	pixOut: 4.0,
	pixInPercentage: 0.5,
	pixOutPercentage: 0.5,
};

describe("UpdateWalletFees — use case", () => {
	it("throws AccountNotFound when account does not exist", async () => {
		await assert.rejects(
			() =>
				new UpdateWalletFees(makeAccountRepo(null), makeFeesRepo()).execute(
					validInput,
				),
			(e) => e instanceof AccountNotFound,
		);
	});

	it("throws FeeNotFound when fees do not exist for account", async () => {
		await assert.rejects(
			() =>
				new UpdateWalletFees(makeAccountRepo(), makeFeesRepo(null)).execute(
					validInput,
				),
			(e) => e instanceof FeeNotFound,
		);
	});

	it("returns feesId and all updated fee values", async () => {
		const result = await new UpdateWalletFees(
			makeAccountRepo(),
			makeFeesRepo(),
		).execute(validInput);
		assert.equal(result.feesId, "fee_001");
		assert.equal(result.pixIn, 3.0);
		assert.equal(result.pixOut, 4.0);
		assert.equal(result.pixInPercentage, 0.5);
		assert.equal(result.pixOutPercentage, 0.5);
	});

	it("persists updated fees via repository.update", async () => {
		let saved: any;
		await new UpdateWalletFees(
			makeAccountRepo(),
			makeFeesRepo(makeFees(), {
				update: async (f) => {
					saved = f;
				},
			}),
		).execute(validInput);
		assert.equal(saved.get("pixIn"), 3.0);
		assert.equal(saved.get("pixOut"), 4.0);
	});

	it("calls feesRepository.update exactly once", async () => {
		let count = 0;
		await new UpdateWalletFees(
			makeAccountRepo(),
			makeFeesRepo(makeFees(), {
				update: async () => {
					count++;
				},
			}),
		).execute(validInput);
		assert.equal(count, 1);
	});
});
