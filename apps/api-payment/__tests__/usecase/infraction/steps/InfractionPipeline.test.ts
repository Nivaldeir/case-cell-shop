import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	BalanceNotFound,
	Infraction,
	InfractionNotFoundError,
	InfractionStatus,
	InfractionType,
	TransactionNotFoundError,
} from "@ledger/shared";
import {
	InfractionPipeline,
	type InfractionPipelineContext,
	type IPipelineStep,
	type StepOutcome,
} from "@/application/usecase/Infraction/InfractionPipeline";

const INFRACTION_ID = "00000000-0000-0000-0000-000000000001";

class FakeStep implements IPipelineStep {
	readonly order: number;
	private readonly shouldFail: boolean;
	private readonly errorStep: string;

	constructor(order: number, shouldFail = false, errorStep = "Fake") {
		this.order = order;
		this.shouldFail = shouldFail;
		this.errorStep = errorStep;
	}

	async execute(_ctx: InfractionPipelineContext): Promise<StepOutcome> {
		if (this.shouldFail) {
			return {
				ok: false,
				step: this.errorStep,
				status: "not_found",
				error: new BalanceNotFound("wal_001"),
			};
		}
		return { ok: true };
	}
}

describe("InfractionPipeline", () => {
	it("runs all steps in order and returns success log", async () => {
		const steps = [new FakeStep(2), new FakeStep(0), new FakeStep(1)];
		const pipeline = new InfractionPipeline(steps);

		const { context, log } = await pipeline.run({
			infractionId: INFRACTION_ID,
			status: InfractionStatus.OPEN,
		});

		assert.equal(log.length, 3);
		assert.equal(log[0]?.status, "success");
		assert.equal(log[1]?.status, "success");
		assert.equal(log[2]?.status, "success");
		assert.equal(context.input.infractionId, INFRACTION_ID);
	});

	it("short-circuits at the first not_found step", async () => {
		const steps = [
			new FakeStep(0),
			new FakeStep(1, true, "FetchBalance"),
			new FakeStep(2),
		];
		const pipeline = new InfractionPipeline(steps);

		const { log } = await pipeline.run({
			infractionId: INFRACTION_ID,
			status: InfractionStatus.OPEN,
		});

		assert.equal(log.length, 2);
		assert.equal(log[0]?.status, "success");
		assert.equal(log[1]?.status, "not_found");
		assert.equal(log[1]?.message, "Balance with id wal_001 not found");
	});

	it("sorts steps by order before running", async () => {
		const executionOrder: number[] = [];
		const steps = [
			new (class implements IPipelineStep {
				readonly order = 2;
				async execute() {
					executionOrder.push(2);
					return { ok: true } as const;
				}
			})(),
			new (class implements IPipelineStep {
				readonly order = 0;
				async execute() {
					executionOrder.push(0);
					return { ok: true } as const;
				}
			})(),
			new (class implements IPipelineStep {
				readonly order = 1;
				async execute() {
					executionOrder.push(1);
					return { ok: true } as const;
				}
			})(),
		];
		const pipeline = new InfractionPipeline(steps);

		await pipeline.run({
			infractionId: INFRACTION_ID,
			status: InfractionStatus.OPEN,
		});

		assert.deepEqual(executionOrder, [0, 1, 2]);
	});
});
