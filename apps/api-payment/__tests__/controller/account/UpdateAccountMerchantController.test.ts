import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	ICustomerRepository,
	IMerchantRepository,
} from "@ledger/shared";
import { Accounts, Customers, Merchants } from "@ledger/shared";
import type { Request, Response } from "express";
import { UpdateAccountMerchant } from "@/application/usecase/Account/UpdateAccountMerchant";
import { UpdateAccountMerchantController } from "@/presentation/api/controllers/accounts/UpdateAccountMerchantController";

function makeAccount(): Accounts {
	return Accounts.restore({
		id: "acc_001",
		organizationId: "org_001",
		parentAccountId: null,
		bookId: "book_001",
		customerId: "cus_001",
		merchantId: "mer_old",
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

function makeMerchant(): Merchants {
	return Merchants.restore({
		id: "mer_new",
		organizationId: "org_001",
		legalName: "merchant",
		legalDocument: "123",
		status: "active",
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

function makeCustomer(): Customers {
	return Customers.restore({
		id: "cus_001",
		merchantId: "mer_new",
		externalId: "ext",
		name: "name",
		documentNumber: "123",
		email: "mail@test.com",
		status: "active",
		createdAt: new Date(),
		updatedAt: new Date(),
	});
}

function makeAccountRepo(): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => makeAccount(),
		updateMerchant: async () => {},
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
	};
}

function makeMerchantRepo(): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => makeMerchant(),
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function makeCustomerRepo(): ICustomerRepository {
	return {
		create: async () => {},
		findById: async () => makeCustomer(),
		findByExternalIdAndMerchantId: async () => null,
		findByMerchantId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
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

function makeReq(accountId: string, merchantId: string): Request {
	return {
		params: { accountId },
		body: { merchantId },
		query: {},
	} as unknown as Request;
}

describe("UpdateAccountMerchantController — unit", () => {
	it("responds 200 on success", async () => {
		const ctrl = new UpdateAccountMerchantController(
			new UpdateAccountMerchant(
				makeAccountRepo(),
				makeMerchantRepo(),
				makeCustomerRepo(),
			),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq("acc_001", "mer_new"),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 200);
	});

	it("returns payload with accountId and merchantId", async () => {
		const ctrl = new UpdateAccountMerchantController(
			new UpdateAccountMerchant(
				makeAccountRepo(),
				makeMerchantRepo(),
				makeCustomerRepo(),
			),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq("acc_001", "mer_new"),
			res as unknown as Response,
		);
		const body = res.body as {
			error: boolean;
			data: { accountId: string; merchantId: string };
		};
		assert.equal(body.error, false);
		assert.equal(body.data.accountId, "acc_001");
		assert.equal(body.data.merchantId, "mer_new");
	});
});
