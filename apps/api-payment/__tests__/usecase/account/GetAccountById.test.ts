import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountCredentialsRepository,
	IAccountRepository,
	IFeesRepository,
	IRoutingRuleRepository,
	IWalletRulesRepository,
} from "@ledger/shared";
import {
	AccountCredentials,
	AccountNotFound,
	Accounts,
	Fees,
	RoutingRules,
	WalletRules,
} from "@ledger/shared";
import { GetAccountById } from "@/application/usecase/Account/GetAccountById";

function makeAccount(): Accounts {
	return Accounts.restore({
		id: "acc_001",
		organizationId: "00000000-0000-0000-0000-000000000001",
		parentAccountId: "",
		accPixIn: "pix_in_001",
		accPixOut: "pix_out_001",
		bankName: "Bank of America",
		createdAt: new Date(),
		updatedAt: new Date(),
		bookId: "bk_001",
		customerId: "cus_001",
		merchantId: "merch_001",
		providerId: "prov_001",
		status: "active",
		bankCode: "001",
		bankIspb: "00000000",
		agency: "0001",
		accountNumber: "12345-6",
		documentNumber: "12345678901",
		holder: "John Doe",
		idExternal: "EXT-001",
		costPixIn: 0.5,
		costPixOut: 1.0,
	});
}

function makeCredentials(): AccountCredentials {
	return AccountCredentials.restore({
		id: "cred_001",
		parentAccountId: "acc_001",
		clientId: "encrypted-id",
		clientSecret: "encrypted-secret",
		clientWithdrawSecret: "encrypted-ws",
		clientHamcSecret: "encrypted-hamc",
	});
}

function makeFees(): Fees {
	return Fees.restore({
		id: "fee_001",
		accountId: "acc_001",
		pixIn: 1.0,
		pixOut: 2.0,
		pixInPercentage: 0.5,
		pixOutPercentage: 0.5,
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

function makeRuleAccount(): WalletRules {
	return WalletRules.restore({
		id: "rule_001",
		walletId: "wal_001",
		limitTransactionPixIn: null,
		limitTransactionPixOut: null,
		limitTransactionDailyIn: null,
		limitTransactionDailyOut: null,
		pixKeyBlocked: false,
	});
}

function makeRoutingRule(): RoutingRules {
	return RoutingRules.restore({
		id: "rt_001",
		accountId: "acc_001",
		sourceAccountId: "acc_001",
		targetAccountId: "acc_001",
		type: "pix_in",
		priority: 1,
		status: "active",
	});
}

function makeAccountRepo(
	account: Accounts | null = makeAccount(),
): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => account,
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
	};
}

function makeRoutingRuleRepo(
	rules: RoutingRules[] = [],
): IRoutingRuleRepository {
	return {
		create: async () => {},
		findById: async () => null,
		update: async () => {},
		findByAccountIds: async () => rules,
	};
}

function makeRuleAccountRepo(
	ruleAccount: WalletRules | null = null,
): IWalletRulesRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => null,
		findByWalletId: async () => null,
		findByAccountId: async () => ruleAccount,
		update: async () => {},
		resetDaily: async () => {},
	};
}

function makeCredentialsRepo(
	creds: AccountCredentials | null = null,
): IAccountCredentialsRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => null,
		findByParentAccountId: async () => creds,
		update: async () => {},
		updateCredentialsOnly: async () => {},
		replaceCertificates: async () => {},
	};
}

function makeFeesRepo(fees: Fees | null = null): IFeesRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findByAccountId: async () => fees,
		update: async () => {},
	};
}

function makeUseCase(
	overrides: {
		accountRepo?: IAccountRepository;
		routingRuleRepo?: IRoutingRuleRepository;
		ruleAccountRepo?: IWalletRulesRepository;
		credentialsRepo?: IAccountCredentialsRepository;
		feesRepo?: IFeesRepository;
	} = {},
) {
	return new GetAccountById(
		overrides.accountRepo ?? makeAccountRepo(),
		overrides.routingRuleRepo ?? makeRoutingRuleRepo(),
		overrides.ruleAccountRepo ?? makeRuleAccountRepo(),
		overrides.credentialsRepo ?? makeCredentialsRepo(),
		overrides.feesRepo ?? makeFeesRepo(),
	);
}

describe("GetAccountById — use case", () => {
	it("throws AccountNotFound when account does not exist", async () => {
		await assert.rejects(
			() =>
				makeUseCase({ accountRepo: makeAccountRepo(null) }).execute({
					accountId: "ghost",
				}),
			(e) => e instanceof AccountNotFound,
		);
	});

	it("returns account JSON props in the output", async () => {
		const result = await makeUseCase().execute({ accountId: "acc_001" });
		assert.equal(result.account.id, "acc_001");
		assert.equal(result.account.holder, "John Doe");
	});

	it("includes credentials as undefined when none exist", async () => {
		const result = await makeUseCase().execute({ accountId: "acc_001" });
		assert.equal(result.account.credentials, undefined);
	});

	it("includes credentials JSON when they exist", async () => {
		const result = await makeUseCase({
			credentialsRepo: makeCredentialsRepo(makeCredentials()),
		}).execute({ accountId: "acc_001" });
		assert.ok(result.account.credentials);
		assert.equal(result.account.credentials.id, "cred_001");
	});

	it("includes fees as undefined when none exist", async () => {
		const result = await makeUseCase().execute({ accountId: "acc_001" });
		assert.equal(result.account.fees, undefined);
	});

	it("includes fees JSON when they exist", async () => {
		const result = await makeUseCase({
			feesRepo: makeFeesRepo(makeFees()),
		}).execute({ accountId: "acc_001" });
		assert.ok(result.account.fees);
		assert.equal(result.account.fees.pixIn, 1.0);
	});

	it("includes ruleAccount as undefined when none exist", async () => {
		const result = await makeUseCase().execute({ accountId: "acc_001" });
		assert.equal(result.account.ruleAccount, undefined);
	});

	it("includes ruleAccount JSON when it exists", async () => {
		const result = await makeUseCase({
			ruleAccountRepo: makeRuleAccountRepo(makeRuleAccount()),
		}).execute({ accountId: "acc_001" });
		assert.ok(result.account.ruleAccount);
		assert.equal(result.account.ruleAccount.id, "rule_001");
	});

	it("includes routingRules as empty array when none exist", async () => {
		const result = await makeUseCase().execute({ accountId: "acc_001" });
		assert.deepEqual(result.account.routingRules, []);
	});

	it("includes routingRules JSON array when they exist", async () => {
		const result = await makeUseCase({
			routingRuleRepo: makeRoutingRuleRepo([makeRoutingRule()]),
		}).execute({ accountId: "acc_001" });
		assert.equal(result.account.routingRules.length, 1);
		assert.equal(result.account.routingRules[0]?.id, "rt_001");
	});
});
