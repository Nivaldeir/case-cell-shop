import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Accounts } from "@ledger/shared";

const baseProps = {
	organizationId: "00000000-0000-0000-0000-000000000001",
	parentAccountId: null,
	bookId: "00000000-0000-0000-0000-000000000002",
	customerId: "cust_abc",
	merchantId: "merch_abc",
	providerId: "prov_abc",
	accPixIn: "pix_in_abc",
	accPixOut: "pix_out_abc",
	bankName: "Bank of America",
	status: "active" as const,
	bankCode: "001",
	bankIspb: "00000000",
	agency: "0001",
	accountNumber: "123456-7",
	documentNumber: "12345678901",
	holder: "Test Holder",
	idExternal: "EXT-001",
	costPixIn: 0.5,
	costPixOut: 1.0,
};

describe("Accounts — domain entity", () => {
	describe("create()", () => {
		it("generates an ID with the 'acc_' prefix", () => {
			const account = Accounts.create(baseProps);
			assert.match(account.get("id"), /^acc_/);
		});

		it("generates a unique ID on each call", () => {
			const a = Accounts.create(baseProps);
			const b = Accounts.create(baseProps);
			assert.notEqual(a.get("id"), b.get("id"));
		});

		it("stores all supplied props", () => {
			const account = Accounts.create(baseProps);
			assert.equal(account.get("organizationId"), baseProps.organizationId);
			assert.equal(account.get("bookId"), baseProps.bookId);
			assert.equal(account.get("customerId"), baseProps.customerId);
			assert.equal(account.get("merchantId"), baseProps.merchantId);
			assert.equal(account.get("providerId"), baseProps.providerId);
			assert.equal(account.get("status"), "active");
			assert.equal(account.get("bankCode"), baseProps.bankCode);
			assert.equal(account.get("bankIspb"), baseProps.bankIspb);
			assert.equal(account.get("agency"), baseProps.agency);
			assert.equal(account.get("accountNumber"), baseProps.accountNumber);
			assert.equal(account.get("documentNumber"), baseProps.documentNumber);
			assert.equal(account.get("holder"), baseProps.holder);
			assert.equal(account.get("idExternal"), baseProps.idExternal);
			assert.equal(account.get("costPixIn"), baseProps.costPixIn);
			assert.equal(account.get("costPixOut"), baseProps.costPixOut);
			assert.equal(account.get("parentAccountId"), null);
		});

		it("defaults status to whatever is provided", () => {
			const account = Accounts.create({ ...baseProps, status: "inactive" });
			assert.equal(account.get("status"), "inactive");
		});
	});

	describe("restore()", () => {
		it("preserves the exact ID supplied", () => {
			const specificId = "acc_specificId123";
			const account = Accounts.restore({
				...baseProps,
				id: specificId,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			assert.equal(account.get("id"), specificId);
		});

		it("restores all props exactly", () => {
			const props = { ...baseProps, id: "acc_xyz" };
			const account = Accounts.restore({
				...props,
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			const json = account.toJSON();
			assert.equal(json.id, props.id);
			assert.equal(json.organizationId, props.organizationId);
			assert.equal(json.status, props.status);
			assert.equal(json.holder, props.holder);
		});
	});

	describe("isActive() / isInactive()", () => {
		it("isActive is true only for active status", () => {
			assert.ok(Accounts.create(baseProps).isActive());
			assert.ok(
				!Accounts.create({ ...baseProps, status: "inactive" }).isActive(),
			);
			assert.ok(
				!Accounts.create({ ...baseProps, status: "suspended" }).isActive(),
			);
			assert.ok(
				!Accounts.create({ ...baseProps, status: "blocked" }).isActive(),
			);
		});

		it("isInactive is true only for inactive status", () => {
			assert.ok(!Accounts.create(baseProps).isActive());
			assert.ok(
				Accounts.create({ ...baseProps, status: "inactive" }).isActive(),
			);
			assert.ok(
				!Accounts.create({ ...baseProps, status: "suspended" }).isActive(),
			);
		});
	});

	describe("set() / get()", () => {
		it("updates a single field", () => {
			const account = Accounts.create(baseProps);
			account.set("status", "blocked");
			assert.equal(account.get("status"), "blocked");
		});

		it("does not affect other fields when one is mutated", () => {
			const account = Accounts.create(baseProps);
			account.set("holder", "New Holder");
			assert.equal(account.get("bankCode"), baseProps.bankCode);
		});
	});

	describe("toJSON()", () => {
		it("returns a frozen object with all props", () => {
			const account = Accounts.create(baseProps);
			const json = account.toJSON();
			assert.ok(Object.isFrozen(json));
			assert.equal(json.holder, baseProps.holder);
		});

		it("snapshot does not reflect subsequent mutations", () => {
			const account = Accounts.create(baseProps);
			const json = account.toJSON();
			account.set("holder", "Changed After Snapshot");
			assert.equal(json.holder, baseProps.holder);
		});
	});
});
