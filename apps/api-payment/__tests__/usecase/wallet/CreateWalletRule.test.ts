import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IWalletRepository, IWalletRulesRepository } from "@ledger/shared";
import {
	Wallet,
	WalletNotFoundError,
	WalletRuleAlreadyExistsError,
	WalletRules,
} from "@ledger/shared";
import { CreateWalletRule } from "@/application/usecase/Wallet/rules/CreateRuleAccount";

function makeWallet() {
	return Wallet.restore({ id: "wal_001", merchantId: "merch_001" });
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

function makeWalletRulesRepo(
	existing: WalletRules | null = null,
): IWalletRulesRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => null,
		findByWalletId: async () => existing,
		findByAccountId: async () => null,
		update: async () => {},
		resetDaily: async () => {},
	};
}

const validInput = { walletId: "wal_001" };

describe("CreateWalletRule — use case", () => {
	it("returns walletRuleId on success", async () => {
		const uc = new CreateWalletRule(makeWalletRepo(), makeWalletRulesRepo());
		const result = await uc.execute(validInput);
		assert.ok(result.walletRuleId.length > 0);
	});

	it("throws WalletNotFoundError when wallet does not exist", async () => {
		const uc = new CreateWalletRule(
			makeWalletRepo(null as any),
			makeWalletRulesRepo(),
		);
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof WalletNotFoundError,
		);
	});

	it("throws WalletRuleAlreadyExistsError when rule already exists", async () => {
		const existing = WalletRules.restore({
			id: "rule_001",
			walletId: "wal_001",
			limitTransactionPixIn: null,
			limitTransactionPixOut: null,
			limitTransactionDailyIn: null,
			limitTransactionDailyOut: null,
			transactionDailyInAmount: 0,
			transactionDailyOutAmount: 0,
			pixKeyBlocked: false,
			pixKey: null,
		});
		const uc = new CreateWalletRule(
			makeWalletRepo(),
			makeWalletRulesRepo(existing),
		);
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof WalletRuleAlreadyExistsError,
		);
	});

	it("stores provided limits", async () => {
		let captured: any;
		const rulesRepo: IWalletRulesRepository = {
			...makeWalletRulesRepo(),
			create: async (r) => {
				captured = r;
			},
		};
		const uc = new CreateWalletRule(makeWalletRepo(), rulesRepo);
		await uc.execute({
			walletId: "wal_001",
			limitTransactionPixIn: 5000,
			limitTransactionPixOut: 3000,
			pixKeyBlocked: true,
			pixKey: "test@email.com",
		});
		assert.equal(captured.get("limitTransactionPixIn"), 5000);
		assert.equal(captured.get("limitTransactionPixOut"), 3000);
		assert.equal(captured.get("pixKeyBlocked"), true);
		assert.equal(captured.get("pixKey"), "test@email.com");
	});

	it("defaults pixKeyBlocked to false when not provided", async () => {
		let captured: any;
		const rulesRepo: IWalletRulesRepository = {
			...makeWalletRulesRepo(),
			create: async (r) => {
				captured = r;
			},
		};
		const uc = new CreateWalletRule(makeWalletRepo(), rulesRepo);
		await uc.execute(validInput);
		assert.equal(captured.get("pixKeyBlocked"), false);
	});
});
