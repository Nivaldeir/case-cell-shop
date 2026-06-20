/**
 * LedgerEntryRepository.getConsolidatedBalance — integration tests.
 *
 * Uses the PostgreSQL testcontainer started in setup.ts.
 * FK checks are bypassed per-transaction via SET LOCAL session_replication_role
 * because ledger entries reference payment transactions (separate domain boundary).
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import {
	AccountBalanceHistory,
	AccountBalanceHistoryRepository,
	BalanceRepository,
	Balances,
	GenerateId,
	LedgerEntry,
	LedgerEntryRepository,
	LedgerTransaction,
	LedgerTransactionRepository,
	MerchantRepository,
	Merchants,
	OrganizationRepository,
	Organizations,
	runInTransaction,
	Wallet,
	WalletRepository,
} from "@ledger/shared";
import { sql } from "drizzle-orm";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeOrg() {
	return Organizations.create({
		externalId: randomUUID(),
		parentOrganizationId: null,
		legalName: `Org ${randomUUID().slice(0, 8)}`,
		legalDocument: String(Math.floor(Math.random() * 9e13)).padStart(14, "0"),
		status: "active",
	});
}

function makeMerchant(organizationId: string) {
	return Merchants.create({
		organizationId,
		legalName: `Merchant ${randomUUID().slice(0, 8)}`,
		legalDocument: String(Math.floor(Math.random() * 9e13)).padStart(14, "0"),
		status: "active",
	});
}

function makeWallet(merchantId: string) {
	return Wallet.create({ merchantId });
}

function makeBalance(accountId: string, walletId: string, available = 0) {
	return Balances.restore({
		id: GenerateId.generate("bal"),
		accountId,
		walletId,
		assetCode: "BRL",
		available,
		onHold: 0,
		blocked: 0,
		version: 1,
	});
}

async function insertLedgerEntry(opts: {
	accountId: string;
	walletId: string;
	direction: "credit" | "debit";
	amount: number;
	createdAt?: Date;
}) {
	const ledgerTxId = GenerateId.generate("txn");
	const fakeTransactionId = randomUUID(); // uuid format, FK bypassed via SET LOCAL

	await runInTransaction(async (tx) => {
		await tx.execute(sql`SET LOCAL session_replication_role = 'replica'`);

		const ledgerTx = LedgerTransaction.restore({
			id: ledgerTxId,
			idempotencyKey: randomUUID(),
			createdAt: opts.createdAt ?? new Date(),
			walletId: opts.walletId,
			entries: [],
		});
		await new LedgerTransactionRepository().createTx(ledgerTx, tx);

		const entry = LedgerEntry.restore({
			id: GenerateId.generate("lgr"),
			transactionId: fakeTransactionId,
			ledgerTransactionId: ledgerTxId,
			accountId: opts.accountId,
			direction: opts.direction,
			type: "payment",
			assetCode: "BRL",
			amount: opts.amount,
			idempotencyKey: randomUUID(),
			createdAt: opts.createdAt ?? new Date(),
		});
		await new LedgerEntryRepository().createManyTx([entry], tx);

		return entry;
	});
}

async function insertLedgerEntryWithHistory(opts: {
	accountId: string;
	walletId: string;
	direction: "credit" | "debit";
	amount: number;
	balanceBefore: number;
	balanceAfter: number;
	createdAt?: Date;
}) {
	const ledgerTxId = GenerateId.generate("txn");
	const fakeTransactionId = randomUUID();

	await runInTransaction(async (tx) => {
		await tx.execute(sql`SET LOCAL session_replication_role = 'replica'`);

		const ledgerTx = LedgerTransaction.restore({
			id: ledgerTxId,
			idempotencyKey: randomUUID(),
			createdAt: opts.createdAt ?? new Date(),
			walletId: opts.walletId,
			entries: [],
		});
		await new LedgerTransactionRepository().createTx(ledgerTx, tx);

		const entry = LedgerEntry.restore({
			id: GenerateId.generate("lgr"),
			transactionId: fakeTransactionId,
			ledgerTransactionId: ledgerTxId,
			accountId: opts.accountId,
			direction: opts.direction,
			type: "payment",
			assetCode: "BRL",
			amount: opts.amount,
			idempotencyKey: randomUUID(),
			createdAt: opts.createdAt ?? new Date(),
		});
		await new LedgerEntryRepository().createManyTx([entry], tx);

		const history = AccountBalanceHistory.create({
			ledgerEntryId: entry.get("id")!,
			walletId: opts.walletId,
			balanceId: GenerateId.generate("bal"),
			balanceBefore: opts.balanceBefore,
			balanceAfter: opts.balanceAfter,
		});
		await new AccountBalanceHistoryRepository().createTx(history, tx);
	});
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("LedgerEntryRepository.getConsolidatedBalance (integration)", {
	timeout: 60_000,
}, () => {
	let repo: LedgerEntryRepository;
	let accountId: string;
	let walletId: string;

	before(async () => {
		repo = new LedgerEntryRepository();

		const orgRepo = new OrganizationRepository();
		const merchantRepo = new MerchantRepository();
		const walletRepo = new WalletRepository();
		const balanceRepo = new BalanceRepository();

		const org = makeOrg();
		await orgRepo.create(org);

		const merchant = makeMerchant(org.get("id")!);
		await merchantRepo.create(merchant);

		const wallet = makeWallet(merchant.get("id")!);
		await walletRepo.create(wallet);
		walletId = wallet.get("id")!;

		// accountId sem FK real — bypass via SET LOCAL ao inserir ledger entries
		accountId = GenerateId.generate("acc");

		const balance = makeBalance(accountId, walletId, 1_000_00);
		await balanceRepo.createMany([balance]);
	});

	describe("array vazio", () => {
		it("retorna [] para walletId inexistente", async () => {
			const result = await repo.getConsolidatedBalance({
				walletId: "wal_INEXISTENTE",
				startDate: new Date("2026-01-01"),
				endDate: new Date("2026-01-07"),
				timezone: "America/Sao_Paulo",
			});
			assert.deepEqual(result, []);
		});

		it("retorna [] quando não há entradas no período", async () => {
			const result = await repo.getConsolidatedBalance({
				walletId,
				startDate: new Date("2020-01-01"),
				endDate: new Date("2020-01-07"),
				timezone: "America/Sao_Paulo",
			});
			assert.deepEqual(result, []);
		});
	});

	describe("agregação diária", () => {
		it("agrupa créditos e débitos por dia e retorna saldos corretos", async () => {
			const day = new Date("2026-03-15T12:00:00Z");

			await insertLedgerEntryWithHistory({
				accountId,
				walletId,
				direction: "credit",
				amount: 300_00,
				balanceBefore: 1_000_00,
				balanceAfter: 1_300_00,
				createdAt: new Date("2026-03-15T10:00:00Z"),
			});

			await insertLedgerEntryWithHistory({
				accountId,
				walletId,
				direction: "credit",
				amount: 200_00,
				balanceBefore: 1_300_00,
				balanceAfter: 1_500_00,
				createdAt: new Date("2026-03-15T14:00:00Z"),
			});

			await insertLedgerEntryWithHistory({
				accountId,
				walletId,
				direction: "debit",
				amount: 100_00,
				balanceBefore: 1_500_00,
				balanceAfter: 1_400_00,
				createdAt: new Date("2026-03-15T16:00:00Z"),
			});

			const result = await repo.getConsolidatedBalance({
				walletId,
				startDate: new Date("2026-03-15T00:00:00Z"),
				endDate: new Date("2026-03-15T23:59:59Z"),
				timezone: "America/Sao_Paulo",
			});

			const dayResult = result.find((r) => r.date === "2026-03-15");
			assert.ok(dayResult, "deve retornar resultado para o dia 2026-03-15");
			assert.equal(
				dayResult!.entrada,
				500_00,
				"entrada deve ser soma dos créditos",
			);
			assert.equal(dayResult!.saida, 100_00, "saida deve ser soma dos débitos");
		});

		it("retorna saldoInicial e saldoFinal do account_balance_history", async () => {
			await insertLedgerEntryWithHistory({
				accountId,
				walletId,
				direction: "credit",
				amount: 150_00,
				balanceBefore: 2_000_00,
				balanceAfter: 2_150_00,
				createdAt: new Date("2026-03-20T09:00:00Z"),
			});

			await insertLedgerEntryWithHistory({
				accountId,
				walletId,
				direction: "debit",
				amount: 50_00,
				balanceBefore: 2_150_00,
				balanceAfter: 2_100_00,
				createdAt: new Date("2026-03-20T18:00:00Z"),
			});

			const result = await repo.getConsolidatedBalance({
				walletId,
				startDate: new Date("2026-03-20T00:00:00Z"),
				endDate: new Date("2026-03-20T23:59:59Z"),
				timezone: "America/Sao_Paulo",
			});

			const dayResult = result.find((r) => r.date === "2026-03-20");
			assert.ok(dayResult, "deve retornar resultado para o dia 2026-03-20");
			assert.equal(
				dayResult!.saldoInicial,
				2_000_00,
				"saldoInicial deve ser o balanceBefore da primeira entrada do dia",
			);
			assert.equal(
				dayResult!.saldoFinal,
				2_100_00,
				"saldoFinal deve ser o balanceAfter da última entrada do dia",
			);
		});

		it("retorna múltiplos dias em ordem crescente", async () => {
			await insertLedgerEntry({
				accountId,
				walletId,
				direction: "credit",
				amount: 100_00,
				createdAt: new Date("2026-04-01T10:00:00Z"),
			});

			await insertLedgerEntry({
				accountId,
				walletId,
				direction: "credit",
				amount: 200_00,
				createdAt: new Date("2026-04-02T10:00:00Z"),
			});

			await insertLedgerEntry({
				accountId,
				walletId,
				direction: "credit",
				amount: 300_00,
				createdAt: new Date("2026-04-03T10:00:00Z"),
			});

			const result = await repo.getConsolidatedBalance({
				walletId,
				startDate: new Date("2026-04-01T00:00:00Z"),
				endDate: new Date("2026-04-03T23:59:59Z"),
				timezone: "UTC",
			});

			assert.ok(result.length >= 3, "deve retornar ao menos 3 dias");

			const dates = result.map((r) => r.date);
			const sorted = [...dates].sort();
			assert.deepEqual(dates, sorted, "dias devem estar em ordem crescente");
		});

		it("cada item do resultado tem todos os campos obrigatórios com tipos corretos", async () => {
			await insertLedgerEntry({
				accountId,
				walletId,
				direction: "credit",
				amount: 50_00,
				createdAt: new Date("2026-04-10T10:00:00Z"),
			});

			const result = await repo.getConsolidatedBalance({
				walletId,
				startDate: new Date("2026-04-10T00:00:00Z"),
				endDate: new Date("2026-04-10T23:59:59Z"),
				timezone: "America/Sao_Paulo",
			});

			assert.ok(result.length >= 1);
			for (const item of result) {
				assert.ok(typeof item.date === "string");
				assert.ok(typeof item.saldoInicial === "number");
				assert.ok(typeof item.entrada === "number");
				assert.ok(typeof item.saida === "number");
				assert.ok(typeof item.saldoFinal === "number");
			}
		});
	});
});
