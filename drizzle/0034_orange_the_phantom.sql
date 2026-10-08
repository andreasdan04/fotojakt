CREATE TABLE `review_push` (
	`id` text PRIMARY KEY NOT NULL,
	`notice` text NOT NULL,
	`subscription` text NOT NULL,
	`submission` text NOT NULL,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_review_push_pending` ON `review_push` (`status`,`next_attempt`);