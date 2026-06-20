import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Providers } from "@ledger/shared";

const baseProps = {
	code: "BANK_A",
	name: "Bank A",
	slug: "bank-a",
	pixIn: true,
	pixOut: true,
	dict: false,
	refund: false,
	status: "active" as const,
	description: "Test provider",
};

describe("Providers — domain entity", () => {
	describe("create()", () => {
		it("generates an ID with the 'prov_' prefix", () => {
			const provider = Providers.create(baseProps);
			assert.match(provider.get("id"), /^prov_/);
		});

		it("generates a unique ID on each call", () => {
			const a = Providers.create(baseProps);
			const b = Providers.create(baseProps);
			assert.notEqual(a.get("id"), b.get("id"));
		});

		it("stores all supplied props correctly", () => {
			const provider = Providers.create(baseProps);
			assert.equal(provider.get("code"), baseProps.code);
			assert.equal(provider.get("name"), baseProps.name);
			assert.equal(provider.get("slug"), baseProps.slug);
			assert.equal(provider.get("pixIn"), true);
			assert.equal(provider.get("pixOut"), true);
			assert.equal(provider.get("dict"), false);
			assert.equal(provider.get("refund"), false);
			assert.equal(provider.get("status"), "active");
			assert.equal(provider.get("description"), baseProps.description);
		});

		it("accepts 'deactivated' as status", () => {
			const provider = Providers.create({
				...baseProps,
				status: "deactivated",
			});
			assert.equal(provider.get("status"), "deactivated");
		});
	});

	describe("restore()", () => {
		it("preserves the exact ID supplied", () => {
			const id = "prov_fixedId000";
			const provider = Providers.restore({ ...baseProps, id });
			assert.equal(provider.get("id"), id);
		});

		it("restores all props exactly", () => {
			const props = {
				...baseProps,
				id: "prov_abc",
				createdAt: new Date("2024-01-01"),
				updatedAt: new Date("2024-06-01"),
			};
			const provider = Providers.restore(props);
			const json = provider.toJSON();
			assert.equal(json.id, props.id);
			assert.equal(json.code, props.code);
			assert.deepEqual(json.createdAt, props.createdAt);
		});
	});

	describe("isActive() / supportsPixIn() / supportsPixOut()", () => {
		it("isActive reflects status", () => {
			assert.ok(Providers.create(baseProps).isActive());
			assert.ok(
				!Providers.create({ ...baseProps, status: "deactivated" }).isActive(),
			);
		});

		it("supportsPixIn and supportsPixOut reflect flags", () => {
			const p = Providers.create(baseProps);
			assert.ok(p.supportsPixIn());
			assert.ok(p.supportsPixOut());
			const limited = Providers.create({
				...baseProps,
				pixIn: false,
				pixOut: false,
			});
			assert.ok(!limited.supportsPixIn());
			assert.ok(!limited.supportsPixOut());
		});
	});

	describe("set() / get()", () => {
		it("updates status field", () => {
			const provider = Providers.create(baseProps);
			provider.set("status", "deactivated");
			assert.equal(provider.get("status"), "deactivated");
		});

		it("updates boolean capability flags", () => {
			const provider = Providers.create(baseProps);
			provider.set("dict", true);
			assert.equal(provider.get("dict"), true);
			assert.equal(provider.get("pixIn"), true); // unchanged
		});
	});

	describe("toJSON()", () => {
		it("returns a frozen snapshot", () => {
			const provider = Providers.create(baseProps);
			const json = provider.toJSON();
			assert.ok(Object.isFrozen(json));
		});

		it("snapshot is not affected by later mutations", () => {
			const provider = Providers.create(baseProps);
			const json = provider.toJSON();
			provider.set("name", "Changed");
			assert.equal(json.name, baseProps.name);
		});
	});
});
