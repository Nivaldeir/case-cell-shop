import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	IScrappingConfigurationRepository,
} from "@ledger/shared";
import {
	AccountIsNotActive,
	AccountNotFound,
	AccountReferenceMustBeDifferent,
	Accounts,
} from "@ledger/shared";
import { CreateScrappingConfiguration } from "@/application/usecase/Account/CreateScrappingConfiguration";

function makeAccount(status: "active" | "inactive" = "active") {
	return Accounts.restore({
		id: "acc_001",
		organizationId: "org_001",
		parentAccountId: null,
		accPixIn: null,
		accPixOut: null,
		bookId: "book_001",
		customerId: "cus_001",
		merchantId: "merch_001",
		providerId: "prov_001",
		status,
		bankCode: "001",
		bankIspb: "00000001",
		bankName: "Banco Test",
		agency: "0001",
		accountNumber: "123456",
		documentNumber: "12345678901",
		holder: "Test",
		idExternal: "ext_001",
		costPixIn: 0,
		costPixOut: 0,
	} as Parameters<typeof Accounts.restore>[0]);
}

function makeAccountRepo(
	from = makeAccount(),
	to = makeAccount(),
): IAccountRepository {
	let callCount = 0;
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => {
			callCount++;
			if (callCount === 1) return from;
			return to;
		},
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
	};
}

function makeScrappingRepo(): IScrappingConfigurationRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByAccountId: async () => [],
		findAll: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
		delete: async () => {},
	};
}

const validInput = {
	fromAccountId: "acc_001",
	toAccountId: "acc_002",
	amount: 1000,
	maximumBalance: 5000,
};

describe("CreateScrappingConfiguration — use case", () => {
	it("throws AccountReferenceMustBeDifferent when from and to are the same", async () => {
		const uc = new CreateScrappingConfiguration(
			makeAccountRepo(),
			makeScrappingRepo(),
		);
		await assert.rejects(
			() =>
				uc.execute({
					...validInput,
					fromAccountId: "acc_001",
					toAccountId: "acc_001",
				}),
			(e) => e instanceof AccountReferenceMustBeDifferent,
		);
	});

	it("throws AccountNotFound when fromAccount does not exist", async () => {
		let calls = 0;
		const repo: IAccountRepository = {
			create: async () => {},
			createTx: async () => {},
			findById: async () => {
				calls++;
				if (calls === 1) return null;
				return makeAccount();
			},
			findMany: async () => ({ items: [], totalItems: 0 }),
			findByOrganizationId: async () => [],
		};
		const uc = new CreateScrappingConfiguration(repo, makeScrappingRepo());
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof AccountNotFound,
		);
	});

	it("throws AccountNotFound when toAccount does not exist", async () => {
		let calls = 0;
		const repo: IAccountRepository = {
			create: async () => {},
			createTx: async () => {},
			findById: async () => {
				calls++;
				if (calls === 1) return makeAccount();
				return null;
			},
			findMany: async () => ({ items: [], totalItems: 0 }),
			findByOrganizationId: async () => [],
		};
		const uc = new CreateScrappingConfiguration(repo, makeScrappingRepo());
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof AccountNotFound,
		);
	});

	it("throws AccountIsNotActive when fromAccount is inactive", async () => {
		let calls = 0;
		const repo: IAccountRepository = {
			create: async () => {},
			createTx: async () => {},
			findById: async () => {
				calls++;
				if (calls === 1) return makeAccount("inactive");
				return makeAccount();
			},
			findMany: async () => ({ items: [], totalItems: 0 }),
			findByOrganizationId: async () => [],
		};
		const uc = new CreateScrappingConfiguration(repo, makeScrappingRepo());
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof AccountIsNotActive,
		);
	});

	it("throws AccountIsNotActive when toAccount is inactive", async () => {
		let calls = 0;
		const repo: IAccountRepository = {
			create: async () => {},
			createTx: async () => {},
			findById: async () => {
				calls++;
				if (calls === 1) return makeAccount("active");
				return makeAccount("inactive");
			},
			findMany: async () => ({ items: [], totalItems: 0 }),
			findByOrganizationId: async () => [],
		};
		const uc = new CreateScrappingConfiguration(repo, makeScrappingRepo());
		await assert.rejects(
			() => uc.execute(validInput),
			(e) => e instanceof AccountIsNotActive,
		);
	});

	it("returns scrappingConfigurationId on success", async () => {
		const uc = new CreateScrappingConfiguration(
			makeAccountRepo(),
			makeScrappingRepo(),
		);
		const result = await uc.execute(validInput);
		assert.ok(result.scrappingConfigurationId.length > 0);
	});

	it("uses default status 'active' when not provided", async () => {
		let captured: any;
		const repo: IScrappingConfigurationRepository = {
			create: async (cfg) => {
				captured = cfg;
			},
			findById: async () => null,
			findByAccountId: async () => [],
			findAll: async () => [],
			findMany: async () => ({ items: [], totalItems: 0 }),
			update: async () => {},
			delete: async () => {},
		};
		const uc = new CreateScrappingConfiguration(makeAccountRepo(), repo);
		await uc.execute(validInput);
		assert.equal(captured.get("status"), "active");
	});
});
