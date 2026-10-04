CREATE TABLE `difficulty_polls` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`word` text NOT NULL,
	`revision` integer NOT NULL,
	`actor` text NOT NULL,
	`created` integer NOT NULL,
	`deadline` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_difficulty_open` ON `difficulty_polls` (`challenge`) WHERE "difficulty_polls"."status"='open';--> statement-breakpoint
CREATE TABLE `difficulty_votes` (
	`poll` text NOT NULL,
	`user` text NOT NULL,
	`choice` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_difficulty_vote` ON `difficulty_votes` (`poll`,`user`);