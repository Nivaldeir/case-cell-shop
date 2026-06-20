import "express";
import type { ClerkAuthContext } from "./clerkAuthContext";

declare global {
	namespace Express {
		interface Request extends Partial<ClerkAuthContext> {}
	}
}
