import { randomUUID } from "crypto";
import { z } from "zod";
import { BaseDomain } from "./BaseDomain";

export const orderItemSchema = z.object({
	id: z.string(),
	productId: z.string(),
	price: z.float32(),
	quantity: z.int(),
});

export type OrderItemProps = z.infer<typeof orderItemSchema>;

export class OrdemItem extends BaseDomain<OrderItemProps> {
	static create(props: Omit<OrderItemProps, "id">): OrdemItem {
		return new OrdemItem({
			id: randomUUID(),
			price: props.price,
			productId: props.productId,
			quantity: props.quantity,
		});
	}

	static restore(props: OrderItemProps): OrdemItem {
		return new OrdemItem(props);
	}
}
