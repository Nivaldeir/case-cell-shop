import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IAccountCredentialsRepository } from "@ledger/shared";
import { AccountCredentials } from "@ledger/shared";
import type { Request, Response } from "express";
import { UpdateAccountCredentials } from "@/application/usecase/Account/UpdateAccountCredentials";
import { UpdateAccountCredentialsController } from "@/presentation/api/controllers/accounts/credentials/UpdateAccountCredentialsController";

function makeCredentials(): AccountCredentials {
	return AccountCredentials.restore({
		id: "cred_001",
		parentAccountId: "acc_001",
		clientId: "enc_client_id",
		clientSecret: "enc_secret",
		clientWithdrawSecret: "enc_withdraw",
		clientHamcSecret: "enc_hamc",
	});
}

function makeRepo(
	credentials: AccountCredentials | null = makeCredentials(),
	overrides: Partial<IAccountCredentialsRepository> = {},
): IAccountCredentialsRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => credentials,
		findByParentAccountId: async () => credentials,
		update: async () => {},
		updateCredentialsOnly: async () => {},
		replaceCertificates: async () => {},
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

describe("UpdateAccountCredentialsController — unit", () => {
	it("responds 200 on success", async () => {
		const ctrl = new UpdateAccountCredentialsController(
			new UpdateAccountCredentials(makeRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				accountId: "acc_001",
				clientId: "new_id",
				clientSecret: "new_secret",
				clientWithdrawSecret: "new_withdraw",
				clientHamcSecret: "new_hamc",
			}),
			res as unknown as Response,
		);
		assert.equal(res.statusCode, 200);
	});

	it("response body has error:false and credentialsId in data", async () => {
		const ctrl = new UpdateAccountCredentialsController(
			new UpdateAccountCredentials(makeRepo()),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				accountId: "acc_001",
				clientSecret: "new_secret",
				clientWithdrawSecret: "new_withdraw",
				clientHamcSecret: "new_hamc",
			}),
			res as unknown as Response,
		);
		const body = res.body as {
			error: boolean;
			data: { credentialsId: string };
		};
		assert.equal(body.error, false);
		assert.equal(body.data.credentialsId, "cred_001");
	});

	it("calls update exactly once", async () => {
		let count = 0;
		const repo = makeRepo(makeCredentials(), {
			update: async () => {
				count++;
			},
		});
		const ctrl = new UpdateAccountCredentialsController(
			new UpdateAccountCredentials(repo),
		);
		const res = makeRes();
		await ctrl.handle(
			makeReq({
				accountId: "acc_001",
				clientSecret: "s",
				clientWithdrawSecret: "w",
				clientHamcSecret: "h",
			}),
			res as unknown as Response,
		);
		assert.equal(count, 1);
	});
});
