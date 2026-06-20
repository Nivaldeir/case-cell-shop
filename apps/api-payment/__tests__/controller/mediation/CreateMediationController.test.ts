import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { Request, Response } from "express";
import type {
	CreateMediation,
	CreateMediationInput,
	MediationResult,
} from "@/application/usecase/Mediation/CreateMediation";
import { CreateMediationController } from "@/presentation/api/controllers/mediation/CreateMediationController";

const INFRACTION_ID = randomUUID();

function makeResult(overrides: Partial<MediationResult> = {}): MediationResult {
	return {
		id: randomUUID(),
		infractionId: INFRACTION_ID,
		defense: null,
		attachments: ["https://s3/a.png"],
		createdAt: new Date(),
		updatedAt: new Date(),
		...overrides,
	};
}

function makeUseCase(
	result: MediationResult = makeResult(),
	onExecute?: (input: CreateMediationInput) => void,
): CreateMediation {
	return {
		execute: async (input: CreateMediationInput) => {
			onExecute?.(input);
			return result;
		},
	} as unknown as CreateMediation;
}

type FakeFile = {
	buffer: Buffer;
	originalname: string;
	mimetype: string;
	size: number;
};

function makeFile(name = "receipt.png", mimetype = "image/png"): FakeFile {
	return {
		buffer: Buffer.from("data"),
		originalname: name,
		mimetype,
		size: 4,
	};
}

function makeReq(body: Record<string, unknown>, files: FakeFile[]): Request {
	return { body, files, params: {}, query: {} } as unknown as Request;
}

type MockRes = {
	statusCode: number;
	body: unknown;
	status(c: number): MockRes;
	json(d: unknown): MockRes;
};
function makeRes(): MockRes {
	const r: MockRes = {
		statusCode: 200,
		body: undefined,
		status(c) {
			this.statusCode = c;
			return this;
		},
		json(d) {
			this.body = d;
			return this;
		},
	};
	return r;
}

describe("CreateMediationController — unit", () => {
	it("responds 201 with error:false and the mediation result", async () => {
		const ctrl = new CreateMediationController(makeUseCase());
		const res = makeRes();

		await ctrl.handle(
			makeReq({ infractionId: INFRACTION_ID }, [makeFile()]),
			res as unknown as Response,
		);

		assert.equal(res.statusCode, 201);
		const body = res.body as { error: boolean; data: MediationResult };
		assert.equal(body.error, false);
		assert.deepEqual(body.data.attachments, ["https://s3/a.png"]);
	});

	it("forwards the parsed fields and files to the use case", async () => {
		let captured: CreateMediationInput | undefined;
		const ctrl = new CreateMediationController(
			makeUseCase(makeResult(), (input) => {
				captured = input;
			}),
		);
		const res = makeRes();

		await ctrl.handle(
			makeReq({ infractionId: INFRACTION_ID, defense: "authorized" }, [
				makeFile("a.png"),
				makeFile("b.pdf", "application/pdf"),
			]),
			res as unknown as Response,
		);

		assert.equal(captured?.infractionId, INFRACTION_ID);
		assert.equal(captured?.defense, "authorized");
		assert.equal(captured?.files.length, 2);
		assert.equal(captured?.files[0]?.originalname, "a.png");
	});

	it("defaults to an empty file list when no files are uploaded", async () => {
		let captured: CreateMediationInput | undefined;
		const ctrl = new CreateMediationController(
			makeUseCase(makeResult(), (input) => {
				captured = input;
			}),
		);
		const res = makeRes();

		await ctrl.handle(
			{
				body: { infractionId: INFRACTION_ID },
				params: {},
				query: {},
			} as unknown as Request,
			res as unknown as Response,
		);

		assert.deepEqual(captured?.files, []);
	});
});
