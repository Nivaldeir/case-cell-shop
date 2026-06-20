import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	IBalanceRepository,
	IMerchantRepository,
	IPixKeyRepository,
	IWalletRepository,
} from "@ledger/shared";
import {
	Accounts,
	Balances,
	MerchantNotFound,
	Merchants,
	PixKey,
	Wallet,
} from "@ledger/shared";
import { GetWalletByMerchantId } from "@/application/usecase/Wallet/GetWalletByMerchantId";

function makeWallet() {
	return Wallet.restore({
		id: "wal_001",
		merchantId: "merch_001",
		accPixIn: "acc_in",
		accPixOut: "acc_out",
		pixKeyId: "pix_001",
	});
}

function makeBalance() {
	return Balances.restore({
		id: "bal_001",
		walletId: "wal_001",
		assetCode: "BRL",
		available: 500,
		onHold: 100,
		blocked: 50,
		version: 1,
	});
}

function makeAccount(id: string, holder: string) {
	return Accounts.restore({
		id,
		providerId: "prov_001",
		status: "active",
		type: "nominal",
		costPixIn: 0,
		costPixOut: 0,
		bankCode: "000",
		bankIspb: "00000000",
		bankName: "Bank",
		agency: "0001",
		accountNumber: "12345",
		documentNumber: "12345678900",
		holder,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

function makeMerchant() {
	return Merchants.restore({
		id: "merch_001",
		organizationId: "org_001",
		legalName: "Merchant Name",
		legalDocument: "12345678000199",
		status: "active",
	});
}

function makeWalletRepo(wallet = makeWallet()): IWalletRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => wallet,
		findByAccountId: async () => wallet,
		findByMerchantId: async () => wallet,
		update: async () => {},
		updateTx: async () => {},
	};
}

function makeBalanceRepo(balance = makeBalance()): IBalanceRepository {
	return {
		createMany: async () => {},
		createManyTx: async () => {},
		findByAccountId: async () => null,
		findByWalletId: async () => balance,
		update: async () => null,
		updateTx: async () => null,
	};
}

function makeAccountRepo(): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async (id) => makeAccount(id, `Holder ${id}`),
		findMany: async () => ({ items: [], totalItems: 0 }),
	};
}

function makeMerchantRepo(): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => makeMerchant(),
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function makePixKeyRepo(): IPixKeyRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findByWalletId: async () => [],
		findByAccountId: async () => [],
		findByAccountIds: async () => [],
		findById: async (id) =>
			PixKey.restore({
				id,
				walletId: "wal_001",
				type: "evp",
				key: "pix-key-value",
				internal: false,
			}),
		findByKey: async () => null,
	};
}

describe("GetWalletByMerchantId — use case", () => {
	it("throws MerchantNotFound when wallet does not exist", async () => {
		const uc = new GetWalletByMerchantId(
			makeWalletRepo(null as any),
			makeBalanceRepo(),
			makeAccountRepo(),
			makeMerchantRepo(),
			makePixKeyRepo(),
		);
		await assert.rejects(
			() => uc.execute({ merchantId: "merch_001" }),
			(e) => e instanceof MerchantNotFound,
		);
	});

	it("returns wallet data with balance", async () => {
		const uc = new GetWalletByMerchantId(
			makeWalletRepo(),
			makeBalanceRepo(),
			makeAccountRepo(),
			makeMerchantRepo(),
			makePixKeyRepo(),
		);
		const result = await uc.execute({ merchantId: "merch_001" });
		assert.equal(result[0]?.id, "wal_001");
		assert.equal(result[0]?.merchantId, "merch_001");
		assert.equal(result[0]?.merchant.name, "Merchant Name");
		assert.equal(result[0]?.accPixInData?.name, "Holder acc_in");
		assert.equal(result[0]?.accPixOutData?.name, "Holder acc_out");
		assert.equal(result[0]?.pixKeyData?.id, "pix_001");
		assert.equal(result[0]?.pixKeyData?.key, "pix-key-value");
		assert.equal(result[0]?.balance?.available, 500);
		assert.equal(result[0]?.balance?.onHold, 100);
		assert.equal(result[0]?.balance?.blocked, 50);
		assert.equal(result[0]?.balance?.assetCode, "BRL");
	});

	it("returns zero balance when balance not found", async () => {
		const uc = new GetWalletByMerchantId(
			makeWalletRepo(),
			makeBalanceRepo(null as any),
			makeAccountRepo(),
			makeMerchantRepo(),
			makePixKeyRepo(),
		);
		const result = await uc.execute({ merchantId: "merch_001" });
		assert.equal(result[0]?.balance?.available, 0);
		assert.equal(result[0]?.balance?.onHold, 0);
		assert.equal(result[0]?.balance?.blocked, 0);
	});

	it("returns accPixIn and accPixOut from wallet", async () => {
		const uc = new GetWalletByMerchantId(
			makeWalletRepo(),
			makeBalanceRepo(),
			makeAccountRepo(),
			makeMerchantRepo(),
			makePixKeyRepo(),
		);
		const result = await uc.execute({ merchantId: "merch_001" });
		assert.equal(result[0]?.accPixIn, "acc_in");
		assert.equal(result[0]?.accPixOut, "acc_out");
	});
});
