export interface SagaStep<TCtx> {
	execute(ctx: TCtx): Promise<void>;
	compensate(ctx: TCtx): Promise<void>;
}

export class SagaOrchestrator<TCtx> {
	private readonly steps: SagaStep<TCtx>[] = [];

	add(step: SagaStep<TCtx>): this {
		this.steps.push(step);
		return this;
	}

	async run(ctx: TCtx): Promise<void> {
		const completed: SagaStep<TCtx>[] = [];

		for (const step of this.steps) {
			try {
				await step.execute(ctx);
				completed.push(step);
			} catch (err) {
				for (const done of [...completed].reverse()) {
					await done.compensate(ctx);
				}
				throw err;
			}
		}
	}
}
