import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { WebhookOrganizationController } from "../../../../src/presentation/api/controllers/webhook/WebhookOrganizationController";
import { MakeSut } from "../../helpers/make-sut";

describe("WebhookOrganizationController", () => {
	describe("Success cases", () => {
		it("should return 200 when use case executes successfully", async () => {
			const req = MakeSut.Request(
				{},
				{
					type: "organization.created",
					data: {
						id: "clerk_org_1",
						name: "Atlas FX LTDA",
					},
				},
			);
			const res = MakeSut.Response();
			const mockResult = { organizationId: "org_12345", bookId: "bk_1" };
			const execute = mock.fn(async () => mockResult);
			const sut = new WebhookOrganizationController({ execute } as never);

			await sut.handle(req, res);

			assert.strictEqual(execute.mock.callCount(), 1);
			assert.strictEqual((res as any).status.mock.callCount(), 1);
			assert.strictEqual((res as any).status.mock.calls[0]?.arguments[0], 200);
			assert.deepStrictEqual((res as any).json.mock.calls[0]?.arguments[0], {
				message: "Webhook processing success.",
				error: false,
				data: mockResult,
			});
		});
	});
});
