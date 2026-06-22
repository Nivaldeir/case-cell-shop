import { createHash, randomBytes } from "node:crypto";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export class GenerateId {
	static generate(suffix = "usr", size = 28): string {
		const bytes = randomBytes(size);
		let id = "";
		for (let i = 0; i < size; i++) {
			const byte = bytes[i];
			id += CHARS[(byte ?? 0) % CHARS.length];
		}
		return `${suffix}_${id}`;
	}

	static generateIdempotencyKey(
		direction: string,
		assetCode: string,
		amount: number,
		accountId?: string,
		pixId?: string,
		index?: number,
	) {
		return createHash("sha256")
			.update(
				`${accountId}|${direction}|${assetCode}|${amount}|${pixId ?? ""}|${index ? `|${index}` : ""}`,
			)
			.digest("hex");
	}
}
