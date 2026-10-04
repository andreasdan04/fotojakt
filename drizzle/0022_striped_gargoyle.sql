CREATE TABLE `group_links` (
	`token` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`creator` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_group_link` ON `group_links` (`group_id`);