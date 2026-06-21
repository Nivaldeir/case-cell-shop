import {
	CreateQueueCommand,
	DeleteMessageCommand,
	DeleteQueueCommand,
	GetQueueAttributesCommand,
	GetQueueUrlCommand,
	type Message,
	ReceiveMessageCommand,
	SendMessageBatchCommand,
	SendMessageCommand,
	SQSClient,
} from "@aws-sdk/client-sqs";
import {
	type PublishOptions,
	QueueAdapter,
	type QueueMessage,
} from "@/application/queues/IQueueAdapter";
import type { SQSConfig } from "@/application/queues/IQueueConfig";

export class SQSAdapter extends QueueAdapter {
	private clients: Map<string, SQSClient> = new Map();
	private config: SQSConfig;
	private queueUrls: Map<string, string> = new Map();
	private consuming: Map<string, boolean> = new Map();
	private connected = false;

	constructor() {
		super();
		const accessKeyId =
			process.env.SQS_ACCESS_KEY_ID ||
			process.env.SQS_ACCESS_KEY ||
			process.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey =
			process.env.SQS_SECRET_ACCESS_KEY ||
			process.env.SQS_SECRET_KEY ||
			process.env.AWS_SECRET_ACCESS_KEY;
		const sessionToken =
			process.env.SQS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;

		this.config = {
			endpoint: process.env.SQS_ENDPOINT,
			region: process.env.SQS_REGION || "us-east-1",
			accountId: process.env.SQS_ACCOUNT_ID || "",
			...(accessKeyId && secretAccessKey
				? {
						accessKeyId,
						secretAccessKey,
						...(sessionToken ? { sessionToken } : {}),
					}
				: {}),
		};
	}

	async connect(): Promise<void> {
		this.connected = true;
	}

	private getClientForRegion(region: string): SQSClient {
		if (this.clients.has(region)) {
			return this.clients.get(region)!;
		}

		const clientConfig: any = {
			region: region,
		};

		if (this.config.endpoint) {
			clientConfig.endpoint = this.config.endpoint;
		}

		if (this.config.accessKeyId && this.config.secretAccessKey) {
			clientConfig.credentials = {
				accessKeyId: this.config.accessKeyId,
				secretAccessKey: this.config.secretAccessKey,
				...(this.config.sessionToken
					? { sessionToken: this.config.sessionToken }
					: {}),
			};
		}

		const client = new SQSClient(clientConfig);
		this.clients.set(region, client);
		return client;
	}

	private getClientForQueue(queue: string): SQSClient {
		const region = this.extractRegion(queue);
		return this.getClientForRegion(region);
	}

	private extractRegion(queue: string): string {
		if (queue.startsWith("arn:aws:sqs:")) {
			const arnParts = queue.split(":");
			return arnParts[3]!;
		}

		if (queue.startsWith("https://sqs.")) {
			const match = queue.match(/https:\/\/sqs\.([^.]+)\.amazonaws\.com/);
			if (match) {
				return match[1]!;
			}
		}

		return this.config.region;
	}

	async disconnect(): Promise<void> {
		this.consuming.clear();
		this.queueUrls.clear();
		for (const client of this.clients.values()) {
			client.destroy();
		}
		this.clients.clear();
		this.connected = false;
	}

	isConnected(): boolean {
		return this.connected;
	}

	async createQueue(queue: string): Promise<void> {
		this.ensureConnected();
		const client = this.getClientForQueue(queue);

		const command = new CreateQueueCommand({
			QueueName: queue,
			Attributes: {
				VisibilityTimeout: "30",
				MessageRetentionPeriod: "345600",
			},
		});

		const response = await client.send(command);
		if (response.QueueUrl) {
			this.queueUrls.set(queue, response.QueueUrl);
		}
	}

	async deleteQueue(queue: string): Promise<void> {
		this.ensureConnected();
		const client = this.getClientForQueue(queue);
		const queueUrl = await this.getQueueUrl(queue);

		const command = new DeleteQueueCommand({ QueueUrl: queueUrl });
		await client.send(command);
		this.queueUrls.delete(queue);
	}

