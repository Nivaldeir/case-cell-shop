import { Payment } from "@ledger/shared";
import type { IPaymentRepository } from "@ledger/shared";
import { paymentTable } from "@ledger/db";
import { eq } from "drizzle-orm";
import type { AnyDbClient } from "../db/client";

export class PaymentRepository implements IPaymentRepository {
	constructor(private readonly db: AnyDbClient) {}

	async create(payment: Payment): Promise<void> {
		const props = payment.toJSON();
		await this.db.insert(paymentTable).values({
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
		const [row] = await this.db
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
		await this.db
			.update(paymentTable)
			.set({ status: props.status, updatedAt: props.updatedAt })
			.where(eq(paymentTable.id, props.id));
	}
}
