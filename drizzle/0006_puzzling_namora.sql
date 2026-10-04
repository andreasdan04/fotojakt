CREATE TABLE `notification_preferences` (
	`user` text PRIMARY KEY NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`reactions` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `social_push` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription` text NOT NULL,
	`submission` text NOT NULL,
	`actor` text NOT NULL,
	`kind` text NOT NULL,
	`source` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_social_pending` ON `social_push` (`status`,`next_attempt`);