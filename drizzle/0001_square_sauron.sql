CREATE TABLE `push_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription` text NOT NULL,
	`challenge` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`sent` integer,
	`last_status` integer
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_push_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_push_user` ON `push_subscriptions` (`user`);