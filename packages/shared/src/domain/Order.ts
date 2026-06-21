import { z } from "zod";
import { BaseDomain } from "./BaseDomain";
import { GenerateId } from "./GenerateId";
import { OrdemItem } from "./OrdemItem";

export const StatusOrdemSchema = z.enum([
	"pending",
	"paid",
	"shipped",
	"delivered",
	"cancelled",
]);

export type StatusOrdemEnum = z.infer<typeof StatusOrdemSchema>;

export const OrderSchema = z
	.object({
		id: z.string(),
		idempotencyKey: z.string(),
		ordemItems: z.array(z.instanceof(OrdemItem)),
		createdAt: z.date(),
		updatedAt: z.date(),
		status: StatusOrdemSchema,
	})
	.transform((data) => ({
		...data,
		amount: data.ordemItems.reduce(
			(acc, item) => acc + item.get("price") * item.get("quantity"),
			0,
		),
	}));

export type OrderProps = z.infer<typeof OrderSchema>;

export class Order extends BaseDomain<OrderProps> {
	static create(
		props: Pick<OrderProps, "ordemItems" | "idempotencyKey">,
	): Order {
		const now = new Date();

		return new Order({
			id: GenerateId.generate("ord"),
			idempotencyKey: props.idempotencyKey,
			ordemItems: props.ordemItems,
			status: "pending",
			createdAt: now,
			updatedAt: now,
			amount: Order.recalculateTotal(props.ordemItems),
		});
	}

	static restore(props: OrderProps): Order {
		return new Order(props);
	}

	private static recalculateTotal(ordemItem: OrdemItem[]): number {
		if (ordemItem?.length === 0) throw new Error("Nenhum produto adicionado");

		const total = ordemItem!.reduce(
			(acc, item) => acc + item.get("price") * item.get("quantity"),
			0,
		);
		return total;
	}

	markAsPaid(): void {
		this.set("status", "paid");
		this.set("updatedAt", new Date());
	}

	markAsShipped(): void {
		this.set("status", "shipped");
		this.set("updatedAt", new Date());
	}

	markAsDelivered(): void {
		this.set("status", "delivered");
		this.set("updatedAt", new Date());
	}

	cancel(): void {
		this.set("status", "cancelled");
		this.set("updatedAt", new Date());
	}
}
