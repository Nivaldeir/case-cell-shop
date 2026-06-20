import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IAccountRepository, IFeesRepository } from "@ledger/shared";
import { Accounts, Fees } from "@ledger/shared";
import type { Request, Response } from "express";
import { UpdateWalletFees } from "@/application/usecase/Wallet/fees/UpdateWalletFees";
import { UpdateWalletFeesController } from "@/presentation/api/controllers/wallets/fees/UpdateWalletFeesController";

function makeAccount(): Accounts {
	return Accounts.restore({
		id: "acc_001",
		organizationId: "00000000-0000-0000-0000-000000000001",
		parentAccountId: null,
		bookId: "00000000-0000-0000-0000-000000000002",
		customerId: "cus_001",
		merchantId: "mer_001",
		providerId: "prov_001",
		status: "active",
		bankCode: "001",
		bankIspb: "00000000",
		agency: "0001",
		accountNumber: "12345",
		documentNumber: "12345678901",
		holder: "John Doe",
		idExternal: "ext_001",
		costPixIn: 0,
		costPixOut: 0,
	});
}

function makeFees(): Fees {
	return Fees.restore({
		id: "fee_001",
		accountId: "acc_001",
		pixIn: 1.5,
		pixOut: 2.0,
		pixInPercentage: 0.01,
		pixOutPercentage: 0.02,
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

function makeFeesRepo(
	fees: Fees | null = makeFees(),
	overrides: Partial<IFeesRepository> = {},
): IFeesRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findByAccountId: async () => fees,
		update: async () => {},
		...overrides,
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

describe("UpdateWalletFeesController — unit", () => {
	it("responds 200 on success", async () => {
		const ctrl = new UpdateWalletFeesController(
			new UpdateWalletFees(makeAccountRepo(), makeFeesRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				accountId: "acc_001",
				pixIn: 2,
				pixOut: 3,
				pixInPercentage: 0.01,
				pixOutPercentage: 0.02,
			}),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 200);
	});

	it("response body has error:false and feesId in data", async () => {
		const ctrl = new UpdateWalletFeesController(
			new UpdateWalletFees(makeAccountRepo(), makeFeesRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				accountId: "acc_001",
				pixIn: 2,
				pixOut: 3,
				pixInPercentage: 0.01,
				pixOutPercentage: 0.02,
			}),
			res as unknown as Response,
		);
		const body = res.body as {
			error: boolean;
			data: { feesId: string; pixIn: number; pixOut: number };
		};
		assert.equal(body.error, false);
		assert.equal(body.data.feesId, "fee_001");
	});

	it("response body data has updated fee values", async () => {
		const ctrl = new UpdateWalletFeesController(
			new UpdateWalletFees(makeAccountRepo(), makeFeesRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				accountId: "acc_001",
				pixIn: 5,
				pixOut: 6,
				pixInPercentage: 0.05,
				pixOutPercentage: 0.06,
			}),
			res as unknown as Response,
		);
		const body = res.body as {
			data: {
				pixIn: number;
				pixOut: number;
				pixInPercentage: number;
				pixOutPercentage: number;
			};
		};
		assert.equal(body.data.pixIn, 5);
		assert.equal(body.data.pixOut, 6);
		assert.equal(body.data.pixInPercentage, 0.05);
		assert.equal(body.data.pixOutPercentage, 0.06);
	});

	it("calls fees update exactly once", async () => {
		let count = 0;
		const feesRepo = makeFeesRepo(makeFees(), {
			update: async () => {
				count++;
			},
		});
		const ctrl = new UpdateWalletFeesController(
			new UpdateWalletFees(makeAccountRepo(), feesRepo),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				accountId: "acc_001",
				pixIn: 1,
				pixOut: 1,
				pixInPercentage: 0,
				pixOutPercentage: 0,
			}),
			res as unknown as Response,
		);
		assert.equal(count, 1);
	});
});
