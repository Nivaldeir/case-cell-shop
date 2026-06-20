import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IWalletRepository, IWalletRulesRepository } from "@ledger/shared";
import { Wallet, WalletRuleAlreadyExistsError } from "@ledger/shared";
import { CreateWalletRule } from "@/application/usecase/Wallet/rules/CreateRuleAccount";

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

describe("CreateWalletRule — use case", () => {
	it("throws WalletNotFoundError when wallet does not exist", async () => {
		const { WalletNotFoundError } = await import("@ledger/shared");
		await assert.rejects(
			() =>
				new CreateWalletRule(makeWalletRepo(null), makeRuleRepo()).execute({
					walletId: "ghost",
				}),
			(e) => e instanceof WalletNotFoundError,
		);
	});

	it("throws WalletRuleAlreadyExistsError when rule already exists", async () => {
		const { WalletRules } = await import("@ledger/shared");
		const existingRule = WalletRules.restore({
			id: "wrul_existing",
			walletId: "wal_001",
			pixKeyBlocked: false,
		});
		await assert.rejects(
			() =>
				new CreateWalletRule(
					makeWalletRepo(),
					makeRuleRepo({ findByWalletId: async () => existingRule }),
				).execute({ walletId: "wal_001" }),
			(e) => e instanceof WalletRuleAlreadyExistsError,
		);
	});

	it("returns walletRuleId with 'wrul_' prefix", async () => {
		const result = await new CreateWalletRule(
			makeWalletRepo(),
			makeRuleRepo(),
		).execute({ walletId: "wal_001" });
		assert.match(result.walletRuleId, /^wrul_/);
	});

	it("creates rule with null limits when not provided", async () => {
		let captured: any;
		await new CreateWalletRule(
			makeWalletRepo(),
			makeRuleRepo({
				create: async (r) => {
					captured = r;
				},
			}),
		).execute({ walletId: "wal_001" });
		assert.equal(captured.get("limitTransactionPixIn"), null);
		assert.equal(captured.get("limitTransactionPixOut"), null);
		assert.equal(captured.get("limitTransactionDailyIn"), null);
		assert.equal(captured.get("limitTransactionDailyOut"), null);
	});

	it("creates rule with pixKeyBlocked=false when not provided", async () => {
		let captured: any;
		await new CreateWalletRule(
			makeWalletRepo(),
			makeRuleRepo({
				create: async (r) => {
					captured = r;
				},
			}),
		).execute({ walletId: "wal_001" });
		assert.equal(captured.get("pixKeyBlocked"), false);
	});

	it("stores explicit limit values when provided", async () => {
		let captured: any;
		await new CreateWalletRule(
			makeWalletRepo(),
			makeRuleRepo({
				create: async (r) => {
					captured = r;
				},
			}),
		).execute({
			walletId: "wal_001",
			limitTransactionPixIn: 1000,
			limitTransactionPixOut: 500,
			limitTransactionDailyIn: 5000,
			limitTransactionDailyOut: 2500,
			pixKeyBlocked: true,
		});
		assert.equal(captured.get("limitTransactionPixIn"), 1000);
		assert.equal(captured.get("limitTransactionPixOut"), 500);
		assert.equal(captured.get("limitTransactionDailyIn"), 5000);
		assert.equal(captured.get("limitTransactionDailyOut"), 2500);
		assert.equal(captured.get("pixKeyBlocked"), true);
	});

	it("links rule to the wallet", async () => {
		let captured: any;
		await new CreateWalletRule(
			makeWalletRepo(),
			makeRuleRepo({
				create: async (r) => {
					captured = r;
				},
			}),
		).execute({ walletId: "wal_001" });
		assert.equal(captured.get("walletId"), "wal_001");
	});

	it("defaults documentWhitelistBlocked to false and documentWhitelist to null", async () => {
		let captured: any;
		await new CreateWalletRule(
			makeWalletRepo(),
			makeRuleRepo({
				create: async (r) => {
					captured = r;
				},
			}),
		).execute({ walletId: "wal_001" });
		assert.equal(captured.get("documentWhitelistBlocked"), false);
		assert.equal(captured.get("documentWhitelist"), null);
	});

	it("stores documentWhitelist values when provided", async () => {
		let captured: any;
		await new CreateWalletRule(
			makeWalletRepo(),
			makeRuleRepo({
				create: async (r) => {
					captured = r;
				},
			}),
		).execute({
			walletId: "wal_001",
			documentWhitelistBlocked: true,
			documentWhitelist: ["11144477735", "11222333000181"],
		});
		assert.equal(captured.get("documentWhitelistBlocked"), true);
		assert.deepEqual(captured.get("documentWhitelist"), [
			"11144477735",
			"11222333000181",
		]);
	});
});
