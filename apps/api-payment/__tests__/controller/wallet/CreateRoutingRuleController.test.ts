import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	IRoutingRuleRepository,
	IWalletRepository,
} from "@ledger/shared";
import { Accounts, Wallet } from "@ledger/shared";
import type { Request, Response } from "express";
import { CreateRoutingRule } from "@/application/usecase/Wallet/routing/CreateRoutingRule";
import { CreateRoutingRuleController } from "@/presentation/api/controllers/wallets/routing-rules/CreateRoutingRuleController";

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

function makeRoutingRepo(): IRoutingRuleRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findByWalletIds: async () => [],
		update: async () => {},
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

describe("CreateRoutingRuleController — unit", () => {
	it("responds 201 on success", async () => {
		const ctrl = new CreateRoutingRuleController(
			new CreateRoutingRule(
				makeAccountRepo(),
				makeWalletRepo(),
				makeRoutingRepo(),
			),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				walletId: "wal_001",
				accountId: "acc_001",
				type: "pix_in",
				priority: 1,
			}),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 201);
	});

	it("response body has error:false and routingRuleId", async () => {
		const ctrl = new CreateRoutingRuleController(
			new CreateRoutingRule(
				makeAccountRepo(),
				makeWalletRepo(),
				makeRoutingRepo(),
			),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				walletId: "wal_001",
				accountId: "acc_001",
				type: "pix_in",
				priority: 1,
			}),
			res as unknown as Response,
		);
		const body = res.body as {
			error: boolean;
			data: { routingRuleId: string };
		};
		assert.equal(body.error, false);
		assert.ok(body.data.routingRuleId.length > 0);
	});
});
