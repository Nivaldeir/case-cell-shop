import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PixKey } from "@ledger/shared";

describe("PixKey — domain entity", () => {
	it("generates id with 'pix_' prefix on create", () => {
		const pk = PixKey.create({
			walletId: "wal_001",
			accountId: "acc_001",
			key: "test@email.com",
			type: "email",
			internal: true,
		});
		assert.match(pk.get("id"), /^pix_/);
	});

	it("stores key and type", () => {
		const pk = PixKey.create({
			walletId: "wal_001",
			accountId: "acc_001",
			key: "11999999999",
			type: "phone",
			internal: false,
		});
		assert.equal(pk.get("key"), "11999999999");
		assert.equal(pk.get("type"), "phone");
	});

	it("restore preserves provided id", () => {
		const pk = PixKey.restore({
			id: "pix_custom",
			walletId: "wal_001",
			accountId: "acc_001",
			key: "key",
			type: "random",
			internal: false,
		});
		assert.equal(pk.get("id"), "pix_custom");
	});

	it("stores internal flag", () => {
		const pk = PixKey.create({
			walletId: "wal_001",
			accountId: "acc_001",
			key: "key",
			type: "random",
			internal: true,
		});
		assert.equal(pk.get("internal"), true);
	});

	it("toJSON includes all fields", () => {
		const pk = PixKey.restore({
			id: "pix_001",
			walletId: "wal_001",
			accountId: "acc_001",
			key: "cpf123",
			type: "cpf",
			internal: false,
		});
		const json = pk.toJSON();
		assert.equal(json.id, "pix_001");
		assert.equal(json.key, "cpf123");
		assert.equal(json.type, "cpf");
	});
});
