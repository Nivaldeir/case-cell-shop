type ItemJob = Array<{ productId: string; quantity: number }>;

export type JobData = {
	sagaId: string;
	orderId: string;
	items: ItemJob;
};
