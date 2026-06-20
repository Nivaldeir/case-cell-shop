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
import { AccountNotFound, MerchantNotFound, Merchants } from "@ledger/shared";
import { CreateWallet } from "@/application/usecase/Wallet/CreateWallet";

function makeMerchant() {
	return Merchants.restore({
		id: "merch_001",
		organizationId: "org_001",
		legalName: "Acme",
		legalDocument: "12345678000100",
		status: "active",
	});
}

function makeMerchantRepo(merchant = makeMerchant()): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => merchant,
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function makeAccountRepo(throws = false): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => {
			if (throws) throw new Error("not found");
			return null;
		},
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

function makeSut(
	overrides: {
		merchantRepo?: IMerchantRepository;
		accountRepo?: IAccountRepository;
	} = {},
) {
	return new CreateWallet(
		overrides.merchantRepo ?? makeMerchantRepo(),
		overrides.accountRepo ?? makeAccountRepo(),
		makeWalletRepo(),
		makeBalanceRepo(),
		makeFeesRepo(),
		makeRoutingRepo(),
		makeWalletRulesRepo(),
	);
}

describe("CreateWallet — use case", () => {
	it("returns walletId, balanceId, feesId on success", async () => {
		const result = await makeSut().execute({
			merchantId: "merch_001",
			asset: "BRL",
		});
		assert.match(result.walletId, /^wal_/);
		assert.match(result.balanceId, /^bal_/);
		assert.match(result.feesId, /^fee_/);
	});

	it("throws MerchantNotFound when merchant does not exist", async () => {
		const uc = makeSut({ merchantRepo: makeMerchantRepo(null as any) });
		await assert.rejects(
			() => uc.execute({ merchantId: "merch_001", asset: "BRL" }),
			(e) => e instanceof MerchantNotFound,
		);
	});

	it("throws AccountNotFound when accPixOut does not exist", async () => {
		const uc = makeSut({ accountRepo: makeAccountRepo(true) });
		await assert.rejects(
			() =>
				uc.execute({
					merchantId: "merch_001",
					asset: "BRL",
					accPixOut: "acc_999",
				}),
			(e) => e instanceof AccountNotFound,
		);
	});

	it("throws AccountNotFound when accPixIn does not exist", async () => {
		const uc = makeSut({ accountRepo: makeAccountRepo(true) });
		await assert.rejects(
			() =>
				uc.execute({
					merchantId: "merch_001",
					asset: "BRL",
					accPixIn: "acc_999",
				}),
			(e) => e instanceof AccountNotFound,
		);
	});

	it("creates routing rule when accPixIn is provided", async () => {
		let routingCreated = false;
		const routingRepo: IRoutingRuleRepository = {
			...makeRoutingRepo(),
			createTx: async () => {
				routingCreated = true;
			},
		};
		const uc = new CreateWallet(
			makeMerchantRepo(),
			makeAccountRepo(),
			makeWalletRepo(),
			makeBalanceRepo(),
			makeFeesRepo(),
			routingRepo,
			makeWalletRulesRepo(),
		);
		await uc.execute({
			merchantId: "merch_001",
			asset: "BRL",
			accPixIn: "acc_001",
		});
		assert.equal(routingCreated, true);
	});

	it("does not create routing rule when accPixIn is not provided", async () => {
		let routingCreated = false;
		const routingRepo: IRoutingRuleRepository = {
			...makeRoutingRepo(),
			createTx: async () => {
				routingCreated = true;
			},
		};
		const uc = new CreateWallet(
			makeMerchantRepo(),
			makeAccountRepo(),
			makeWalletRepo(),
			makeBalanceRepo(),
			makeFeesRepo(),
			routingRepo,
			makeWalletRulesRepo(),
		);
		await uc.execute({ merchantId: "merch_001", asset: "BRL" });
		assert.equal(routingCreated, false);
	});

	it("uses default zero fees when not provided", async () => {
		let capturedFees: any;
		const feesRepo: IFeesRepository = {
			...makeFeesRepo(),
			createTx: async (f) => {
				capturedFees = f;
			},
		};
		const uc = new CreateWallet(
			makeMerchantRepo(),
			makeAccountRepo(),
			makeWalletRepo(),
			makeBalanceRepo(),
			feesRepo,
			makeRoutingRepo(),
			makeWalletRulesRepo(),
		);
		await uc.execute({ merchantId: "merch_001", asset: "BRL" });
		assert.equal(capturedFees.get("pixIn"), 0);
		assert.equal(capturedFees.get("pixOut"), 0);
	});
});
