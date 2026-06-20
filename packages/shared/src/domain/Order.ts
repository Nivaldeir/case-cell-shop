import { z } from "zod";
import { BaseDomain } from "./BaseDomain";
import { GenerateId } from "./GenerateId";
import { OrdemItem } from "./OrdemItem";


export const OrderSchema = z.object({
    id: z.string(),
    ordemItems: z.array(z.instanceof(OrdemItem)),
    createdAt: z.date(),
    updatedAt: z.date(),
    total: z.float32(),
    status: z.enum([
        "pending",
        "paid",
        "shipped",
        "delivered",
        "cancelled",
    ]),
});

export type OrderProps = z.infer<typeof OrderSchema>;

export class Order extends BaseDomain<OrderProps> {
    static create(
        props: Omit<
            OrderProps,
            "id" | "createdAt" | "updatedAt" | "deletedAt" | "total"
        >
    ): Order {
        const now = new Date();

        return new Order({
            id: GenerateId.generate("ord"),
            ordemItems: props.ordemItems,
            status: props.status,
            createdAt: now,
            updatedAt: now,
            total: 0
        });
    }

    static restore(props: OrderProps): Order {
        return new Order(props);
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

    recalculateTotal(): void {
        if(this.get("ordemItems")?.length == 0) throw new Error("Nenhum produto adicionado")

        const total = this.get("ordemItems")!.reduce(
            (acc, item) => acc + item.get("price") * item.get("quantity"),
            0
        );

        this.set("total", total);
        this.set("updatedAt", new Date());
    }
}