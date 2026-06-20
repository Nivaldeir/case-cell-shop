import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	Books,
	IBookRepository,
	IMerchantRepository,
	IOrganizationRepository,
} from "@ledger/shared";
import {
	OrganizationNotFound,
	Organizations,
	WebhookMerchantMetadataIncomplete,
} from "@ledger/shared";
import { CreateOrganization } from "@/application/usecase/Organization/CreateOrganization";
import { WebhookOrganizationRequest } from "@/presentation/api/controllers/webhook/request/WebhookOrganizationRequest";

function makeOrg(
	overrides: Partial<{ id: string; legalName: string }> = {},
): Organizations {
	return Organizations.restore({
		id: overrides.id ?? "org_parent",
		parentOrganizationId: null,
		legalName: overrides.legalName ?? "Parent Org",
		status: "active",
	});
}

function makeOrgRepo(
	existing: Organizations | null = null,
): IOrganizationRepository {
	return {
		create: async () => {},
		findById: async (id: string) =>
			existing && existing.get("id") === id ? existing : null,
		update: async () => {},
		findMany: async () => ({ items: [], totalItems: 0 }),
	};
}

function makeBookRepo(): IBookRepository {
	return {
		create: async () => {},
		findByOrganizationId: async () => null,
	};
}

function makeMerchantRepo(): IMerchantRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByOrganizationId: async () => [],
		findMany: async () => ({ items: [], totalItems: 0 }),
		update: async () => {},
	};
}

function baseWebhook(overrides: Record<string, unknown> = {}) {
	return {
		type: "organization.created",
		data: {
			id: "clerk_org_1",
			name: "Nome Clerk",
			...overrides,
		},
	};
}

describe("CreateOrganization — use case", () => {
	it("cria organização e livro quando kind é customer (ou ausente)", async () => {
		let capturedOrg: Organizations | undefined;
		let capturedBook: Books | undefined;
		const orgRepo: IOrganizationRepository = {
			...makeOrgRepo(),
			create: async (o) => {
				capturedOrg = o;
			},
		};
		const bookRepo: IBookRepository = {
			...makeBookRepo(),
			create: async (b) => {
				capturedBook = b;
			},
		};
		const uc = new CreateOrganization(orgRepo, bookRepo, makeMerchantRepo());
		const input = WebhookOrganizationRequest.bodySchema.parse(
			baseWebhook({ public_metadata: { kind: "customer" } }),
		);
		const result = await uc.execute(input);
		assert.ok("organizationId" in result && "bookId" in result);
		assert.match(result.organizationId, /^org_/);
		assert.match(result.bookId, /^bk_/);
		assert.equal(capturedOrg?.get("legalName"), "Nome Clerk");
		assert.equal(capturedBook?.get("name"), "default");
	});

	it("sem public_metadata cria organização (fluxo customer)", async () => {
		const uc = new CreateOrganization(
			makeOrgRepo(),
			makeBookRepo(),
			makeMerchantRepo(),
		);
		const input = WebhookOrganizationRequest.bodySchema.parse(baseWebhook());
		const result = await uc.execute(input);
		assert.ok("organizationId" in result && "bookId" in result);
	});

	it("cria merchant quando public_metadata.kind é merchant", async () => {
		let createdMerchantId: string | undefined;
		const merchantRepo: IMerchantRepository = {
			...makeMerchantRepo(),
			create: async (m) => {
				createdMerchantId = m.get("id");
			},
		};
		const uc = new CreateOrganization(
			makeOrgRepo(makeOrg({ id: "org_parent" })),
			makeBookRepo(),
			merchantRepo,
		);
		const input = WebhookOrganizationRequest.bodySchema.parse(
			baseWebhook({
				public_metadata: {
					kind: "merchant",
					organizationId: "org_parent",
					legalName: "Loja LTDA",
					document: "12345678000199",
					email: "contato@loja.com",
					status: "active",
				},
			}),
		);
		const result = await uc.execute(input);
		assert.ok("merchantId" in result);
		if ("merchantId" in result) {
			assert.match(result.merchantId, /^mer_/);
			assert.equal(result.merchantId, createdMerchantId);
		}
	});

	it("lança WebhookMerchantMetadataIncomplete quando kind merchant sem dados", async () => {
		const uc = new CreateOrganization(
			makeOrgRepo(makeOrg()),
			makeBookRepo(),
			makeMerchantRepo(),
		);
		const bad = WebhookOrganizationRequest.bodySchema.parse(
			baseWebhook({ public_metadata: { kind: "merchant" } }),
		);
		await assert.rejects(
			() => uc.execute(bad),
			(e) => e instanceof WebhookMerchantMetadataIncomplete,
		);
	});

	it("lança OrganizationNotFound quando organização pai não existe", async () => {
		const uc = new CreateOrganization(
			makeOrgRepo(null),
			makeBookRepo(),
			makeMerchantRepo(),
		);
		const input = WebhookOrganizationRequest.bodySchema.parse(
			baseWebhook({
				public_metadata: {
					kind: "merchant",
					organizationId: "org_missing",
					legalName: "Loja",
					document: "12345678000199",
					email: "a@b.com",
				},
			}),
		);
		await assert.rejects(
			() => uc.execute(input),
			(e) => e instanceof OrganizationNotFound,
		);
	});
});
