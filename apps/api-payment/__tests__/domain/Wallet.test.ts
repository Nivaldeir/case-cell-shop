import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Wallet } from "@ledger/shared";

describe("Wallet — domain entity", () => {
	it("generates id with 'wal_' prefix on create", () => {
		const w = Wallet.create({
			merchantId: "merch_001",
			accPixOut: null,
			accPixIn: null,
		});
		assert.match(w.get("id"), /^wal_/);
	});

	it("stores merchantId", () => {
		const w = Wallet.create({
			merchantId: "merch_001",
			accPixOut: null,
			accPixIn: null,
		});
		assert.equal(w.get("merchantId"), "merch_001");
	});

	it("restore preserves provided id", () => {
		const w = Wallet.restore({ id: "wal_custom", merchantId: "merch_001" });
		assert.equal(w.get("id"), "wal_custom");
	});

	it("accPixIn and accPixOut default to null", () => {
		const w = Wallet.create({
			merchantId: "merch_001",
			accPixOut: null,
			accPixIn: null,
		});
		assert.equal(w.get("accPixIn"), null);
		assert.equal(w.get("accPixOut"), null);
	});

	it("stores accPixIn and accPixOut when provided", () => {
		const w = Wallet.create({
			merchantId: "merch_001",
			accPixIn: "acc_in",
			accPixOut: "acc_out",
		});
		assert.equal(w.get("accPixIn"), "acc_in");
		assert.equal(w.get("accPixOut"), "acc_out");
	});

	it("toJSON includes all fields", () => {
		const w = Wallet.restore({ id: "wal_001", merchantId: "merch_001" });
		const json = w.toJSON();
		assert.equal(json.id, "wal_001");
		assert.equal(json.merchantId, "merch_001");
	});
});
