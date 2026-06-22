import { SQSAdapter } from "./index";

export class QueueSingleton {
	private static instance: SQSAdapter | null = null;

	static getInstance(): SQSAdapter {
		if (!QueueSingleton.instance) {
			QueueSingleton.instance = new SQSAdapter();
		}
		return QueueSingleton.instance;
	}
}
