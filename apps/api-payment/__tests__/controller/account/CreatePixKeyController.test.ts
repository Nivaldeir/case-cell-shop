import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	IPixKeyRepository,
	IWalletRepository,
} from "@ledger/shared";
import { Accounts, Wallet } from "@ledger/shared";
import type { Request, Response } from "express";
import { CreatePixKey } from "@/application/usecase/Account/CreatePixKey";
import { CreatePixKeyController } from "@/presentation/api/controllers/accounts/pix-keys/CreatePixKeyController";

function makeWalletRepo(): IWalletRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () =>
			Wallet.restore({ id: "wal_001", merchantId: "merch_001" }),
		findByMerchantId: async () => null,
		update: async () => {},
		updateTx: async () => {},
	};
}

function makeAccountRepo(): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () =>
			Accounts.restore({
				id: "acc_001",
				organizationId: "org_001",
				parentAccountId: null,
				accPixIn: null,
				accPixOut: null,
				bookId: "book_001",
				customerId: "cus_001",
				merchantId: "merch_001",
				providerId: "prov_001",
				status: "active",
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
			} as Parameters<typeof Accounts.restore>[0]),
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
	};
}

function makePixKeyRepo(): IPixKeyRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findByAccountId: async () => [],
		findByAccountIds: async () => [],
		findByMerchantId: async () => [],
		findByWalletScope: async () => [],
		findById: async () => null,
		findByKey: async () => null,
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

describe("CreatePixKeyController — unit", () => {
	it("responds 201 on success", async () => {
		const ctrl = new CreatePixKeyController(
			new CreatePixKey(makeAccountRepo(), makeWalletRepo(), makePixKeyRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				walletId: "wal_001",
				accountId: "acc_001",
				key: "test@email.com",
				type: "email",
				internal: false,
			}),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 201);
	});

	it("response body has error:false and pixKeyId", async () => {
		const ctrl = new CreatePixKeyController(
			new CreatePixKey(makeAccountRepo(), makeWalletRepo(), makePixKeyRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				walletId: "wal_001",
				accountId: "acc_001",
				key: "test@email.com",
				type: "email",
				internal: false,
			}),
			res as unknown as Response,
		);
		const body = res.body as { error: boolean; data: { pixKeyId: string } };
		assert.equal(body.error, false);
		assert.match(body.data.pixKeyId, /^pix_/);
	});
});
