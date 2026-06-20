import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WalletRuleDocumentNotAllowedError, WalletRules } from "@ledger/shared";

const baseProps = {
	walletId: "wal_123",
	limitTransactionPixIn: 1000,
	limitTransactionPixOut: 1000,
	limitTransactionDailyIn: 5000,
	limitTransactionDailyOut: 5000,
	transactionDailyInAmount: 0,
	transactionDailyOutAmount: 0,
	pixKeyBlocked: false,
	pixKey: null,
};

describe("WalletRules — domain entity", () => {
	it("creates with a generated id prefixed 'wrul_'", () => {
		const rule = WalletRules.create(baseProps);
		assert.match(rule.get("id"), /^wrul_/);
	});

	it("blocks when amount exceeds limitTransactionPixOut", () => {
		const rule = WalletRules.create(baseProps);
		assert.equal(rule.blocked({ pixKey: "abc", amount: 1001 }), true);
	});

	it("does not block when amount is within limitTransactionPixOut", () => {
		const rule = WalletRules.create({
			...baseProps,
			limitTransactionPixOut: 2000,
		});
		assert.equal(rule.blocked({ pixKey: "abc", amount: 500 }), false);
	});

	it("blocks when pix key is blocked and key does not match", () => {
		const rule = WalletRules.create({
			...baseProps,
			limitTransactionPixIn: null,
			limitTransactionPixOut: null,
			pixKeyBlocked: true,
			pixKey: "allowed_key",
		});
		assert.equal(rule.blocked({ pixKey: "other_key", amount: 100 }), true);
	});

	it("does not block when pix key matches the allowed key", () => {
		const rule = WalletRules.create({
			...baseProps,
			limitTransactionPixIn: null,
			limitTransactionPixOut: null,
			pixKeyBlocked: true,
			pixKey: "allowed_key",
		});
		assert.equal(rule.blocked({ pixKey: "allowed_key", amount: 100 }), false);
	});

	it("restores with the given id", () => {
		const rule = WalletRules.restore({
			id: "wrul_fixed",
			...baseProps,
			pixKeyBlocked: false,
		});
		assert.equal(rule.get("id"), "wrul_fixed");
		assert.equal(rule.get("walletId"), "wal_123");
	});

	it("does not check document whitelist when documentWhitelistBlocked is false", () => {
		const rule = WalletRules.create({
			...baseProps,
			documentWhitelistBlocked: false,
			documentWhitelist: ["11122233344"],
		});
		assert.doesNotThrow(() =>
			rule.exceedsDocumentWhitelist({ document: "99988877766" }),
		);
	});

	it("throws WalletRuleDocumentNotAllowedError when document not in whitelist", () => {
		const rule = WalletRules.create({
			...baseProps,
			documentWhitelistBlocked: true,
			documentWhitelist: ["11122233344"],
		});
		assert.throws(
			() => rule.exceedsDocumentWhitelist({ document: "99988877766" }),
			(e) => e instanceof WalletRuleDocumentNotAllowedError,
		);
	});

	it("accepts document with masking when whitelist stores raw digits", () => {
		const rule = WalletRules.create({
			...baseProps,
			documentWhitelistBlocked: true,
			documentWhitelist: ["11122233344"],
		});
		assert.doesNotThrow(() =>
			rule.exceedsDocumentWhitelist({ document: "111.222.333-44" }),
		);
	});

	it("throws when whitelist is empty even if documentWhitelistBlocked is true", () => {
		const rule = WalletRules.create({
			...baseProps,
			documentWhitelistBlocked: true,
			documentWhitelist: [],
		});
		assert.throws(
			() => rule.exceedsDocumentWhitelist({ document: "11122233344" }),
			(e) => e instanceof WalletRuleDocumentNotAllowedError,
		);
	});

	it("blocks PIX OUT via pixKey-derived document when pixKey is a CPF", () => {
		const rule = WalletRules.create({
			...baseProps,
			limitTransactionPixOut: null,
			documentWhitelistBlocked: true,
			documentWhitelist: ["11144477735"],
		});
		assert.throws(
			() =>
				rule.exceedsLimitTransactionPixOut({
					amount: 100,
					pixKey: "52998224725",
				}),
			(e) => e instanceof WalletRuleDocumentNotAllowedError,
		);
	});

	it("allows PIX IN when payer document is in the whitelist", () => {
		const rule = WalletRules.create({
			...baseProps,
			documentWhitelistBlocked: true,
			documentWhitelist: ["11144477735"],
		});
		assert.doesNotThrow(() =>
			rule.exceedsLimitTransactionPixIn({
				amount: 100,
				document: "11144477735",
			}),
		);
	});

	it("blocks PIX IN when payer document is not in the whitelist", () => {
		const rule = WalletRules.create({
			...baseProps,
			documentWhitelistBlocked: true,
			documentWhitelist: ["11144477735"],
		});
		assert.throws(
			() =>
				rule.exceedsLimitTransactionPixIn({
					amount: 100,
					document: "52998224725",
				}),
			(e) => e instanceof WalletRuleDocumentNotAllowedError,
		);
	});
});
