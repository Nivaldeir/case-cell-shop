import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { WebhookAccountController } from "../../../../src/presentation/api/controllers/webhook/WebhookAccountController";
import { AccountNotFound } from "../../../../src/shared/errors/AccountErrors";
import { BookNotFound } from "../../../../src/shared/errors/BookErrors";
import {
	OrganizationInactive,
	OrganizationNotFound,
} from "../../../../src/shared/errors/OrganizationErros";
import { MakeSut } from "../../helpers/make-sut";

describe("WebhookAccountController", () => {
	describe("Success cases", () => {
		it("should return 201 when use case executes successfully", async () => {
			const req = MakeSut.Request(
				{},
				{
					organizationId: "org_12345",
					providerId: "provider_x",
					bankCode: "001",
					bankIspb: "12345678",
				},
			);
			const res = MakeSut.Response();
			const mockResult = { accountId: "acc_1", bookId: "book_1" };
			const execute = mock.fn(async () => mockResult);
			const sut = new WebhookAccountController({ execute } as never);

			await sut.handle(req, res);

			assert.strictEqual(execute.mock.callCount(), 1);
			assert.strictEqual((res as any).status.mock.callCount(), 1);
			assert.strictEqual((res as any).status.mock.calls[0]?.arguments[0], 201);
			assert.deepStrictEqual((res as any).json.mock.calls[0]?.arguments[0], {
				message: "Webhook processing success.",
				error: false,
				data: mockResult,
			});
		});
	});

	describe("Error cases", () => {
		const errorScenarios = [
			{ name: "BookNotFound", error: new BookNotFound("1") },
			{ name: "AccountNotFound", error: new AccountNotFound("1") },
			{ name: "OrganizationNotFound", error: new OrganizationNotFound("1") },
			{
				name: "OrganizationInactive",
				error: new OrganizationInactive("1", "status"),
			},
		];

		for (const { name, error } of errorScenarios) {
			it(`should propagate ${name}`, async () => {
				const req = MakeSut.Request(
					{},
					{
						organizationId: "org_12345",
						providerId: "provider_x",
						bankCode: "001",
						bankIspb: "12345678",
					},
				);
				const res = MakeSut.Response();
				const execute = mock.fn(async () => {
					throw error;
				});
				const sut = new WebhookAccountController({ execute } as never);

				await assert.rejects(() => sut.handle(req, res), error);
			});
		}
	});
});