	async publishV2<TMessage>(
		queueName: string,
		message: TMessage,
		options?: PublishOptions,
	): Promise<string> {
		this.ensureConnected();

		const client = this.getClientForQueue(queueName);
		const queueUrl = await this.getQueueUrl(queueName);

		const messageId = this.generateMessageId();
		const actualQueueName = this.extractQueueName(queueName);
		const isFifoQueue = actualQueueName.endsWith(".fifo");

		const commandParams: any = {
			QueueUrl: queueUrl,
			MessageBody: JSON.stringify(message),
		};

		if (options?.delaySeconds !== undefined) {
			commandParams.DelaySeconds = options.delaySeconds;
		}

		if (isFifoQueue) {
			if (options?.messageGroupId) {
				commandParams.MessageGroupId = options.messageGroupId;
			}
			if (options?.deduplicationId) {
				commandParams.MessageDeduplicationId = options.deduplicationId;
			} else {
				commandParams.MessageDeduplicationId = messageId;
			}
		}

		const command = new SendMessageCommand(commandParams);
		const response = await client.send(command);
		return response.MessageId || messageId;
	}

	async publish<TMessage>(
		queueName: string,
		message: TMessage,
		options?: PublishOptions,
	): Promise<string> {
		this.ensureConnected();
		const client = this.getClientForQueue(queueName);
		const queueUrl = await this.getQueueUrl(queueName);
		const messageId = this.generateMessageId();

		const commandParams: any = {
			QueueUrl: queueUrl,
			MessageBody: JSON.stringify(message),
		};

		if (options?.delaySeconds !== undefined) {
			commandParams.DelaySeconds = options.delaySeconds;
		}

		const command = new SendMessageCommand(commandParams);
		const response = await client.send(command);
		return response.MessageId || messageId;
	}

	async publishBatch<TMessage>(
		queueName: string,
		messages: TMessage[],
		options?: PublishOptions,
	): Promise<string[]> {
		this.ensureConnected();

		const client = this.getClientForQueue(queueName);
		const queueUrl = await this.getQueueUrl(queueName);

		const results: string[] = [];

		const chunkSize = 10;

		for (let i = 0; i < messages.length; i += chunkSize) {
			const chunk = messages.slice(i, i + chunkSize);

			const entries = chunk.map((message, index) => {
				const entry: any = {
					Id: `${i + index}`,
					MessageBody: JSON.stringify(message),
				};

				if (options?.delaySeconds !== undefined) {
					entry.DelaySeconds = options.delaySeconds;
				}

				return entry;
			});

			const command = new SendMessageBatchCommand({
				QueueUrl: queueUrl,
				Entries: entries,
			});

			const response = await client.send(command);

			if (response.Successful) {
				results.push(
					...response.Successful.map((s) => s.MessageId || s.Id || ""),
				);
			}
		}

		return results;
	}

	async consume(
		queueName: string,
		handler: (message: QueueMessage<any>) => Promise<void>,
	): Promise<void> {
		this.ensureConnected();
		const client = this.getClientForQueue(queueName);
		const queueUrl = await this.getQueueUrl(queueName);

		this.consuming.set(queueName, true);

		const poll = async () => {
			while (this.consuming.get(queueName)) {
				try {
					const command = new ReceiveMessageCommand({
						QueueUrl: queueUrl,
						MaxNumberOfMessages: 10,
						WaitTimeSeconds: 5,
						VisibilityTimeout: 30,
					});

					const response = await client.send(command);

					if (response.Messages && response.Messages.length > 0) {
						for (const msg of response.Messages) {
							const queueMessage: QueueMessage<any> = {
								id: msg.MessageId || this.generateMessageId(),
								body: JSON.parse(msg.Body || "{}") as any,
								raw: { message: msg, queueUrl, queueArn: queueName },
								receivedAt: new Date(),
							};

							try {
								await handler(queueMessage);
							} catch (error) {
								console.error("[SQS] Error processing message:", error);
							}
						}
					}
				} catch (error) {
					console.error("[SQS] Polling error:", error);
				}
			}
		};

		poll();
	}

