export interface SQSConfig {
	endpoint?: string;
	region: string;
	accessKeyId?: string;
	secretAccessKey?: string;
	sessionToken?: string;
	/** Opcional; usado só se você montar URL/ARN manualmente. Com `SQS_QUEUE_URL` completa não é necessário. */
	accountId?: string;
}

export type QueueConfig = SQSConfig;
