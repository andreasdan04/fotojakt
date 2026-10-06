CREATE TABLE `chat_push` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`subscription` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chat_push_pending` ON `chat_push` (`status`,`next_attempt`);--> statement-breakpoint
ALTER TABLE `group_members` ADD `chat_notifications` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `group_members` ADD `read_created` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `group_members` ADD `read_id` text DEFAULT '' NOT NULL;