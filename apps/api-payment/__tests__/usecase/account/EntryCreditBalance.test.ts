import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	AccountNotFound,
	Accounts,
	BalanceNotFound,
	Balances,
	type IAccountBalanceHistoryRepository,
	type IAccountRepository,
	type IBalanceRepository,
	type ILedgerEntryRepository,
	type ILedgerTransactionRepository,
} from "@ledger/shared";
import { EntryCreditBalance } from "@/application/usecase/Account/EntryCreditBalance";

function makeAccount(overrides: Record<string, unknown> = {}) {
	return Accounts.restore({
		id: "acc_001",
		organizationId: "org_001",
		parentAccountId: null,
		accPixIn: null,
		accPixOut: null,
		bookId: "book_001",
		customerId: "cus_001",
		merchantId: "mer_001",
		providerId: "prov_001",
		status: "active",
		bankCode: "001",
		bankIspb: "00000001",
		bankName: "Banco do Brasil",
		agency: "0001",
		accountNumber: "123456",
		documentNumber: "12345678901",
		holder: "Test Corp",
		idExternal: "ext_001",
		costPixIn: 0,
		costPixOut: 0,
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
		...overrides,
	} as Parameters<typeof Accounts.restore>[0]);
}

function makeBalance(available = 100_00) {
	return Balances.restore({
		id: "bal_001",
		accountId: "acc_001",
		walletId: "",
		assetCode: "BRL",
		available,
		onHold: 0,
		blocked: 0,
		version: 0,
	});
}

function makeAccountRepo(
	account = makeAccount(),
	overrides: Partial<IAccountRepository> = {},
): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => account,
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
		...overrides,
	};
}

function makeBalanceRepo(
	balance = makeBalance(),
	overrides: Partial<IBalanceRepository> = {},
): IBalanceRepository {
	return {
		createMany: async () => {},
		createManyTx: async () => {},
		findByAccountId: async () => balance,
		findByWalletId: async () => null,
		update: async (b: Balances) => b,
		updateTx: async (b: Balances) => b,
		...overrides,
	};
}

function makeLedgerTxRepo(
	overrides: Partial<ILedgerTransactionRepository> = {},
): ILedgerTransactionRepository {
	return { createTx: async () => {}, ...overrides };
}

function makeLedgerEntryRepo(
	overrides: Partial<ILedgerEntryRepository> = {},
): ILedgerEntryRepository {
	return {
		create: async () => {},
		createManyTx: async () => {},
		findByTransactionId: async () => [],
		...overrides,
	};
}

function makeHistoryRepo(
	overrides: Partial<IAccountBalanceHistoryRepository> = {},
): IAccountBalanceHistoryRepository {
	return { createTx: async () => {}, ...overrides };
}

function makeSut(
	overrides: {
		accountRepo?: IAccountRepository;
		balanceRepo?: IBalanceRepository;
		ledgerTxRepo?: ILedgerTransactionRepository;
		ledgerEntryRepo?: ILedgerEntryRepository;
		historyRepo?: IAccountBalanceHistoryRepository;
	} = {},
) {
	return new EntryCreditBalance(
		overrides.accountRepo ?? makeAccountRepo(),
		overrides.ledgerTxRepo ?? makeLedgerTxRepo(),
		overrides.ledgerEntryRepo ?? makeLedgerEntryRepo(),
		overrides.balanceRepo ?? makeBalanceRepo(),
		overrides.historyRepo ?? makeHistoryRepo(),
	);
}

describe("EntryCreditBalance — validações de entrada", () => {
	it("lança erro quando amount é zero", async () => {
		const sut = makeSut();
		await assert.rejects(
			() => sut.execute({ accountId: "acc_001", amount: 0 }),
			(e: Error) => e.message === "Amount must be greater than zero",
		);
	});

	it("lança erro quando amount é negativo", async () => {
		const sut = makeSut();
		await assert.rejects(
			() => sut.execute({ accountId: "acc_001", amount: -100 }),
			(e: Error) => e.message === "Amount must be greater than zero",
		);
	});
});

describe("EntryCreditBalance — validação de conta", () => {
	it("lança AccountNotFound quando conta não existe", async () => {
		const sut = makeSut({ accountRepo: makeAccountRepo(null as any) });
		await assert.rejects(
			() => sut.execute({ accountId: "acc_001", amount: 100_00 }),
			(e) => e instanceof AccountNotFound,
		);
	});
});

describe("EntryCreditBalance — validação de saldo", () => {
	it("lança BalanceNotFound quando saldo não existe", async () => {
		const sut = makeSut({ balanceRepo: makeBalanceRepo(null as any) });
		await assert.rejects(
			() => sut.execute({ accountId: "acc_001", amount: 100_00 }),
			(e) => e instanceof BalanceNotFound,
		);
	});

	it("lança erro de optimistic lock quando updateTx retorna null", async () => {
		const sut = makeSut({
			balanceRepo: makeBalanceRepo(makeBalance(), {
				updateTx: async () => null,
			}),
		});
		await assert.rejects(
			() => sut.execute({ accountId: "acc_001", amount: 100_00 }),
			(e: Error) => e.message.includes("optimistic lock"),
		);
	});
});

describe("EntryCreditBalance — output", () => {
	it("retorna transactionId, idempotencyKey e entries", async () => {
		const sut = makeSut();
		const result = await sut.execute({ accountId: "acc_001", amount: 100_00 });

		assert.ok(result.transactionId.startsWith("txn_"));
		assert.ok(result.idempotencyKey.length > 0);
		assert.equal(result.entries.length, 1);
	});

	it("entry tem direction=credit, type=adjustment, assetCode=BRL", async () => {
		const sut = makeSut();
		const result = await sut.execute({ accountId: "acc_001", amount: 50_00 });

		const entry = result.entries[0];
		assert.equal(entry.direction, "credit");
		assert.equal(entry.type, "adjustment");
		assert.equal(entry.assetCode, "BRL");
		assert.equal(entry.amount, 50_00);
	});

	it("idempotencyKey é determinístico para mesma conta/amount", async () => {
		const sut = makeSut();
		const r1 = await sut.execute({ accountId: "acc_001", amount: 100_00 });
		const r2 = await sut.execute({ accountId: "acc_001", amount: 100_00 });
		assert.equal(r1.idempotencyKey, r2.idempotencyKey);
	});
});
