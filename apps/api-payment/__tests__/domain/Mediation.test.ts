import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { Mediation } from "@ledger/shared";

const INFRACTION_ID = randomUUID();

describe("Mediation — domain entity", () => {
	it("create() generates a uuid id", () => {
		const m = Mediation.create({
			infractionId: INFRACTION_ID,
			defense: "authorized by the customer",
			attachments: ["https://s3/a.png"],
		});
		assert.match(
			m.get("id") ?? "",
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	it("create() stamps createdAt and updatedAt", () => {
		const m = Mediation.create({
			infractionId: INFRACTION_ID,
			attachments: ["a"],
		});
		assert.ok(m.get("createdAt") instanceof Date);
		assert.ok(m.get("updatedAt") instanceof Date);
	});

	it("create() preserves the infraction id and attachments", () => {
		const m = Mediation.create({
			infractionId: INFRACTION_ID,
			attachments: ["a", "b"],
		});
		assert.equal(m.get("infractionId"), INFRACTION_ID);
		assert.deepEqual(m.get("attachments"), ["a", "b"]);
	});

	it("create() allows a null/absent defense", () => {
		const m = Mediation.create({
			infractionId: INFRACTION_ID,
			attachments: ["a"],
		});
		assert.equal(m.get("defense") ?? null, null);
	});

	it("restore() preserves the provided id and defense", () => {
		const id = randomUUID();
		const m = Mediation.restore({
			id,
			infractionId: INFRACTION_ID,
			defense: "my defense",
			attachments: ["a"],
		});
		assert.equal(m.get("id"), id);
		assert.equal(m.get("defense"), "my defense");
	});
});
