export async function runRetry<T>(
	fn: (attempt: number) => Promise<T>,
	options: { retries?: number; delay?: number; factor?: number } = {},
): Promise<T | undefined> {
	let attempt = 0;
	while (attempt <= (options.retries ?? 3)) {
		try {
			return await fn(attempt + 1);
		} catch (error) {
			console.log("[Retry] error", error);
			if (attempt === (options.retries ?? 3)) {
				throw error;
			}

			const waitTime =
				(options.delay ?? 100) * (options.factor ?? 2) ** attempt;

			await new Promise((res) => setTimeout(res, waitTime));
			attempt++;
		}
	}
}