	async ack(message: QueueMessage): Promise<void> {
		this.ensureConnected();
		const {
			message: msg,
			queueUrl,
			queueArn,
		} = message.raw as {
			message: Message;
			queueUrl: string;
			queueArn?: string;
		};
		const client = this.getClientForQueue(queueArn || queueUrl);

		if (!msg.ReceiptHandle) {
			throw new Error("[SQS] Message has no ReceiptHandle");
		}

		const command = new DeleteMessageCommand({
			QueueUrl: queueUrl,
			ReceiptHandle: msg.ReceiptHandle,
		});

		await client.send(command);
	}

	async getQueueLength(queue: string): Promise<number> {
		this.ensureConnected();
		const client = this.getClientForQueue(queue);
		const queueUrl = await this.getQueueUrl(queue);

		const command = new GetQueueAttributesCommand({
			QueueUrl: queueUrl,
			AttributeNames: ["ApproximateNumberOfMessages"],
		});

		const response = await client.send(command);
		return Number.parseInt(
			response.Attributes?.ApproximateNumberOfMessages || "0",
			10,
		);
	}

	stopConsuming(queue: string): void {
		this.consuming.set(queue, false);
	}

	private async getQueueUrl(queue: string): Promise<string> {
		if (this.queueUrls.has(queue)) {
			return this.queueUrls.get(queue)!;
		}

		// Se já for uma URL, usar diretamente
		if (queue.startsWith("https://")) {
			this.queueUrls.set(queue, queue);
			return queue;
		}

		// Se for um ARN, converter para URL
		if (queue.startsWith("arn:aws:sqs:")) {
			const url = this.convertArnToUrl(queue);
			this.queueUrls.set(queue, url);
			return url;
		}

		// Se for apenas o nome da fila, buscar URL via API
		try {
			const client = this.getClientForQueue(queue);
			const command = new GetQueueUrlCommand({ QueueName: queue });
			const response = await client.send(command);

			if (response.QueueUrl) {
				this.queueUrls.set(queue, response.QueueUrl);
				return response.QueueUrl;
			}
		} catch {
			await this.createQueue(queue);
			return this.queueUrls.get(queue)!;
		}

		throw new Error(`[SQS] Could not get URL for queue: ${queue}`);
	}

	private convertArnToUrl(arn: string): string {
		// ARN format: arn:aws:sqs:region:account-id:queue-name
		// URL format: https://sqs.region.amazonaws.com/account-id/queue-name

		const arnParts = arn.split(":");
		if (
			arnParts.length < 6 ||
			arnParts[0] !== "arn" ||
			arnParts[1] !== "aws" ||
			arnParts[2] !== "sqs"
		) {
			throw new Error(`[SQS] Invalid ARN format: ${arn}`);
		}

		const region = arnParts[3];
		const accountId = arnParts[4];
		const queueName = arnParts.slice(5).join(":"); // Pega o resto caso tenha ':' no nome

		return `https://sqs.${region}.amazonaws.com/${accountId}/${queueName}`;
	}

	private extractQueueName(queue: string): string {
		// Se for ARN, extrai o nome da fila
		if (queue.startsWith("arn:aws:sqs:")) {
			const arnParts = queue.split(":");
			return arnParts.slice(5).join(":");
		}

		// Se for URL, extrai o nome da fila
		if (queue.startsWith("https://")) {
			const urlParts = queue.split("/");
			return urlParts[urlParts.length - 1] ?? "";
		}

		// Se for apenas o nome, retorna direto
		return queue;
	}

	private ensureConnected(): void {
		if (!this.connected) {
			throw new Error("[SQS] Not connected. Call connect() first.");
		}
	}

	private generateMessageId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
	}
}
