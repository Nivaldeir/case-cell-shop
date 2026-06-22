import { paymentTable } from "@casecellshop/db";
import { eq } from "drizzle-orm";
import type { IPaymentRepository } from "../../application/repositorys/IPaymentRepository";
import { Payment } from "../../domain/Payment";
import { db } from "../db/client";

export class PaymentRepository implements IPaymentRepository {
	async create(payment: Payment): Promise<void> {
		const props = payment.toJSON();
		await db.insert(paymentTable).values({
			id: props.id,
			orderId: props.orderId,
			type: props.type,
			status: props.status,
			amount: String(props.amount),
			createdAt: props.createdAt,
			updatedAt: props.updatedAt,
		});
	}

	async findByOrderId(orderId: string): Promise<Payment | null> {
		const [row] = await db
			.select()
			.from(paymentTable)
			.where(eq(paymentTable.orderId, orderId))
			.limit(1);

		if (!row) return null;

		return Payment.restore({
			id: row.id,
			orderId: row.orderId,
			type: row.type,
			status: row.status,
			amount: Number(row.amount),
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		});
	}

	async updateStatus(payment: Payment): Promise<void> {
		const props = payment.toJSON();
		await db
			.update(paymentTable)
			.set({ status: props.status, updatedAt: props.updatedAt })
			.where(eq(paymentTable.id, props.id));
	}
}
