export enum SagaStatus {
	PENDING = "pending",
	RUNNING = "running",
	COMPLETED = "completed",
	FAILED = "failed",
	COMPENSATED = "compensated",
}

export enum SagaStepName {
	RESERVE_STOCK = "reserve_stock",
	RELEASE_STOCK = "release_stock",
	PROCESS_PAYMENT = "process_payment",
}
