CREATE TABLE `favorite_candidates` (
	`token` text PRIMARY KEY NOT NULL,
	`poll` text NOT NULL,
	`submission` text NOT NULL,
	`winner` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_favorite_candidate` ON `favorite_candidates` (`poll`,`submission`);--> statement-breakpoint
CREATE TABLE `favorite_polls` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`season` text NOT NULL,
	`day` text NOT NULL,
	`opens` integer NOT NULL,
	`closes` integer NOT NULL,
	`settled` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_favorite_day_group` ON `favorite_polls` (`group_id`,`day`);--> statement-breakpoint
CREATE TABLE `favorite_votes` (
	`poll` text NOT NULL,
	`user` text NOT NULL,
	`candidate` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_favorite_vote` ON `favorite_votes` (`poll`,`user`);--> statement-breakpoint
CREATE INDEX `idx_favorite_vote_candidate` ON `favorite_votes` (`candidate`);--> statement-breakpoint
CREATE TABLE `word_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`word` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_word_status` ON `word_suggestions` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_word_suggestion` ON `word_suggestions` (`user`,`word`);--> statement-breakpoint
ALTER TABLE `submissions` ADD `caption` text DEFAULT '' NOT NULL;