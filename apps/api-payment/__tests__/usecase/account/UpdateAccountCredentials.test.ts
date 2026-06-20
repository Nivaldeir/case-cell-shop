import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IAccountCredentialsRepository } from "@ledger/shared";
import { AccountCredentials, AccountCredentialsNotFound } from "@ledger/shared";
import { UpdateAccountCredentials } from "@/application/usecase/Account/UpdateAccountCredentials";

function makeCredentials(): AccountCredentials {
	return AccountCredentials.restore({
		id: "cred_001",
		parentAccountId: "acc_001",
		clientId: "old-id",
		clientSecret: "old-secret",
		clientWithdrawSecret: "old-ws",
		clientHamcSecret: "old-hamc",
	});
}

function makeRepo(
	creds: AccountCredentials | null = makeCredentials(),
	overrides: Partial<IAccountCredentialsRepository> = {},
): IAccountCredentialsRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => null,
		findByParentAccountId: async () => creds,
		update: async () => {},
		updateCredentialsOnly: async () => {},
		replaceCertificates: async () => {},
		...overrides,
	};
}

const validInput = {
	accountId: "acc_001",
	clientId: "new-client-id",
	clientSecret: "new-secret",
	clientWithdrawSecret: "new-ws",
	clientHamcSecret: "new-hamc",
};

describe("UpdateAccountCredentials — use case", () => {
	it("throws AccountCredentialsNotFound when no credentials exist for account", async () => {
		const uc = new UpdateAccountCredentials(makeRepo(null));
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof AccountCredentialsNotFound,
		);
	});

	it("returns credentialsId (existing ID preserved)", async () => {
		const uc = new UpdateAccountCredentials(makeRepo());
		const result = await uc.execute(validInput);
		assert.equal(result.credentialsId, "cred_001");
	});

	it("calls update with encrypted values (non-empty strings)", async () => {
		let saved: any;
		const uc = new UpdateAccountCredentials(
			makeRepo(makeCredentials(), {
				update: async (c) => {
					saved = c;
				},
			}),
		);
		await uc.execute(validInput);
		// Values should be encrypted (not plain text)
		assert.notEqual(saved.get("clientSecret"), "new-secret");
		assert.ok(saved.get("clientSecret").length > 0);
	});

	it("calls update exactly once", async () => {
		let count = 0;
		const uc = new UpdateAccountCredentials(
			makeRepo(makeCredentials(), {
				update: async () => {
					count++;
				},
			}),
		);
		await uc.execute(validInput);
		assert.equal(count, 1);
	});

	it("preserves the original credentials ID after update", async () => {
		let saved: any;
		const uc = new UpdateAccountCredentials(
			makeRepo(makeCredentials(), {
				update: async (c) => {
					saved = c;
				},
			}),
		);
		await uc.execute(validInput);
		assert.equal(saved.get("id"), "cred_001");
		assert.equal(saved.get("parentAccountId"), "acc_001");
	});
});
