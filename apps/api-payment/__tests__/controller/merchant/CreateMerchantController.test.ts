import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	IMerchantRepository,
	IOrganizationRepository,
} from "@ledger/shared";
import { AccountNotFound, Accounts, Organizations } from "@ledger/shared";
import type { Request, Response } from "express";
import { CreateMerchant } from "@/application/usecase/Merchant/CreateMerchant";
import type { CreateWallet } from "@/application/usecase/Wallet/CreateWallet";
import { CreateMerchantController } from "@/presentation/api/controllers/merchants/CreateMerchantController";

function makeOrg(): Organizations {
	return Organizations.restore({
		id: "org_001",
		externalId: "00000000-0000-0000-0000-000000000001",
		parentOrganizationId: null,
		legalName: "Org One",
		legalDocument: "12345678000100",
		status: "active",
	});
}

function makeOrgRepo(
	org: Organizations | null = makeOrg(),
): IOrganizationRepository {
	return {
		create: async () => {},
		findByExternalId: async () => null,
		findById: async () => org,
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

function makeReq(body: Record<string, unknown>): Request {
	return { body, params: {}, query: {} } as unknown as Request;
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

describe("CreateMerchantController — unit", () => {
	it("responds 201 on success", async () => {
		const ctrl = new CreateMerchantController(
			new CreateMerchant(
				makeOrgRepo(),
				makeMerchantRepo(),
				makeAccountRepo(),
				makeCreateWalletStub(),
			),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				organizationId: "org_001",
				legalName: "Acme",
				legalDocument: "12345678000100",
			}),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 201);
	});

	it("response body has error:false and data with merchantId", async () => {
		const ctrl = new CreateMerchantController(
			new CreateMerchant(
				makeOrgRepo(),
				makeMerchantRepo(),
				makeAccountRepo(),
				makeCreateWalletStub(),
			),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				organizationId: "org_001",
				legalName: "Acme",
				legalDocument: "12345678000100",
			}),
			res as unknown as Response,
		);
		const body = res.body as { error: boolean; data: { merchantId: string } };
		assert.equal(body.error, false);
		assert.match(body.data.merchantId, /^mer_/);
	});

	it("forwards body to the use case", async () => {
		let captured: any;
		const repo = makeMerchantRepo({
			create: async (m) => {
				captured = m;
			},
		});
		const ctrl = new CreateMerchantController(
			new CreateMerchant(
				makeOrgRepo(),
				repo,
				makeAccountRepo(),
				makeCreateWalletStub(),
			),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				organizationId: "org_001",
				legalName: "Corp LTDA",
				legalDocument: "99999999000199",
			}),
			res as unknown as Response,
		);
		assert.equal(captured.get("legalName"), "Corp LTDA");
		assert.equal(captured.get("legalDocument"), "99999999000199");
	});
});
