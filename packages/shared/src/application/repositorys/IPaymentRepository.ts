import type { Payment } from "../../domain/Payment";

export interface IPaymentRepository {
	create(payment: Payment): Promise<void>;
	findByOrderId(orderId: string): Promise<Payment | null>;
	updateStatus(payment: Payment): Promise<void>;
}
