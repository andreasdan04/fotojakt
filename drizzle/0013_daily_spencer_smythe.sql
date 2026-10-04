CREATE TABLE `feature_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_feature_user_created` ON `feature_suggestions` (`user`,`created`);--> statement-breakpoint
ALTER TABLE `word_suggestions` ADD `ai_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `word_suggestions` ADD `ai_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `word_suggestions` ADD `ai_reviewed` integer;