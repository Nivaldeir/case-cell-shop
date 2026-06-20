import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountCredentialsRepository,
	IAccountRepository,
	IFeesRepository,
	IRoutingRuleRepository,
	IRuleAccountRepository,
} from "@ledger/shared";
import { Accounts } from "@ledger/shared";
import type { Request, Response } from "express";
import { GetAccountById } from "@/application/usecase/Account/GetAccountById";
import { GetAccountByIdController } from "@/presentation/api/controllers/accounts/GetAccountById";

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

function makeRoutingRuleRepo(): IRoutingRuleRepository {
	return {
		create: async () => {},
		findById: async () => null,
		update: async () => {},
		findByAccountIds: async () => [],
	};
}

function makeRuleAccountRepo(): IRuleAccountRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByAccountId: async () => null,
		update: async () => {},
	};
}

function makeCredentialsRepo(): IAccountCredentialsRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => null,
		findByParentAccountId: async () => null,
		update: async () => {},
		updateCredentialsOnly: async () => {},
		replaceCertificates: async () => {},
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

function makeUseCase(accountRepo = makeAccountRepo()) {
	return new GetAccountById(
		accountRepo,
		makeRoutingRuleRepo(),
		makeRuleAccountRepo(),
		makeCredentialsRepo(),
		makeFeesRepo(),
	);
}

function makeReq(accountId: string): Request {
	return { params: { accountId }, body: {}, query: {} } as unknown as Request;
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

describe("GetAccountByIdController — unit", () => {
	it("responds 200 with account data", async () => {
		const ctrl = new GetAccountByIdController(makeUseCase());
		const res = makeRes();
		await ctrl.handle(makeReq("acc_001"), res as unknown as Response);
		assert.equal(res.statusCode, 200);
	});

	it("response body has error:null and success:true", async () => {
		const ctrl = new GetAccountByIdController(makeUseCase());
		const res = makeRes();
		await ctrl.handle(makeReq("acc_001"), res as unknown as Response);
		const body = res.body as { error: unknown; success: boolean };
		assert.equal(body.error, null);
		assert.equal(body.success, true);
	});

	it("response body data has account id", async () => {
		const ctrl = new GetAccountByIdController(makeUseCase());
		const res = makeRes();
		await ctrl.handle(makeReq("acc_001"), res as unknown as Response);
		const body = res.body as { data: { account: { id: string } } };
		assert.equal(body.data.account.id, "acc_001");
	});

	it("forwards accountId to use case", async () => {
		let capturedId: string | undefined;
		const accountRepo: IAccountRepository = {
			...makeAccountRepo(),
			findById: async (id) => {
				capturedId = id;
				return makeAccount();
			},
		};
		const ctrl = new GetAccountByIdController(makeUseCase(accountRepo));
		const res = makeRes();
		await ctrl.handle(makeReq("acc_target"), res as unknown as Response);
		assert.equal(capturedId, "acc_target");
	});
});
