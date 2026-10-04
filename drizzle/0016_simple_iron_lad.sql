CREATE TABLE `hunt_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`user` text NOT NULL,
	`revision` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_hunt_changes_user` ON `hunt_changes` (`user`,`created`);--> statement-breakpoint
ALTER TABLE `captures` ADD `revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `challenges` ADD `revision` integer DEFAULT 0 NOT NULL;