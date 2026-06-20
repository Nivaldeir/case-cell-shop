import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IWalletRulesRepository } from "@ledger/shared";
import { WalletRules } from "@ledger/shared";
import type { Request, Response } from "express";
import { UpdateWalletRule } from "@/application/usecase/Wallet/rules/UpdateRuleAccount";
import { UpdateWalletRuleController } from "@/presentation/api/controllers/wallets/rule-wallets/UpdateRuleAccountController";

function makeWalletRule(): WalletRules {
	return WalletRules.restore({
		id: "wrul_001",
		walletId: "wal_001",
		limitTransactionPixIn: null,
		limitTransactionPixOut: null,
		limitTransactionDailyIn: null,
		limitTransactionDailyOut: null,
		pixKeyBlocked: false,
	});
}

function makeRepo(
	rule: WalletRules | null = makeWalletRule(),
	overrides: Partial<IWalletRulesRepository> = {},
): IWalletRulesRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => rule,
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

describe("UpdateWalletRuleController — unit", () => {
	it("responds 200 on success", async () => {
		const ctrl = new UpdateWalletRuleController(
			new UpdateWalletRule(makeRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ walletRuleId: "wrul_001", pixKeyBlocked: true }),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 200);
	});

	it("response body has error:false and walletRuleId in data", async () => {
		const ctrl = new UpdateWalletRuleController(
			new UpdateWalletRule(makeRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({ walletRuleId: "wrul_001", pixKeyBlocked: false }),
			res as unknown as Response,
		);
		const body = res.body as {
			error: boolean;
			data: { walletRuleId: string };
		};
		assert.equal(body.error, false);
		assert.equal(body.data.walletRuleId, "wrul_001");
	});

	it("forwards body fields to use case", async () => {
		let saved: any;
		const repo = makeRepo(makeWalletRule(), {
			update: async (r) => {
				saved = r;
			},
		});
		const ctrl = new UpdateWalletRuleController(new UpdateWalletRule(repo));
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				walletRuleId: "wrul_001",
				limitTransactionPixIn: 1000,
				pixKeyBlocked: true,
			}),
			res as unknown as Response,
		);
		assert.equal(saved.get("limitTransactionPixIn"), 1000);
		assert.equal(saved.get("pixKeyBlocked"), true);
	});
});
