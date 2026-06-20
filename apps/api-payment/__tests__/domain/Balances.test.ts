import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Balances } from "@ledger/shared";

function makeBalance(
	overrides: Partial<Parameters<typeof Balances.restore>[0]> = {},
) {
	return Balances.restore({
		id: "bal_001",
		walletId: "wal_001",
		assetCode: "BRL",
		available: 100_00,
		onHold: 0,
		blocked: 0,
		version: 0,
		...overrides,
	});
}

describe("Balances — domain entity", () => {
	describe("create / restore", () => {
		it("generates id with 'bal_' prefix on create", () => {
			const b = Balances.create({
				walletId: "wal_001",
				assetCode: "BRL",
				available: 0,
				onHold: 0,
				blocked: 0,
			});
			assert.match(b.get("id"), /^bal_/);
		});

		it("starts with version 0 on create", () => {
			const b = Balances.create({
				walletId: "wal_001",
				assetCode: "BRL",
				available: 0,
				onHold: 0,
				blocked: 0,
			});
			assert.equal(b.get("version"), 0);
		});

		it("restore preserves provided id", () => {
			const b = makeBalance({ id: "bal_custom" });
			assert.equal(b.get("id"), "bal_custom");
		});
	});

	describe("balance getter", () => {
		it("returns sum of available + onHold + blocked", () => {
			const b = makeBalance({ available: 50, onHold: 30, blocked: 20 });
			assert.equal(b.balance, 100);
		});
	});

	describe("credit", () => {
		it("increases available and increments version", () => {
			const b = makeBalance({ available: 100_00 });
			b.credit(50_00);
			assert.equal(b.get("available"), 150_00);
			assert.equal(b.get("version"), 1);
		});

		it("throws when amount is zero", () => {
			const b = makeBalance();
			assert.throws(() => b.credit(0), /greater than zero/);
		});

		it("throws when amount is negative", () => {
			const b = makeBalance();
			assert.throws(() => b.credit(-1), /greater than zero/);
		});
	});

	describe("debit", () => {
		it("decreases available and increments version", () => {
			const b = makeBalance({ available: 100_00 });
			b.debit(30_00);
			assert.equal(b.get("available"), 70_00);
			assert.equal(b.get("version"), 1);
		});

		it("throws when amount exceeds available", () => {
			const b = makeBalance({ available: 10 });
			assert.throws(() => b.debit(20), /Balance insufficient/);
		});

		it("throws when amount is zero", () => {
			const b = makeBalance();
			assert.throws(() => b.debit(0), /greater than zero/);
		});
	});

	describe("hold / release / commitHold", () => {
		it("hold moves funds from available to onHold", () => {
			const b = makeBalance({ available: 100_00, onHold: 0 });
			b.hold(40_00);
			assert.equal(b.get("available"), 60_00);
			assert.equal(b.get("onHold"), 40_00);
		});

		it("hold throws when insufficient available", () => {
			const b = makeBalance({ available: 10 });
			assert.throws(() => b.hold(20), /Balance insufficient/);
		});

		it("release moves funds from onHold back to available", () => {
			const b = makeBalance({ available: 60_00, onHold: 40_00 });
			b.release(40_00);
			assert.equal(b.get("available"), 100_00);
			assert.equal(b.get("onHold"), 0);
		});

		it("release throws when insufficient hold", () => {
			const b = makeBalance({ onHold: 10 });
			assert.throws(() => b.release(20), /Balance hold insufficient/);
		});

		it("commitHold removes from onHold without returning to available", () => {
			const b = makeBalance({ available: 60_00, onHold: 40_00 });
			b.commitHold(40_00);
			assert.equal(b.get("available"), 60_00);
			assert.equal(b.get("onHold"), 0);
		});
	});

	describe("block / unblock", () => {
		it("block moves funds from available to blocked", () => {
			const b = makeBalance({ available: 100_00, blocked: 0 });
			b.block(25_00);
			assert.equal(b.get("available"), 75_00);
			assert.equal(b.get("blocked"), 25_00);
		});

		it("block throws when insufficient available", () => {
			const b = makeBalance({ available: 5 });
			assert.throws(() => b.block(10), /Balance insufficient/);
		});

		it("unblock moves funds from blocked to available", () => {
			const b = makeBalance({ available: 75_00, blocked: 25_00 });
			b.unblock(25_00);
			assert.equal(b.get("available"), 100_00);
			assert.equal(b.get("blocked"), 0);
		});

		it("unblock throws when insufficient blocked", () => {
			const b = makeBalance({ blocked: 10 });
			assert.throws(() => b.unblock(20), /Balance blocked insufficient/);
		});
	});

	describe("creditGrossLessFee", () => {
		it("credits gross minus fee", () => {
			const b = makeBalance({ available: 0 });
			b.creditGrossLessFee(100, 5);
			assert.equal(b.get("available"), 95);
		});

		it("credits full gross when fee is zero", () => {
			const b = makeBalance({ available: 0 });
			b.creditGrossLessFee(100, 0);
			assert.equal(b.get("available"), 100);
		});

		it("throws when fee exceeds gross", () => {
			const b = makeBalance({ available: 0 });
			assert.throws(() => b.creditGrossLessFee(10, 20), /Fee cannot exceed/);
		});

		it("throws when gross is zero", () => {
			const b = makeBalance();
			assert.throws(() => b.creditGrossLessFee(0, 0), /greater than zero/);
		});
	});
});
