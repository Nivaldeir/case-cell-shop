import { Socket } from "node:net";

type ConnectionDBOptions = {
	host?: string;
	port?: number;
	timeoutMs?: number;
};

export class ConnectionDB {
	private static resolveConfig(options?: ConnectionDBOptions) {
		return {
			host: options?.host ?? process.env.DB_HOST ?? "127.0.0.1",
			port: options?.port ?? Number(process.env.DB_PORT ?? 5432),
			timeoutMs:
				options?.timeoutMs ??
				Number(process.env.DB_HEALTHCHECK_TIMEOUT_MS ?? 2000),
		};
	}

	static async healthCheck(options?: ConnectionDBOptions): Promise<boolean> {
		const { host, port, timeoutMs } = ConnectionDB.resolveConfig(options);

		return await new Promise<boolean>((resolve) => {
			const socket = new Socket();
			let done = false;

			const finish = (result: boolean) => {
				if (done) return;
				done = true;
				socket.destroy();
				resolve(result);
			};

			socket.setTimeout(timeoutMs);
			socket.once("connect", () => finish(true));
			socket.once("timeout", () => finish(false));
			socket.once("error", () => finish(false));
			socket.connect(port, host);
		});
	}
}
