import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	ICustomerRepository,
	IMerchantRepository,
} from "@ledger/shared";
import {
	AccountNotFound,
	Accounts,
	CustomerMerchantMismatch,
	Customers,
	MerchantNotFound,
	MerchantOrganizationMismatch,
	Merchants,
} from "@ledger/shared";
import { UpdateAccountMerchant } from "@/application/usecase/Account/UpdateAccountMerchant";

function makeAccount(merchantId = "mer_old"): Accounts {
	return Accounts.restore({
		id: "acc_001",
		organizationId: "org_001",
		parentAccountId: null,
		bookId: "book_001",
		customerId: "cus_001",
		merchantId,
		providerId: "prov_001",
		status: "active",
		type: "nominal",
		bankCode: "001",
		bankIspb: "00000000",
		bankName: "Bank",
		agency: "0001",
		accountNumber: "123",
		costPixIn: 0,
		costPixOut: 0,
		documentNumber: "123",
		holder: "holder",
		idExternal: "ext",
		createdAt: new Date(),
		updatedAt: new Date(),
		accPixIn: null,
		accPixOut: null,
	});
}

function makeMerchant(organizationId = "org_001"): Merchants {
	return Merchants.restore({
		id: "mer_new",
		organizationId,
		legalName: "merchant",
		legalDocument: "123",
		status: "active",
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

function makeCustomer(merchantId = "mer_new"): Customers {
	return Customers.restore({
		id: "cus_001",
		merchantId,
		externalId: "ext",
		name: "name",
		documentNumber: "123",
		email: "mail@test.com",
		status: "active",
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

function makeAccountRepo(
	account: Accounts | null = makeAccount(),
	overrides: Partial<IAccountRepository> = {},
): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => {
			if (!account) {
				throw new AccountNotFound("acc_404");
			}
			return account;
		},
		updateMerchant: async () => {},
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
		...overrides,
	};
}

function makeMerchantRepo(
	merchant: Merchants | null = makeMerchant(),
): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => merchant,
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function makeCustomerRepo(
	customer: Customers | null = makeCustomer(),
): ICustomerRepository {
	return {
		create: async () => {},
		findById: async () => customer,
		findByExternalIdAndMerchantId: async () => null,
		findByMerchantId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

describe("UpdateAccountMerchant — use case", () => {
	it("updates merchant when all relations are valid", async () => {
		let called = 0;
		const uc = new UpdateAccountMerchant(
			makeAccountRepo(makeAccount(), {
				updateMerchant: async () => {
					called++;
				},
			}),
			makeMerchantRepo(),
			makeCustomerRepo(),
		);
		const out = await uc.execute({
			accountId: "acc_001",
			merchantId: "mer_new",
		});
		assert.equal(out.accountId, "acc_001");
		assert.equal(out.merchantId, "mer_new");
		assert.equal(called, 1);
	});

	it("throws AccountNotFound when account does not exist", async () => {
		const uc = new UpdateAccountMerchant(
			makeAccountRepo(null),
			makeMerchantRepo(),
			makeCustomerRepo(),
		);
		await assert.rejects(
			() => uc.execute({ accountId: "acc_404", merchantId: "mer_new" }),
			(e) => e instanceof AccountNotFound,
		);
	});

	it("throws MerchantNotFound when merchant does not exist", async () => {
		const uc = new UpdateAccountMerchant(
			makeAccountRepo(),
			makeMerchantRepo(null),
			makeCustomerRepo(),
		);
		await assert.rejects(
			() => uc.execute({ accountId: "acc_001", merchantId: "mer_404" }),
			(e) => e instanceof MerchantNotFound,
		);
	});

	it("throws MerchantOrganizationMismatch for different organization", async () => {
		const uc = new UpdateAccountMerchant(
			makeAccountRepo(),
			makeMerchantRepo(makeMerchant("org_999")),
			makeCustomerRepo(),
		);
		await assert.rejects(
			() => uc.execute({ accountId: "acc_001", merchantId: "mer_new" }),
			(e) => e instanceof MerchantOrganizationMismatch,
		);
	});

	it("throws CustomerMerchantMismatch when customer is not linked to merchant", async () => {
		const uc = new UpdateAccountMerchant(
			makeAccountRepo(),
			makeMerchantRepo(),
			makeCustomerRepo(makeCustomer("mer_other")),
		);
		await assert.rejects(
			() => uc.execute({ accountId: "acc_001", merchantId: "mer_new" }),
			(e) => e instanceof CustomerMerchantMismatch,
		);
	});
});
