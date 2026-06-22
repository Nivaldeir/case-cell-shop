CREATE TABLE `saga_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`current_step` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
