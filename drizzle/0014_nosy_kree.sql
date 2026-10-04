ALTER TABLE `comments` ADD `reply_to` text;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `replies` integer DEFAULT 0 NOT NULL;