import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	IPixKeyRepository,
	IWalletRepository,
} from "@ledger/shared";
import {
	AccountNotFound,
	Accounts,
	PixKey,
	PixKeyAlreadyExistsError,
	Wallet,
	WalletNotFoundError,
} from "@ledger/shared";
import { CreatePixKey } from "@/application/usecase/Account/CreatePixKey";

function makeWallet() {
	return Wallet.restore({ id: "wal_001", merchantId: "merch_001" });
}

function makeAccount() {
	return Accounts.restore({
		id: "acc_001",
		organizationId: "org_001",
		parentAccountId: null,
		accPixIn: null,
		accPixOut: null,
		bookId: "book_001",
		customerId: "cus_001",
		merchantId: "merch_001",
		providerId: "prov_001",
		status: "active",
		bankCode: "001",
		bankIspb: "00000001",
		bankName: "Banco Test",
		agency: "0001",
		accountNumber: "123456",
		documentNumber: "12345678901",
		holder: "Test",
		idExternal: "ext_001",
		costPixIn: 0,
		costPixOut: 0,
	} as Parameters<typeof Accounts.restore>[0]);
}

function makeWalletRepo(wallet = makeWallet()): IWalletRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => wallet,
		findByMerchantId: async () => wallet,
		update: async () => {},
		updateTx: async () => {},
	};
}

function makeAccountRepo(throws = false): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => {
			if (throws) throw new Error("not found");
			return makeAccount();
		},
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
	};
}

function makePixKeyRepo(existing: PixKey | null = null): IPixKeyRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findByAccountId: async () => [],
		findByAccountIds: async () => [],
		findByMerchantId: async () => [],
		findByWalletScope: async () => [],
		findById: async () => null,
		findByKey: async () => existing,
	};
}

const validInput = {
	walletId: "wal_001",
	accountId: "acc_001",
	key: "test@email.com",
	type: "email" as const,
	internal: true,
};

describe("CreatePixKey — use case", () => {
	it("returns pixKeyId with 'pix_' prefix", async () => {
		const uc = new CreatePixKey(
			makeAccountRepo(),
			makeWalletRepo(),
			makePixKeyRepo(),
		);
		const result = await uc.execute(validInput);
		assert.match(result.pixKeyId, /^pix_/);
	});

	it("throws WalletNotFoundError when wallet does not exist", async () => {
		const uc = new CreatePixKey(
			makeAccountRepo(),
			makeWalletRepo(null as any),
			makePixKeyRepo(),
		);
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof WalletNotFoundError,
		);
	});

	it("throws AccountNotFound when account lookup throws", async () => {
		const uc = new CreatePixKey(
			makeAccountRepo(true),
			makeWalletRepo(),
			makePixKeyRepo(),
		);
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof AccountNotFound,
		);
	});

	it("throws PixKeyAlreadyExistsError when key already exists", async () => {
		const existingKey = PixKey.restore({
			id: "pix_existing",
			walletId: "wal_001",
			accountId: "acc_001",
			key: "test@email.com",
			type: "email",
			internal: true,
		});
		const uc = new CreatePixKey(
			makeAccountRepo(),
			makeWalletRepo(),
			makePixKeyRepo(existingKey),
		);
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof PixKeyAlreadyExistsError,
		);
	});

	it("calls pixKeyRepository.create with correct fields", async () => {
		let captured: any;
		const pixRepo: IPixKeyRepository = {
			...makePixKeyRepo(),
			create: async (pk) => {
				captured = pk;
			},
		};
		const uc = new CreatePixKey(makeAccountRepo(), makeWalletRepo(), pixRepo);
		await uc.execute(validInput);
		assert.equal(captured.get("walletId"), "wal_001");
		assert.equal(captured.get("accountId"), "acc_001");
		assert.equal(captured.get("key"), "test@email.com");
		assert.equal(captured.get("type"), "email");
		assert.equal(captured.get("internal"), true);
	});
});
