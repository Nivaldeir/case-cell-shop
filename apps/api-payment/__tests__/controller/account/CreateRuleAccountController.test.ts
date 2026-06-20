import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IWalletRepository, IWalletRulesRepository } from "@ledger/shared";
import { Wallet } from "@ledger/shared";
import type { Request, Response } from "express";
import { CreateWalletRule } from "@/application/usecase/Wallet/rules/CreateRuleAccount";
import { CreateWalletRuleController } from "@/presentation/api/controllers/wallets/rule-wallets/CreateRuleAccountController";

function makeWallet(): Wallet {
	return Wallet.restore({
		id: "wal_001",
		merchantId: "merch_001",
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

function makeWalletRepo(
	wallet: Wallet | null = makeWallet(),
): IWalletRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => wallet,
		findByAccountId: async () => null,
		findByMerchantId: async () => null,
		update: async () => {},
		updateTx: async () => {},
	};
}

function makeRuleRepo(
	overrides: Partial<IWalletRulesRepository> = {},
): IWalletRulesRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => null,
		findByWalletId: async () => null,
		findByAccountId: async () => null,
		update: async () => {},
		resetDaily: async () => {},
		...overrides,
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

describe("CreateWalletRuleController — unit", () => {
	it("responds 201 on success", async () => {
		const ctrl = new CreateWalletRuleController(
			new CreateWalletRule(makeWalletRepo(), makeRuleRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ walletId: "wal_001" }),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 201);
	});

	it("response body has error:false and walletRuleId in data", async () => {
		const ctrl = new CreateWalletRuleController(
			new CreateWalletRule(makeWalletRepo(), makeRuleRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ walletId: "wal_001" }),
			res as unknown as Response,
		);
		const body = res.body as {
			error: boolean;
			data: { walletRuleId: string };
		};
		assert.equal(body.error, false);
		assert.match(body.data.walletRuleId, /^wrul_/);
	});

	it("forwards walletId to the use case", async () => {
		let capturedWalletId: string | undefined;
		const walletRepo: IWalletRepository = {
			...makeWalletRepo(),
			findById: async (id) => {
				capturedWalletId = id;
				return makeWallet();
			},
		};
		const ctrl = new CreateWalletRuleController(
			new CreateWalletRule(walletRepo, makeRuleRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ walletId: "wal_target" }),
			res as unknown as Response,
		);
		assert.equal(capturedWalletId, "wal_target");
	});
});
