import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	IBalanceRepository,
	IFeesRepository,
	IMerchantRepository,
	IRoutingRuleRepository,
	IWalletRepository,
	IWalletRulesRepository,
} from "@ledger/shared";
import { Merchants } from "@ledger/shared";
import type { Request, Response } from "express";
import { CreateWallet } from "@/application/usecase/Wallet/CreateWallet";
import { CreateWalletController } from "@/presentation/api/controllers/wallets/CreateWalletController";

function makeMerchantRepo(): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () =>
			Merchants.restore({
				id: "merch_001",
				organizationId: "org_001",
				legalName: "Acme",
				legalDocument: "12345678000100",
				status: "active",
			}),
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function makeAccountRepo(): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
	};
}

function makeWalletRepo(): IWalletRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => null,
		findByMerchantId: async () => null,
		update: async () => {},
		updateTx: async () => {},
	};
}

function makeBalanceRepo(): IBalanceRepository {
	return {
		createMany: async () => {},
		createManyTx: async () => {},
		findByAccountId: async () => null,
		findByWalletId: async () => null,
		update: async () => null,
		updateTx: async () => null,
	};
}

function makeFeesRepo(): IFeesRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findByAccountId: async () => null,
		update: async () => {},
	};
}

function makeRoutingRepo(): IRoutingRuleRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findByWalletIds: async () => [],
		update: async () => {},
	};
}

function makeWalletRulesRepo(): IWalletRulesRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => null,
		findByWalletId: async () => null,
		findByAccountId: async () => null,
		update: async () => {},
		resetDaily: async () => {},
	};
}

function makeReq(body: Record<string, unknown>): Request {
	return { body, params: {}, query: {} } as unknown as Request;
}

type MockRes = {
	statusCode: number;
	body: unknown;
	status(c: number): MockRes;
	json(d: unknown): MockRes;
};
function makeRes(): MockRes {
	const r: MockRes = {
		statusCode: 200,
		body: undefined,
		status(c) {
			this.statusCode = c;
			return this;
		},
		json(d) {
			this.body = d;
			return this;
		},
	};
	return r;
}

function makeSut() {
	return new CreateWalletController(
		new CreateWallet(
			makeMerchantRepo(),
			makeAccountRepo(),
			makeWalletRepo(),
			makeBalanceRepo(),
			makeFeesRepo(),
			makeRoutingRepo(),
			makeWalletRulesRepo(),
		),
	);
}

describe("CreateWalletController — unit", () => {
	it("responds 201 on success", async () => {
		const ctrl = makeSut();
		const res = makeRes();
		await ctrl.handle(
			makeReq({ merchantId: "merch_001", asset: "BRL" }),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 201);
	});

	it("response body has error:false and walletId, balanceId, feesId", async () => {
		const ctrl = makeSut();
		const res = makeRes();
		await ctrl.handle(
			makeReq({ merchantId: "merch_001", asset: "BRL" }),
			res as unknown as Response,
		);
		const body = res.body as {
			error: boolean;
			data: { walletId: string; balanceId: string; feesId: string };
		};
		assert.equal(body.error, false);
		assert.match(body.data.walletId, /^wal_/);
		assert.match(body.data.balanceId, /^bal_/);
		assert.match(body.data.feesId, /^fee_/);
	});
});
