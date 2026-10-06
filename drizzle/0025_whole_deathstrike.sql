CREATE TABLE `invitation_push` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription` text NOT NULL,
	`recipient` text NOT NULL,
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
CREATE INDEX `idx_invitation_push_pending` ON `invitation_push` (`status`,`next_attempt`);--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `friends` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD `groups` integer DEFAULT 1 NOT NULL;