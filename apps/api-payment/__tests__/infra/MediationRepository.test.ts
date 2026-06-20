import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import { transactions } from "@ledger/db";
import {
	Infraction,
	InfractionRepository,
	InfractionStatus,
	InfractionType,
	Mediation,
	MediationRepository,
	runInTransaction,
} from "@ledger/shared";
import { sql } from "drizzle-orm";

async function seedTransaction(): Promise<string> {
	const id = randomUUID();

	await runInTransaction(async (tx) => {
		await tx.execute(sql`SET LOCAL session_replication_role = 'replica'`);
		await tx.insert(transactions).values({
			id,
			amount: "100.00000000",
			currency: "BRL",
			status: "completed",
			type: "pix_in",
			method: "pix",
			accountId: randomUUID(),
			createdAt: new Date(),
			updatedAt: new Date(),
		});
	});

	return id;
}

async function seedInfraction(): Promise<string> {
	const transactionId = await seedTransaction();
	const infraction = Infraction.create({
		transactionId,
		providerCode: "fyhub",
		status: InfractionStatus.OPEN,
		type: InfractionType.FRAUD,
		amount: 100,
	});

	await new InfractionRepository().create(infraction);

	return infraction.get("id") ?? "";
}

function makeMediation(
	infractionId: string,
	attachments = ["https://s3/a.png"],
) {
	return Mediation.create({ infractionId, defense: "authorized", attachments });
}

describe("MediationRepository (integration)", { timeout: 30_000 }, () => {
	let repo: MediationRepository;

	before(() => {
		repo = new MediationRepository();
	});

	describe("create() + findById()", () => {
		it("persists a mediation and retrieves it with defense and attachments", async () => {
			const infractionId = await seedInfraction();
			const mediation = makeMediation(infractionId, [
				"https://s3/a.png",
				"https://s3/b.pdf",
			]);
			await repo.create(mediation);

			const found = await repo.findById(mediation.get("id") ?? "");
			assert.ok(found, "should find the inserted mediation");
			assert.equal(found.mediation.get("infractionId"), infractionId);
			assert.equal(found.mediation.get("defense"), "authorized");
			assert.deepEqual(found.mediation.get("attachments"), [
				"https://s3/a.png",
				"https://s3/b.pdf",
			]);
			assert.equal(found.infraction.get("id"), infractionId);
		});

		it("returns null for a non-existent id", async () => {
			const result = await repo.findById(randomUUID());
			assert.equal(result, null);
		});
	});

	describe("findByInfractionId()", () => {
		it("returns the mediation opened against the infraction", async () => {
			const infractionId = await seedInfraction();
			await repo.create(makeMediation(infractionId));

			const found = await repo.findByInfractionId(infractionId);
			assert.ok(found, "should find by infraction id");
			assert.equal(found.get("infractionId"), infractionId);
		});

		it("returns null when none exist", async () => {
			const found = await repo.findByInfractionId(randomUUID());
			assert.equal(found, null);
		});
	});

	describe("existsByInfractionId()", () => {
		it("returns true after create and false for a random infraction id", async () => {
			const infractionId = await seedInfraction();
			await repo.create(makeMediation(infractionId));

			assert.equal(await repo.existsByInfractionId(infractionId), true);
			assert.equal(await repo.existsByInfractionId(randomUUID()), false);
		});
	});
});
