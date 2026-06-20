import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	IRoutingRuleRepository,
	IWalletRepository,
} from "@ledger/shared";
import {
	AccountNotFound,
	Accounts,
	RoutingRuleAlreadyExistsError,
	RoutingRulePriorityAlreadyTakenError,
	RoutingRules,
	Wallet,
	WalletNotFoundError,
} from "@ledger/shared";
import { AccountInactiveError } from "@mutual-processadora-de-pagamentos/lib-http-kit";
import { CreateRoutingRule } from "@/application/usecase/Wallet/routing/CreateRoutingRule";

function makeWallet() {
	return Wallet.restore({ id: "wal_001", merchantId: "merch_001" });
}

function makeAccount(status: "active" | "inactive" = "active") {
	return Accounts.restore({
		id: "acc_001",
		organizationId: "org_001",
		parentAccountId: null,
		accPixIn: null,
		accPixOut: null,
		bookId: "book_001",
		customerId: "cus_001",
		merchantId: "merch_001",
		providerId: "prov_001",
		status,
		bankCode: "001",
		bankIspb: "00000001",
		bankName: "Banco",
		agency: "0001",
		accountNumber: "123456",
		documentNumber: "12345678901",
		holder: "Test",
		idExternal: "ext_001",
		costPixIn: 0,
		costPixOut: 0,
	} as Parameters<typeof Accounts.restore>[0]);
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

function makeAccountRepo(account = makeAccount()): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => account,
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
	};
}

function makeRoutingRepo(
	existing: RoutingRules[] = [],
): IRoutingRuleRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findByWalletIds: async () => existing,
		update: async () => {},
	};
}

const validInput = {
	walletId: "wal_001",
	accountId: "acc_001",
	type: "pix_in" as const,
	priority: 1,
};

describe("CreateRoutingRule — use case", () => {
	it("returns routingRuleId on success", async () => {
		const uc = new CreateRoutingRule(
			makeAccountRepo(),
			makeWalletRepo(),
			makeRoutingRepo(),
		);
		const result = await uc.execute(validInput);
		assert.ok(result.routingRuleId.length > 0);
	});

	it("throws WalletNotFoundError when wallet does not exist", async () => {
		const uc = new CreateRoutingRule(
			makeAccountRepo(),
			makeWalletRepo(null as any),
			makeRoutingRepo(),
		);
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof WalletNotFoundError,
		);
	});

	it("throws AccountNotFound when account does not exist", async () => {
		const uc = new CreateRoutingRule(
			makeAccountRepo(null as any),
			makeWalletRepo(),
			makeRoutingRepo(),
		);
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof AccountNotFound,
		);
	});

	it("throws AccountInactiveError when account is inactive", async () => {
		const uc = new CreateRoutingRule(
			makeAccountRepo(makeAccount("inactive")),
			makeWalletRepo(),
			makeRoutingRepo(),
		);
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof AccountInactiveError,
		);
	});

	it("throws RoutingRuleAlreadyExistsError on duplicate route", async () => {
		const existing = RoutingRules.restore({
			id: "rule_001",
			walletId: "wal_001",
			accountId: "acc_001",
			type: "pix_in",
			priority: 1,
			status: "active",
		});
		const uc = new CreateRoutingRule(
			makeAccountRepo(),
			makeWalletRepo(),
			makeRoutingRepo([existing]),
		);
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof RoutingRuleAlreadyExistsError,
		);
	});

	it("throws RoutingRulePriorityAlreadyTakenError when priority is taken", async () => {
		const existing = RoutingRules.restore({
			id: "rule_001",
			walletId: "wal_001",
			accountId: "acc_other",
			type: "pix_in",
			priority: 1,
			status: "active",
		});
		const uc = new CreateRoutingRule(
			makeAccountRepo(),
			makeWalletRepo(),
			makeRoutingRepo([existing]),
		);
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof RoutingRulePriorityAlreadyTakenError,
		);
	});

	it("uses 'active' as default status", async () => {
		let captured: any;
		const routingRepo: IRoutingRuleRepository = {
			...makeRoutingRepo(),
			create: async (r) => {
				captured = r;
			},
		};
		const uc = new CreateRoutingRule(
			makeAccountRepo(),
			makeWalletRepo(),
			routingRepo,
		);
		await uc.execute(validInput);
		assert.equal(captured.get("status"), "active");
	});
});
