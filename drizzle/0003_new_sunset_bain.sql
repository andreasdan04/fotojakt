CREATE TABLE `starts` (
	`challenge` text NOT NULL,
	`user` text NOT NULL,
	`started` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_starts_user_challenge` ON `starts` (`user`,`challenge`);--> statement-breakpoint
ALTER TABLE `captures` ADD `taken` integer;--> statement-breakpoint
ALTER TABLE `challenges` ADD `daily` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `challenges` ADD `day` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_daily_day` ON `challenges` (`day`) WHERE "challenges"."daily"=1;--> statement-breakpoint
ALTER TABLE `seasons` ADD `daily` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `seasons` ADD `first_day` text;--> statement-breakpoint
ALTER TABLE `seasons` ADD `last_day` text;