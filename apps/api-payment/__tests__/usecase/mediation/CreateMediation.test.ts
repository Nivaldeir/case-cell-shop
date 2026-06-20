import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type {
	IInfractionRepository,
	IMediationRepository,
	Infraction,
	Mediation,
} from "@ledger/shared";
import {
	InfractionNotFoundError,
	MediationAlreadyExistsError,
	MediationAttachmentsRequiredError,
} from "@ledger/shared";
import type {
	IMediationAttachmentService,
	MediationUploadFile,
} from "@/application/services/IMediationAttachmentService";
import { CreateMediation } from "@/application/usecase/Mediation/CreateMediation";

const INFRACTION_ID = randomUUID();
const TX_ID = randomUUID();

const existingInfraction = {
	get: (key: string) => (key === "transactionId" ? TX_ID : INFRACTION_ID),
} as unknown as Infraction;

function makeInfractionRepo(found: Infraction | null): IInfractionRepository {
	return {
		findById: async () => found,
	} as unknown as IInfractionRepository;
}

function makeMediationRepo(
	overrides: Partial<IMediationRepository> = {},
): IMediationRepository {
	return {
		create: async () => {},
		findById: async () => null,
		findByInfractionId: async () => null,
		existsByInfractionId: async () => false,
		findMany: async () => ({ items: [], totalItems: 0 }),
		...overrides,
	};
}

function makeAttachmentService(
	urls: string[] = ["https://s3/file.png"],
	onUpload?: (referenceId: string, files: MediationUploadFile[]) => void,
): IMediationAttachmentService {
	return {
		upload: async (referenceId, files) => {
			onUpload?.(referenceId, files);
			return urls;
		},
	};
}

function makeFile(
	mimetype = "image/png",
	name = "receipt.png",
): MediationUploadFile {
	return { buffer: Buffer.from("data"), originalname: name, mimetype };
}

describe("CreateMediation — use case", () => {
	it("creates a mediation and returns the uploaded URLs", async () => {
		const urls = ["https://s3/a.png", "https://s3/b.pdf"];
		let created: Mediation | undefined;

		const useCase = new CreateMediation(
			makeInfractionRepo(existingInfraction),
			makeMediationRepo({
				create: async (m) => {
					created = m;
				},
			}),
			makeAttachmentService(urls),
		);

		const result = await useCase.execute({
			infractionId: INFRACTION_ID,
			defense: "authorized",
			files: [makeFile(), makeFile("application/pdf", "b.pdf")],
		});

		assert.equal(result.infractionId, INFRACTION_ID);
		assert.equal(result.defense, "authorized");
		assert.deepEqual(result.attachments, urls);
		assert.ok(created, "repository.create should have been called");
		assert.deepEqual(created?.get("attachments"), urls);
	});

	it("namespaces the upload by the infraction's transaction id", async () => {
		let capturedRef: string | undefined;
		let capturedCount = 0;

		const useCase = new CreateMediation(
			makeInfractionRepo(existingInfraction),
			makeMediationRepo(),
			makeAttachmentService(["https://s3/a.png"], (referenceId, files) => {
				capturedRef = referenceId;
				capturedCount = files.length;
			}),
		);

		await useCase.execute({ infractionId: INFRACTION_ID, files: [makeFile()] });

		assert.equal(capturedRef, TX_ID);
		assert.equal(capturedCount, 1);
	});

	it("throws InfractionNotFoundError when the infraction does not exist", async () => {
		const useCase = new CreateMediation(
			makeInfractionRepo(null),
			makeMediationRepo(),
			makeAttachmentService(),
		);

		await assert.rejects(
			() =>
				useCase.execute({ infractionId: INFRACTION_ID, files: [makeFile()] }),
			InfractionNotFoundError,
		);
	});

	it("throws MediationAlreadyExistsError when the infraction already has a mediation", async () => {
		const useCase = new CreateMediation(
			makeInfractionRepo(existingInfraction),
			makeMediationRepo({ existsByInfractionId: async () => true }),
			makeAttachmentService(),
		);

		await assert.rejects(
			() =>
				useCase.execute({ infractionId: INFRACTION_ID, files: [makeFile()] }),
			MediationAlreadyExistsError,
		);
	});

	it("throws MediationAttachmentsRequiredError when no files are provided", async () => {
		const useCase = new CreateMediation(
			makeInfractionRepo(existingInfraction),
			makeMediationRepo(),
			makeAttachmentService(),
		);

		await assert.rejects(
			() => useCase.execute({ infractionId: INFRACTION_ID, files: [] }),
			MediationAttachmentsRequiredError,
		);
	});
});
