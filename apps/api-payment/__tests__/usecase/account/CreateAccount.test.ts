/**
 * CreateAccount use case — unit tests.
 *
 * Repositories are fully mocked; the real `runInTransaction` is exercised
 * against the testcontainer DB started in setup.ts, but no data is persisted
 * because every repo method is a no-op.
 *
 * Validation paths (thrown before the transaction) are the primary focus.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	IAccountCredentialsRepository,
	IAccountRepository,
	IBalanceRepository,
	IBookRepository,
	ICustomerRepository,
	IFeesRepository,
	IMerchantRepository,
	IOrganizationRepository,
	IPixKeyRepository,
	IProviderRepository,
} from "@ledger/shared";
import {
	BookNotFound,
	Books,
	CustomerMerchantMismatch,
	CustomerNotFound,
	Customers,
	MerchantNotFound,
	MerchantOrganizationMismatch,
	Merchants,
	OrganizationInactive,
	OrganizationNotFound,
	Organizations,
	ProviderNotFound,
	Providers,
} from "@ledger/shared";
import { CreateAccount } from "@/application/usecase/Account/CreateAccount";

// ── Test fixtures ─────────────────────────────────────────────────────────────
const ORG_ID = "00000000-0000-0000-0000-000000000001";
const MERCHANT_ID = "merch_001";
const CUSTOMER_ID = "cust_001";
const PROVIDER_ID = "prov_001";
const BOOK_ID = "book_001";

function makeOrg(
	status: "active" | "inactive" | "suspended" | "blocked" = "active",
) {
	return Organizations.restore({
		id: ORG_ID,
		externalId: "ext-001",
		parentOrganizationId: null,
		legalName: "Acme Corp",
		legalDocument: "12345678000100",
		status,
	});
}

function makeMerchant(organizationId = ORG_ID) {
	return Merchants.restore({
		id: MERCHANT_ID,
		organizationId,
		legalName: "Acme Merchant",
		legalDocument: "98765432000100",
		status: "active",
	});
}

function makeCustomer(merchantId = MERCHANT_ID) {
	return Customers.restore({
		id: CUSTOMER_ID,
		merchantId,
		externalId: "cust-ext-001",
		name: "john doe",
		documentNumber: "12345678901",
		email: "john@example.com",
		status: "active",
	});
}

function makeBook() {
	return Books.restore({
		id: BOOK_ID,
		name: "Main Book",
		organizationId: ORG_ID,
	});
}

function makeProvider() {
	return Providers.restore({
		id: PROVIDER_ID,
		code: "BANK",
		name: "Bank",
		slug: "bank",
		pixIn: true,
		pixOut: true,
		dict: false,
		refund: false,
		status: "active",
		description: "desc",
	});
}

// ── Mock repo factories ───────────────────────────────────────────────────────
function makeOrgRepo(
	org: ReturnType<typeof makeOrg> | null = makeOrg(),
): IOrganizationRepository {
	return {
		create: async () => {},
		findById: async () => org,
		findByExternalId: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
	};
}

function makeBookRepo(
	book: ReturnType<typeof makeBook> | null = makeBook(),
): IBookRepository {
	return {
		create: async () => {},
		findByOrganizationId: async () => book,
	};
}

function makeMerchantRepo(
	merchant: ReturnType<typeof makeMerchant> | null = makeMerchant(),
): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => merchant,
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function makeCustomerRepo(
	customer: ReturnType<typeof makeCustomer> | null = makeCustomer(),
): ICustomerRepository {
	return {
		create: async () => {},
		findById: async () => customer,
		findByExternalIdAndMerchantId: async () => null,
		findByMerchantId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function makeProviderRepo(
	provider: ReturnType<typeof makeProvider> | null = makeProvider(),
): IProviderRepository {
	return {
		create: async () => {},
		findById: async () => provider,
		findByIds: async () => [],
		findIdByCode: async () => null,
		findIdBySlug: async () => null,
		findIdByCodeExcluding: async () => null,
		findIdBySlugExcluding: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function makeAccountRepo(): IAccountRepository {
	return {
		create: async () => {},
		createTx: async () => {},
		findById: async () => null,
		findMany: async () => ({ items: [], totalItems: 0 }),
		findByOrganizationId: async () => [],
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

function makeBalanceRepo(): IBalanceRepository {
	return {
		createMany: async () => {},
		createManyTx: async () => {},
		findByAccountId: async () => null,
		findByWalletId: async () => null,
		update: async () => null,
		updateTx: async () => null,
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

// ── Default valid input ───────────────────────────────────────────────────────
const validInput = {
	organizationId: ORG_ID,
	idExternal: "EXT-001",
	merchantId: MERCHANT_ID,
	customerId: CUSTOMER_ID,
	providerId: PROVIDER_ID,
	bankName: "Banco Teste",
	bankCode: "001",
	bankIspb: "00000000",
	agency: "0001",
	accountNumber: "123456-7",
	documentNumber: "12345678901",
	holder: "John Doe",
	assets: ["BRL"],
	costPixIn: 0.5,
	costPixOut: 1.0,
};

function makeUseCase(
	overrides: {
		orgRepo?: IOrganizationRepository;
		bookRepo?: IBookRepository;
		merchantRepo?: IMerchantRepository;
		customerRepo?: ICustomerRepository;
		providerRepo?: IProviderRepository;
	} = {},
) {
	return new CreateAccount(
		overrides.orgRepo ?? makeOrgRepo(),
		overrides.bookRepo ?? makeBookRepo(),
		makeAccountRepo(),
		overrides.customerRepo ?? makeCustomerRepo(),
		overrides.merchantRepo ?? makeMerchantRepo(),
		makeCredentialsRepo(),
		makeFeesRepo(),
		makeBalanceRepo(),
		makePixKeyRepo(),
		overrides.providerRepo ?? makeProviderRepo(),
	);
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("CreateAccount — use case", () => {
	describe("Validation: Organization", () => {
		it("throws OrganizationNotFound when org does not exist", async () => {
			const uc = makeUseCase({ orgRepo: makeOrgRepo(null) });
			await assert.rejects(
				() => uc.execute(validInput),
				(e) => e instanceof OrganizationNotFound,
			);
		});

		it("throws OrganizationInactive when org status is 'inactive'", async () => {
			const uc = makeUseCase({ orgRepo: makeOrgRepo(makeOrg("inactive")) });
			await assert.rejects(
				() => uc.execute(validInput),
				(e) => e instanceof OrganizationInactive,
			);
		});

		it("throws OrganizationInactive when org status is 'suspended'", async () => {
			const uc = makeUseCase({ orgRepo: makeOrgRepo(makeOrg("suspended")) });
			await assert.rejects(
				() => uc.execute(validInput),
				(e) => e instanceof OrganizationInactive,
			);
		});

		it("throws OrganizationInactive when org status is 'blocked'", async () => {
			const uc = makeUseCase({ orgRepo: makeOrgRepo(makeOrg("blocked")) });
			await assert.rejects(
				() => uc.execute(validInput),
				(e) => e instanceof OrganizationInactive,
			);
		});
	});

	describe("Validation: Book", () => {
		it("throws BookNotFound when no book exists for the org", async () => {
			const uc = makeUseCase({ bookRepo: makeBookRepo(null) });
			await assert.rejects(
				() => uc.execute(validInput),
				(e) => e instanceof BookNotFound,
			);
		});
	});

	describe("Validation: Merchant", () => {
		it("throws MerchantNotFound when merchant does not exist", async () => {
			const uc = makeUseCase({ merchantRepo: makeMerchantRepo(null) });
			await assert.rejects(
				() => uc.execute(validInput),
				(e) => e instanceof MerchantNotFound,
			);
		});

		it("throws MerchantOrganizationMismatch when merchant belongs to different org", async () => {
			const wrongMerchant = makeMerchant(
				"00000000-0000-0000-0000-000000000099",
			);
			const uc = makeUseCase({ merchantRepo: makeMerchantRepo(wrongMerchant) });
			await assert.rejects(
				() => uc.execute(validInput),
				(e) => e instanceof MerchantOrganizationMismatch,
			);
		});
	});

	describe("Validation: Customer", () => {
		it("throws CustomerNotFound when customer does not exist", async () => {
			const uc = makeUseCase({ customerRepo: makeCustomerRepo(null) });
			await assert.rejects(
				() => uc.execute(validInput),
				(e) => e instanceof CustomerNotFound,
			);
		});

		it("throws CustomerMerchantMismatch when customer belongs to different merchant", async () => {
			const wrongCustomer = makeCustomer("merch_other");
			const uc = makeUseCase({ customerRepo: makeCustomerRepo(wrongCustomer) });
			await assert.rejects(
				() => uc.execute(validInput),
				(e) => e instanceof CustomerMerchantMismatch,
			);
		});
	});

	describe("Validation: Provider", () => {
		it("throws ProviderNotFound when provider does not exist", async () => {
			const uc = makeUseCase({ providerRepo: makeProviderRepo(null) });
			await assert.rejects(
				() => uc.execute(validInput),
				(e) => e instanceof ProviderNotFound,
			);
		});
	});

	describe("Success path", () => {
		it("returns accountId with 'acc_' prefix", async () => {
			const uc = makeUseCase();
			const result = await uc.execute(validInput);
			assert.match(result.accountId, /^acc_/);
		});

		it("returns the book's ID as bookId", async () => {
			const uc = makeUseCase();
			const result = await uc.execute(validInput);
			assert.equal(result.bookId, BOOK_ID);
		});

		it("returns a balancesId for each asset", async () => {
			const uc = makeUseCase();
			const result = await uc.execute({
				...validInput,
				assets: ["BRL", "USD"],
			});
			assert.equal(result.balancesId.length, 2);
		});

		it("returns empty pixKeyId when no pixKey is provided", async () => {
			const uc = makeUseCase();
			const result = await uc.execute(validInput);
			assert.equal(result.pixKeyId, "");
		});

		it("returns a feesId with 'fee_' prefix", async () => {
			const uc = makeUseCase();
			const result = await uc.execute(validInput);
			assert.match(result.feesId, /^fee_/);
		});

		it("trims idExternal before storing", async () => {
			let capturedAccount: any;
			const customAccountRepo: IAccountRepository = {
				...makeAccountRepo(),
				createTx: async (acc) => {
					capturedAccount = acc;
				},
			};
			const uc = new CreateAccount(
				makeOrgRepo(),
				makeBookRepo(),
				customAccountRepo,
				makeCustomerRepo(),
				makeMerchantRepo(),
				makeCredentialsRepo(),
				makeFeesRepo(),
				makeBalanceRepo(),
				makePixKeyRepo(),
				makeProviderRepo(),
			);
			await uc.execute({ ...validInput, idExternal: "  EXT-TRIMMED  " });
			assert.equal(capturedAccount.get("idExternal"), "EXT-TRIMMED");
		});
	});
});
