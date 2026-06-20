import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IProviderRepository } from "@ledger/shared";
import { ProviderNotFound, Providers } from "@ledger/shared";
import { GetProviderById } from "@/application/usecase/Provider/GetProviderById";

function makeProvider(): Providers {
	return Providers.restore({
		id: "prov_001",
		code: "BANK",
		name: "Bank A",
		slug: "bank-a",
		pixIn: true,
		pixOut: false,
		dict: true,
		refund: false,
		status: "active",
		description: "Test bank",
	});
}

function makeRepo(
	provider: Providers | null = makeProvider(),
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

describe("GetProviderById — use case", () => {
	it("returns provider as JSON when found", async () => {
		const result = await new GetProviderById(makeRepo()).execute({
			providerId: "prov_001",
		});
		assert.equal(result.provider.id, "prov_001");
		assert.equal(result.provider.code, "BANK");
		assert.equal(result.provider.pixIn, true);
	});

	it("throws ProviderNotFound when provider does not exist", async () => {
		await assert.rejects(
			() =>
				new GetProviderById(makeRepo(null)).execute({ providerId: "ghost" }),
			(e) => e instanceof ProviderNotFound,
		);
	});

	it("provider.statusCode is 404 when thrown", async () => {
		await assert.rejects(
			() =>
				new GetProviderById(makeRepo(null)).execute({ providerId: "ghost" }),
			(e) => (e as ProviderNotFound).statusCode === 404,
		);
	});

	it("returns complete provider props in JSON output", async () => {
		const p = makeProvider();
		const result = await new GetProviderById(makeRepo(p)).execute({
			providerId: "prov_001",
		});
		const json = result.provider;
		assert.equal(json.slug, "bank-a");
		assert.equal(json.status, "active");
		assert.equal(json.description, "Test bank");
	});
});
