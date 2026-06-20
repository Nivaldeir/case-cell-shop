import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	IMerchantRepository,
	IOrganizationRepository,
} from "@ledger/shared";
import {
	AccountNotFound,
	Accounts,
	OrganizationNotFound,
	Organizations,
} from "@ledger/shared";
import { CreateMerchant } from "@/application/usecase/Merchant/CreateMerchant";
import type { CreateWallet } from "@/application/usecase/Wallet/CreateWallet";

function makeOrg(): Organizations {
	return Organizations.restore({
		id: "org_001",
		externalId: "ext-001",
		parentOrganizationId: null,
		legalName: "Acme Corp",
		legalDocument: "12345678000100",
		status: "active",
	});
}

function makeOrgRepo(
	org: Organizations | null = makeOrg(),
): IOrganizationRepository {
	return {
		create: async () => {},
		findById: async () => org,
		findByExternalId: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
	};
}

function makeMerchantRepo(
	overrides: Partial<IMerchantRepository> = {},
): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		...overrides,
	};
}

function makeAccount(): Accounts {
	return Accounts.restore({
		id: "acc_001",
		parentAccountId: null,
		bookId: "book_001",
		providerId: "prov_001",
		status: "active",
		type: "nominal",
		bankCode: "001",
		bankIspb: "00000000",
		bankName: "bank",
		agency: "0001",
		accountNumber: "123",
		costPixIn: 0,
		costPixOut: 0,
		documentNumber: "123",
		holder: "holder",
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

function makeAccountRepo(
	account: Accounts | null = makeAccount(),
): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => {
			if (!account) throw new AccountNotFound("acc_missing");
			return account;
		},
		updateMerchant: async () => {},
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
	};
}

function makeCreateWalletStub(): Pick<CreateWallet, "execute"> {
	return {
		execute: async () => ({
			walletId: "wal_test",
			balanceId: "bal_test",
		}),
	};
}

describe("CreateMerchant — use case", () => {
	it("returns merchantId with 'mer_' prefix", async () => {
		const uc = new CreateMerchant(
			makeOrgRepo(),
			makeMerchantRepo(),
			makeAccountRepo(),
			makeCreateWalletStub(),
		);
		const result = await uc.execute({
			organizationId: "org_001",
			legalName: "My Merchant",
			legalDocument: "98765432000100",
		});
		assert.match(result.merchantId, /^mer_/);
	});

	it("throws OrganizationNotFound when org does not exist", async () => {
		const uc = new CreateMerchant(
			makeOrgRepo(null),
			makeMerchantRepo(),
			makeAccountRepo(),
			makeCreateWalletStub(),
		);
		await assert.rejects(
			() =>
				uc.execute({
					organizationId: "org_ghost",
					legalName: "X",
					legalDocument: "Y",
				}),
			(e) => e instanceof OrganizationNotFound,
		);
	});

	it("creates merchant with status 'active' by default", async () => {
		let captured: any;
		const uc = new CreateMerchant(
			makeOrgRepo(),
			makeMerchantRepo({
				create: async (m) => {
					captured = m;
				},
			}),
			makeAccountRepo(),
			makeCreateWalletStub(),
		);
		await uc.execute({
			organizationId: "org_001",
			legalName: "X",
			legalDocument: "Y",
		});
		assert.equal(captured.get("status"), "active");
	});

	it("links merchant to the organization", async () => {
		let captured: any;
		const uc = new CreateMerchant(
			makeOrgRepo(),
			makeMerchantRepo({
				create: async (m) => {
					captured = m;
				},
			}),
			makeAccountRepo(),
			makeCreateWalletStub(),
		);
		await uc.execute({
			organizationId: "org_001",
			legalName: "X",
			legalDocument: "Y",
		});
		assert.equal(captured.get("organizationId"), "org_001");
	});

	it("stores legalName and legalDocument", async () => {
		let captured: any;
		const uc = new CreateMerchant(
			makeOrgRepo(),
			makeMerchantRepo({
				create: async (m) => {
					captured = m;
				},
			}),
			makeAccountRepo(),
			makeCreateWalletStub(),
		);
		await uc.execute({
			organizationId: "org_001",
			legalName: "My Corp",
			legalDocument: "12345678000100",
		});
		assert.equal(captured.get("legalName"), "My Corp");
		assert.equal(captured.get("legalDocument"), "12345678000100");
	});

	it("throws AccountNotFound when accPixOut does not exist", async () => {
		const uc = new CreateMerchant(
			makeOrgRepo(),
			makeMerchantRepo(),
			makeAccountRepo(null),
			makeCreateWalletStub(),
		);
		await assert.rejects(
			() =>
				uc.execute({
					organizationId: "org_001",
					legalName: "My Corp",
					legalDocument: "12345678000100",
					accPixOut: "acc_missing",
				}),
			(e) => e instanceof AccountNotFound,
		);
	});
});
