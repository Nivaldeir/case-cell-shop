import { z } from "zod";
import { BaseDomain } from "./BaseDomain";
import { GenerateId } from "./GenerateId";

export const paymentSchema = z.object({
	id: z.string(),
	orderId: z.string(),
	type: z.enum(["credit_card", "pix", "boleto"]),
	status: z.enum(["pending", "paid", "failed", "refunded"]),
	amount: z.number().positive(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

export type PaymentProps = z.infer<typeof paymentSchema>;

export class Payment extends BaseDomain<PaymentProps> {
	static create(
		props: Pick<PaymentProps, "orderId" | "type" | "amount">,
	): Payment {
		const now = new Date();
		return new Payment({
			id: GenerateId.generate("pay"),
			orderId: props.orderId,
			type: props.type,
			status: "pending",
			amount: props.amount,
			createdAt: now,
			updatedAt: now,
		});
	}

	static restore(props: PaymentProps): Payment {
		return new Payment(props);
	}

	markAsPaid(): void {
		this.set("status", "paid");
		this.set("updatedAt", new Date());
	}

	markAsFailed(): void {
		this.set("status", "failed");
		this.set("updatedAt", new Date());
	}

	refund(): void {
		this.set("status", "refunded");
		this.set("updatedAt", new Date());
	}
}
