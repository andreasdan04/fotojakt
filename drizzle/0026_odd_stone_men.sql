CREATE TABLE `usage_activity` (
	`user` text PRIMARY KEY NOT NULL,
	`last_seen` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usage_daily` (
	`day` text NOT NULL,
	`user` text NOT NULL,
	`event` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_usage_daily` ON `usage_daily` (`day`,`user`,`event`);--> statement-breakpoint
CREATE INDEX `idx_usage_day` ON `usage_daily` (`day`);