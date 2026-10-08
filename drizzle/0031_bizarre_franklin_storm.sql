CREATE TABLE `rules_acceptances` (
	`user_id` text NOT NULL,
	`rules_version` text NOT NULL,
	`accepted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rules_acceptance_user_version` ON `rules_acceptances` (`user_id`,`rules_version`);