import type { Order, OrdemItem, Payment, Product } from "@ledger/shared";

export type CreateOrderContext = {
	items: Array<{ productId: string; quantity: number }>;
	products?: Map<string, Product>;
	orderItems?: OrdemItem[];
	order?: Order;
	payment?: Payment;
};
