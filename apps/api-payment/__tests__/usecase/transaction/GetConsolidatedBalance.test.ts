import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	ConsolidatedBalanceDailyItem,
	ILedgerEntryRepository,
} from "@ledger/shared";
import { GetConsolidatedBalance } from "@/application/usecase/Transaction/GetConsolidatedBalance";

const FAKE_DAILY: ConsolidatedBalanceDailyItem[] = [
	{
		date: "2026-04-21",
		saldoInicial: 500,
		entrada: 200,
		saida: 50,
		saldoFinal: 650,
	},
	{
		date: "2026-04-22",
		saldoInicial: 650,
		entrada: 100,
		saida: 30,
		saldoFinal: 720,
	},
];

function makeLedgerEntryRepo(
	result: ConsolidatedBalanceDailyItem[] = [],
	overrides: Partial<ILedgerEntryRepository> = {},
): ILedgerEntryRepository {
	return {
		create: async () => {},
		createManyTx: async () => {},
		findByTransactionId: async () => [],
		findByAccountId: async () => [],
		findFeesByTransactionIds: async () => [],
		getConsolidatedBalance: async () => result,
		...overrides,
	};
}

function makeSut(repo?: ILedgerEntryRepository) {
	return new GetConsolidatedBalance(repo ?? makeLedgerEntryRepo());
}

describe("GetConsolidatedBalance — validações de entrada", () => {
	it("lança erro quando walletId não é fornecido", async () => {
		const sut = makeSut();
		await assert.rejects(
			() => sut.execute({ walletId: "", timezone: "America/Sao_Paulo" }),
			(e: Error) => e.message.length > 0,
		);
	});
});

describe("GetConsolidatedBalance — defaults de data", () => {
	it("usa endDate como now quando não fornecido", async () => {
		let capturedFilters:
			| Parameters<ILedgerEntryRepository["getConsolidatedBalance"]>[0]
			| undefined;

		const repo = makeLedgerEntryRepo([], {
			getConsolidatedBalance: async (filters) => {
				capturedFilters = filters;
				return [];
			},
		});

		const before = new Date();
		await makeSut(repo).execute({
			walletId: "wal_001",
			timezone: "America/Sao_Paulo",
		});
		const after = new Date();

		assert.ok(capturedFilters, "filtros devem ter sido capturados");
		assert.ok(
			capturedFilters!.endDate >= before && capturedFilters!.endDate <= after,
			"endDate deve ser próximo de now()",
		);
	});

	it("usa startDate como 6 dias atrás à meia-noite quando não fornecido", async () => {
		let capturedFilters:
			| Parameters<ILedgerEntryRepository["getConsolidatedBalance"]>[0]
			| undefined;

		const repo = makeLedgerEntryRepo([], {
			getConsolidatedBalance: async (filters) => {
				capturedFilters = filters;
				return [];
			},
		});

		const now = new Date();
		await makeSut(repo).execute({
			walletId: "wal_001",
			timezone: "America/Sao_Paulo",
		});

		const expected = new Date(now);
		expected.setDate(expected.getDate() - 6);
		expected.setHours(0, 0, 0, 0);

		assert.equal(
			capturedFilters!.startDate.toDateString(),
			expected.toDateString(),
			"startDate deve ser a data de 6 dias atrás",
		);
		assert.equal(
			capturedFilters!.startDate.getHours(),
			0,
			"startDate deve ser à meia-noite",
		);
	});

	it("usa startDate e endDate fornecidos quando presentes", async () => {
		let capturedFilters:
			| Parameters<ILedgerEntryRepository["getConsolidatedBalance"]>[0]
			| undefined;

		const repo = makeLedgerEntryRepo([], {
			getConsolidatedBalance: async (filters) => {
				capturedFilters = filters;
				return [];
			},
		});

		const startDate = new Date("2026-04-01T00:00:00Z");
		const endDate = new Date("2026-04-07T23:59:59Z");

		await makeSut(repo).execute({
			walletId: "wal_001",
			timezone: "America/Sao_Paulo",
			startDate,
			endDate,
		});

		assert.equal(
			capturedFilters!.startDate.toISOString(),
			startDate.toISOString(),
		);
		assert.equal(capturedFilters!.endDate.toISOString(), endDate.toISOString());
	});
});

describe("GetConsolidatedBalance — repasse de filtros", () => {
	it("passa walletId e timezone para o repositório", async () => {
		let capturedFilters:
			| Parameters<ILedgerEntryRepository["getConsolidatedBalance"]>[0]
			| undefined;

		const repo = makeLedgerEntryRepo([], {
			getConsolidatedBalance: async (filters) => {
				capturedFilters = filters;
				return [];
			},
		});

		await makeSut(repo).execute({
			walletId: "wal_abc",
			timezone: "America/Manaus",
		});

		assert.equal(capturedFilters!.walletId, "wal_abc");
		assert.equal(capturedFilters!.timezone, "America/Manaus");
	});

	it("passa merchantId opcional para o repositório quando fornecido", async () => {
		let capturedFilters:
			| Parameters<ILedgerEntryRepository["getConsolidatedBalance"]>[0]
			| undefined;

		const repo = makeLedgerEntryRepo([], {
			getConsolidatedBalance: async (filters) => {
				capturedFilters = filters;
				return [];
			},
		});

		await makeSut(repo).execute({
			walletId: "wal_abc",
			timezone: "America/Sao_Paulo",
			merchantId: "mer_xyz",
		});

		assert.equal(capturedFilters!.merchantId, "mer_xyz");
	});
});

describe("GetConsolidatedBalance — output", () => {
	it("retorna array vazio quando repositório retorna vazio", async () => {
		const sut = makeSut(makeLedgerEntryRepo([]));
		const result = await sut.execute({
			walletId: "wal_001",
			timezone: "America/Sao_Paulo",
		});
		assert.deepEqual(result, []);
	});

	it("retorna os dados diários do repositório sem modificação", async () => {
		const sut = makeSut(makeLedgerEntryRepo(FAKE_DAILY));
		const result = await sut.execute({
			walletId: "wal_001",
			timezone: "America/Sao_Paulo",
		});

		assert.equal(result.length, 2);
		assert.equal(result[0]!.date, "2026-04-21");
		assert.equal(result[0]!.saldoInicial, 500);
		assert.equal(result[0]!.entrada, 200);
		assert.equal(result[0]!.saida, 50);
		assert.equal(result[0]!.saldoFinal, 650);
	});

	it("cada item tem os campos obrigatórios: date, saldoInicial, entrada, saida, saldoFinal", async () => {
		const sut = makeSut(makeLedgerEntryRepo(FAKE_DAILY));
		const result = await sut.execute({
			walletId: "wal_001",
			timezone: "America/Sao_Paulo",
		});

		for (const item of result) {
			assert.ok(typeof item.date === "string", "date deve ser string");
			assert.ok(
				typeof item.saldoInicial === "number",
				"saldoInicial deve ser number",
			);
			assert.ok(typeof item.entrada === "number", "entrada deve ser number");
			assert.ok(typeof item.saida === "number", "saida deve ser number");
			assert.ok(
				typeof item.saldoFinal === "number",
				"saldoFinal deve ser number",
			);
		}
	});
});
