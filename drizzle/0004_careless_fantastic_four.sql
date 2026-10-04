CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`submission` text NOT NULL,
	`user` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_comments_submission` ON `comments` (`submission`,`created`);