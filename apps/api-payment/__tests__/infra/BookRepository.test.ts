/**
 * BookRepository — integration tests.
 *
 * Uses the PostgreSQL testcontainer started in setup.ts.
 * Organizations are created as FK prerequisites.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { before, describe, it } from "node:test";
import {
	BookRepository,
	Books,
	OrganizationRepository,
	Organizations,
} from "@ledger/shared";

function makeOrg(): Organizations {
	return Organizations.create({
		externalId: randomUUID(),
		parentOrganizationId: null,
		legalName: `Org ${Date.now()} ${Math.random().toString(36).slice(2)}`,
		legalDocument: `${Math.floor(Math.random() * 9e13)
			.toString()
			.padStart(14, "0")}`,
		status: "active",
	});
}

function makeBook(organizationId: string, name = "default"): Books {
	return Books.create({ name, organizationId });
}

describe("BookRepository (integration)", { timeout: 30_000 }, () => {
	let bookRepo: BookRepository;
	let orgRepo: OrganizationRepository;

	before(() => {
		bookRepo = new BookRepository();
		orgRepo = new OrganizationRepository();
	});

	describe("create() + findByOrganizationId()", () => {
		it("persists a book and retrieves it by organizationId", async () => {
			const org = makeOrg();
			await orgRepo.create(org);
			const book = makeBook(org.get("id"), "main");
			await bookRepo.create(book);

			const found = await bookRepo.findByOrganizationId(org.get("id"));
			assert.ok(found, "should find the inserted book");
			assert.equal(found.get("id"), book.get("id"));
			assert.equal(found.get("name"), "main");
			assert.equal(found.get("organizationId"), org.get("id"));
		});

		it("returns null when organization has no books", async () => {
			const org = makeOrg();
			await orgRepo.create(org);

			const result = await bookRepo.findByOrganizationId(org.get("id"));
			assert.equal(result, null);
		});

		it("returns null for a non-existent organizationId", async () => {
			const result = await bookRepo.findByOrganizationId(
				"00000000-0000-0000-0000-000000000000",
			);
			assert.equal(result, null);
		});
	});

	describe("book ID prefix", () => {
		it("generated book ID starts with 'bk_'", async () => {
			const org = makeOrg();
			await orgRepo.create(org);
			const book = makeBook(org.get("id"));
			await bookRepo.create(book);

			const found = await bookRepo.findByOrganizationId(org.get("id"));
			assert.ok(found?.get("id").startsWith("bk_"));
		});
	});
});
