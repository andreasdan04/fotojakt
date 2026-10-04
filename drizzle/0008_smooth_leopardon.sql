DROP INDEX `idx_daily_day`;--> statement-breakpoint
ALTER TABLE `challenges` ADD `slot` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_daily_slot` ON `challenges` (`day`,`slot`) WHERE "challenges"."daily"=1;