import { sagaExecutionsTable } from "@casecellshop/db";
import { eq } from "drizzle-orm";
import type {
	SagaStatus,
	SagaStepName,
} from "../../application/enums/EnumSagas";
import type { ISagaRepository } from "../../application/repositorys/ISagaRepository";
import { db } from "../db/client";

export class SagaRepository implements ISagaRepository {
	async create(data: {
		id: string;
		orderId: string;
		currentStep: SagaStepName;
	}): Promise<void> {
		const now = new Date();
		await db.insert(sagaExecutionsTable).values({
			id: data.id,
			orderId: data.orderId,
			currentStep: data.currentStep as "reserve_stock" | "process_payment",
			status: "pending",
			error: "",
			createdAt: now,
			updatedAt: now,
		});
	}

	async update(
		id: string,
		data: { currentStep?: SagaStepName; status: SagaStatus; error?: string },
	): Promise<void> {
		await db
			.update(sagaExecutionsTable)
			.set({
				...(data.currentStep ? { currentStep: data.currentStep } : {}),
				status: data.status,
				...(data.error !== undefined ? { error: data.error } : {}),
				updatedAt: new Date(),
				createdAt: new Date(),
				currentStep: data.currentStep! as "reserve_stock" | "process_payment",
				error: data.error,
			})
			.where(eq(sagaExecutionsTable.id, id));
	}
}
