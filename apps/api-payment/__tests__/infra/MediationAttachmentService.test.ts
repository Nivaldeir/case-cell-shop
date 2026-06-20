import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { MediationInvalidAttachmentError } from "@ledger/shared";
import type { MediationUploadFile } from "@/application/services/IMediationAttachmentService";
import { MediationAttachmentService } from "@/infra/services/MediationAttachmentService";
import type { S3Service } from "@/infra/services/S3Service";

const TX_ID = randomUUID();

function makeS3(
	uploads?: Array<{ key: string; contentType: string }>,
): S3Service {
	return {
		uploadFile: async (key: string, _body: Buffer, contentType: string) => {
			uploads?.push({ key, contentType });
			return `https://bucket.s3.amazonaws.com/${key}`;
		},
	} as unknown as S3Service;
}

function makeFile(mimetype: string, name = "file"): MediationUploadFile {
	return { buffer: Buffer.from("data"), originalname: name, mimetype };
}

describe("MediationAttachmentService — unit", () => {
	it("uploads each file and returns one URL per file", async () => {
		const service = new MediationAttachmentService(makeS3());

		const urls = await service.upload(TX_ID, [
			makeFile("image/png", "a.png"),
			makeFile("application/pdf", "b.pdf"),
		]);

		assert.equal(urls.length, 2);
		for (const url of urls) {
			assert.match(url, /^https:\/\/bucket\.s3/);
		}
	});

	it("namespaces S3 keys under mediations/<transactionId>/", async () => {
		const uploads: Array<{ key: string; contentType: string }> = [];
		const service = new MediationAttachmentService(makeS3(uploads));

		await service.upload(TX_ID, [makeFile("image/png", "a.png")]);

		assert.equal(uploads.length, 1);
		assert.ok(uploads[0]?.key.startsWith(`mediations/${TX_ID}/`));
		assert.ok(uploads[0]?.key.endsWith("a.png"));
	});

	it("accepts common image and document types (.jpg, .docx)", async () => {
		const service = new MediationAttachmentService(makeS3());

		const urls = await service.upload(TX_ID, [
			makeFile("image/jpeg", "photo.jpg"),
			makeFile(
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				"contract.docx",
			),
		]);

		assert.equal(urls.length, 2);
	});

	it("rejects unsupported content types", async () => {
		const service = new MediationAttachmentService(makeS3());

		await assert.rejects(
			() => service.upload(TX_ID, [makeFile("application/zip", "evil.zip")]),
			MediationInvalidAttachmentError,
		);
	});
});
