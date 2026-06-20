import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountRepository,
	IPixKeyRepository,
	IProviderRepository,
} from "@ledger/shared";
import { Accounts, PixKey, Providers } from "@ledger/shared";
import { FindManyAccount } from "@/application/usecase/Account/FindManyAccount";

function makeAccount(id: string, providerId = "prov_001"): Accounts {
	return Accounts.restore({
		id,
		providerId,
		status: "active",
		type: "nominal",
		costPixIn: 0.5,
		costPixOut: 1.0,
		bankName: "Bank",
		createdAt: new Date(),
		updatedAt: new Date(),
		bankCode: "001",
		bankIspb: "00000000",
		agency: "0001",
		accountNumber: "123456-7",
		documentNumber: "12345678901",
		holder: "John Doe",
	});
}

function makePixKey(accountId: string, id = `pk_${accountId}`): PixKey {
	return PixKey.restore({
		id,
		accountId,
		customerId: "cust_001",
		type: "email",
		key: `${id}@example.com`,
	});
}

function makeProvider(id: string, name = `Provider ${id}`): Providers {
	return Providers.restore({
		id,
		code: id,
		name,
		slug: id,
		pixIn: true,
		pixOut: true,
		dict: true,
		refund: true,
		status: "active",
		description: "",
	});
}

function makeRepos(
	accounts: Accounts[],
	totalItems: number,
	pixKeys: PixKey[] = [],
	providers: Providers[] = [],
): {
	accountRepo: IAccountRepository;
	pixKeyRepo: IPixKeyRepository;
	providerRepo: IProviderRepository;
} {
	return {
		accountRepo: {
			create: async () => {},
			createTx: async () => {},
			findById: async () => null,
			findByOrganizationId: async () => [],
			findMany: async () => ({ items: accounts, totalItems }),
		},
		pixKeyRepo: {
			create: async () => {},
			createTx: async () => {},
			findByAccountId: async () => pixKeys,
			findByAccountIds: async () => pixKeys,
			findByMerchantId: async () => [],
			findByWalletScope: async () => [],
			findById: async () => null,
			findByKey: async () => null,
		},
		providerRepo: {
			create: async () => {},
			findById: async () => null,
			findByIds: async () => providers,
			findByCode: async () => providers[0] as Providers,
			findIdByCode: async () => null,
			findIdBySlug: async () => null,
			findIdByCodeExcluding: async () => null,
			findIdBySlugExcluding: async () => null,
			findMany: async () => ({
				items: providers,
				totalItems: providers.length,
			}),
			update: async () => {},
		},
	};
}

describe("FindManyAccount — use case", () => {
	it("returns paginated items with pagination metadata", async () => {
		const accounts = [makeAccount("acc_1"), makeAccount("acc_2")];
		const { accountRepo, pixKeyRepo, providerRepo } = makeRepos(accounts, 2);
		const result = await new FindManyAccount(
			accountRepo,
			pixKeyRepo,
			providerRepo,
		).execute({
			params: { page: 1, limit: 10, search: "" },
		});

		assert.equal(result.items.length, 2);
		assert.equal(result.pagination.totalItems, 2);
		assert.equal(result.pagination.totalPages, 1);
		assert.equal(result.pagination.hasNextPage, false);
		assert.equal(result.pagination.hasPreviousPage, false);
	});

	it("groups pixKeys by accountId", async () => {
		const acc1 = makeAccount("acc_1");
		const acc2 = makeAccount("acc_2");
		const pk1 = makePixKey("acc_1");
		const pk2 = makePixKey("acc_2");
		const { accountRepo, pixKeyRepo, providerRepo } = makeRepos(
			[acc1, acc2],
			2,
			[pk1, pk2],
		);
		const result = await new FindManyAccount(
			accountRepo,
			pixKeyRepo,
			providerRepo,
		).execute({
			params: { page: 1, limit: 10, search: "" },
		});

		const item1 = result.items.find((i) => i.account.get("id") === "acc_1");
		const item2 = result.items.find((i) => i.account.get("id") === "acc_2");
		assert.equal(item1?.pixKeys.length, 1);
		assert.equal(item2?.pixKeys.length, 1);
	});

	it("returns empty pixKeys for an account with none", async () => {
		const acc = makeAccount("acc_isolated");
		const { accountRepo, pixKeyRepo, providerRepo } = makeRepos([acc], 1);
		const result = await new FindManyAccount(
			accountRepo,
			pixKeyRepo,
			providerRepo,
		).execute({
			params: { page: 1, limit: 10, search: "" },
		});

		const item = result.items[0];
		assert.equal(item?.pixKeys.length, 0);
	});

	it("totalPages is at least 1 when no items", async () => {
		const { accountRepo, pixKeyRepo, providerRepo } = makeRepos([], 0);
		const result = await new FindManyAccount(
			accountRepo,
			pixKeyRepo,
			providerRepo,
		).execute({
			params: { page: 1, limit: 10, search: "" },
		});
		assert.equal(result.pagination.totalPages, 1);
	});

	it("attaches the provider to each account by providerId", async () => {
		const acc1 = makeAccount("acc_1", "prov_a");
		const acc2 = makeAccount("acc_2", "prov_b");
		const provA = makeProvider("prov_a", "Provider A");
		const provB = makeProvider("prov_b", "Provider B");
		const { accountRepo, pixKeyRepo, providerRepo } = makeRepos(
			[acc1, acc2],
			2,
			[],
			[provA, provB],
		);
		const result = await new FindManyAccount(
			accountRepo,
			pixKeyRepo,
			providerRepo,
		).execute({
			params: { page: 1, limit: 10, search: "" },
		});

		const item1 = result.items.find((i) => i.account.get("id") === "acc_1");
		const item2 = result.items.find((i) => i.account.get("id") === "acc_2");
		assert.equal(item1?.provider?.get("name"), "Provider A");
		assert.equal(item2?.provider?.get("name"), "Provider B");
	});

	it("provider is null when the matching provider is not found", async () => {
		const acc = makeAccount("acc_1", "prov_missing");
		const { accountRepo, pixKeyRepo, providerRepo } = makeRepos([acc], 1);
		const result = await new FindManyAccount(
			accountRepo,
			pixKeyRepo,
			providerRepo,
		).execute({
			params: { page: 1, limit: 10, search: "" },
		});

		assert.equal(result.items[0]?.provider, null);
	});

	it("requests providers in batch by unique providerIds", async () => {
		const acc1 = makeAccount("acc_1", "prov_a");
		const acc2 = makeAccount("acc_2", "prov_a");
		const acc3 = makeAccount("acc_3", "prov_b");
		let captured: string[] | undefined;
		const { accountRepo, pixKeyRepo, providerRepo } = makeRepos(
			[acc1, acc2, acc3],
			3,
		);
		providerRepo.findByIds = async (ids) => {
			captured = ids;
			return [];
		};
		await new FindManyAccount(accountRepo, pixKeyRepo, providerRepo).execute({
			params: { page: 1, limit: 10, search: "" },
		});

		assert.deepEqual(captured?.sort(), ["prov_a", "prov_b"]);
	});
});
