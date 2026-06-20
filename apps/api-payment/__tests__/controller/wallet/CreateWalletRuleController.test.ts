import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IWalletRepository, IWalletRulesRepository } from "@ledger/shared";
import { Wallet } from "@ledger/shared";
import type { Request, Response } from "express";
import { CreateWalletRule } from "@/application/usecase/Wallet/rules/CreateRuleAccount";
import { CreateWalletRuleController } from "@/presentation/api/controllers/wallets/rule-wallets/CreateRuleAccountController";

function makeWalletRepo(): IWalletRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () =>
			Wallet.restore({ id: "wal_001", merchantId: "merch_001" }),
		findByMerchantId: async () => null,
		update: async () => {},
		updateTx: async () => {},
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

describe("CreateWalletRuleController — unit", () => {
	it("responds 201 on success", async () => {
		const ctrl = new CreateWalletRuleController(
			new CreateWalletRule(makeWalletRepo(), makeWalletRulesRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ walletId: "wal_001" }),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 201);
	});

	it("response body has error:false and walletRuleId", async () => {
		const ctrl = new CreateWalletRuleController(
			new CreateWalletRule(makeWalletRepo(), makeWalletRulesRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ walletId: "wal_001" }),
			res as unknown as Response,
		);
		const body = res.body as { error: boolean; data: { walletRuleId: string } };
		assert.equal(body.error, false);
		assert.ok(body.data.walletRuleId.length > 0);
	});
});
