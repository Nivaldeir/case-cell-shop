import type { SagaStepName } from "../enums/EnumSagas";

export interface QueueMessage<T = unknown> {
	id: string;
	body: T;
	raw: unknown;
	receivedAt: Date;
}

export interface PublishOptions {
	delaySeconds?: number;
	messageGroupId?: string;
	deduplicationId?: string;
}

export interface ConsumeOptions {
	prefetch?: number;
	visibilityTimeout?: number;
	waitTimeSeconds?: number;
}

export abstract class QueueAdapter {
	abstract connect(): Promise<void>;

	abstract disconnect(): Promise<void>;

	abstract isConnected(): boolean;

	abstract publish<TMessage>(
		queueName: SagaStepName,
		message: TMessage,
		options?: PublishOptions,
	): Promise<string>;
	abstract publishBatch<TMessage>(
		queueName: SagaStepName,
		messages: TMessage[],
		options?: PublishOptions,
	): Promise<string[]>;

	abstract ack(message: QueueMessage): Promise<void>;
}

export { QueueAdapter as IQueueAdapter };
