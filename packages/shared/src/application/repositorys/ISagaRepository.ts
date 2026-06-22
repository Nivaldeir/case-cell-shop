import type { SagaStatus, SagaStepName } from "../enums/EnumSagas";

export interface ISagaRepository {
	create(data: {
		id: string;
		orderId: string;
		currentStep: SagaStepName;
	}): Promise<void>;
	update(
		id: string,
		data: { currentStep?: SagaStepName; status: SagaStatus; error?: string },
	): Promise<void>;
}
