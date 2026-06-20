import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IWalletRulesRepository } from "@ledger/shared";
import { WalletRuleNotFound, WalletRules } from "@ledger/shared";
import { UpdateWalletRule } from "@/application/usecase/Wallet/rules/UpdateRuleAccount";

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

describe("UpdateWalletRule — use case", () => {
	it("throws WalletRuleNotFound when rule does not exist", async () => {
		await assert.rejects(
			() =>
				new UpdateWalletRule(makeRepo(null)).execute({
					walletRuleId: "ghost",
				}),
			(e) => e instanceof WalletRuleNotFound,
		);
	});

	it("returns walletRuleId", async () => {
		const result = await new UpdateWalletRule(makeRepo()).execute({
			walletRuleId: "wrul_001",
		});
		assert.equal(result.walletRuleId, "wrul_001");
	});

	it("updates limitTransactionPixIn", async () => {
		let saved: any;
		await new UpdateWalletRule(
			makeRepo(makeWalletRule(), {
				update: async (r) => {
					saved = r;
				},
			}),
		).execute({ walletRuleId: "wrul_001", limitTransactionPixIn: 500 });
		assert.equal(saved.get("limitTransactionPixIn"), 500);
	});

	it("updates limitTransactionDailyIn and DailyOut", async () => {
		let saved: any;
		await new UpdateWalletRule(
			makeRepo(makeWalletRule(), {
				update: async (r) => {
					saved = r;
				},
			}),
		).execute({
			walletRuleId: "wrul_001",
			limitTransactionDailyIn: 10000,
			limitTransactionDailyOut: 5000,
		});
		assert.equal(saved.get("limitTransactionDailyIn"), 10000);
		assert.equal(saved.get("limitTransactionDailyOut"), 5000);
	});

	it("sets pixKeyBlocked to true", async () => {
		let saved: any;
		await new UpdateWalletRule(
			makeRepo(makeWalletRule(), {
				update: async (r) => {
					saved = r;
				},
			}),
		).execute({ walletRuleId: "wrul_001", pixKeyBlocked: true });
		assert.equal(saved.get("pixKeyBlocked"), true);
	});

	it("sets limits to null (explicit null clears the value)", async () => {
		const rule = WalletRules.restore({
			id: "wrul_001",
			walletId: "wal_001",
			limitTransactionPixIn: 1000,
			limitTransactionPixOut: 500,
			limitTransactionDailyIn: 5000,
			limitTransactionDailyOut: 2500,
			pixKeyBlocked: false,
		});
		let saved: any;
		await new UpdateWalletRule(
			makeRepo(rule, {
				update: async (r) => {
					saved = r;
				},
			}),
		).execute({ walletRuleId: "wrul_001", limitTransactionPixIn: null });
		assert.equal(saved.get("limitTransactionPixIn"), null);
	});

	it("does not change fields when undefined is passed", async () => {
		const rule = WalletRules.restore({
			id: "wrul_001",
			walletId: "wal_001",
			limitTransactionPixIn: 999,
			limitTransactionPixOut: null,
			limitTransactionDailyIn: null,
			limitTransactionDailyOut: null,
			pixKeyBlocked: true,
		});
		let saved: any;
		await new UpdateWalletRule(
			makeRepo(rule, {
				update: async (r) => {
					saved = r;
				},
			}),
		).execute({ walletRuleId: "wrul_001", limitTransactionPixIn: undefined });
		assert.equal(saved.get("limitTransactionPixIn"), 999);
		assert.equal(saved.get("pixKeyBlocked"), true);
	});

	it("calls update exactly once", async () => {
		let count = 0;
		await new UpdateWalletRule(
			makeRepo(makeWalletRule(), {
				update: async () => {
					count++;
				},
			}),
		).execute({ walletRuleId: "wrul_001", pixKeyBlocked: true });
		assert.equal(count, 1);
	});

	it("updates documentWhitelistBlocked and documentWhitelist", async () => {
		let saved: any;
		await new UpdateWalletRule(
			makeRepo(makeWalletRule(), {
				update: async (r) => {
					saved = r;
				},
			}),
		).execute({
			walletRuleId: "wrul_001",
			documentWhitelistBlocked: true,
			documentWhitelist: ["11144477735"],
		});
		assert.equal(saved.get("documentWhitelistBlocked"), true);
		assert.deepEqual(saved.get("documentWhitelist"), ["11144477735"]);
	});

	it("clears documentWhitelist when explicit null is passed", async () => {
		const rule = WalletRules.restore({
			id: "wrul_001",
			walletId: "wal_001",
			limitTransactionPixIn: null,
			limitTransactionPixOut: null,
			limitTransactionDailyIn: null,
			limitTransactionDailyOut: null,
			pixKeyBlocked: false,
			documentWhitelistBlocked: true,
			documentWhitelist: ["11144477735"],
		});
		let saved: any;
		await new UpdateWalletRule(
			makeRepo(rule, {
				update: async (r) => {
					saved = r;
				},
			}),
		).execute({ walletRuleId: "wrul_001", documentWhitelist: null });
		assert.equal(saved.get("documentWhitelist"), null);
	});
});
