ALTER TABLE `orders` ADD `idempotente` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotente_unique` ON `orders` (`idempotente`);