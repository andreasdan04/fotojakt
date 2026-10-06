CREATE TABLE `bonus_reviews` (
	`submission` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`lease` integer DEFAULT 0 NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `game_awards` (
	`user` text NOT NULL,
	`award` text NOT NULL,
	`created` integer NOT NULL,
	`seen` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_game_awards` ON `game_awards` (`user`,`award`);--> statement-breakpoint
CREATE TABLE `game_hunts` (
	`challenge` text PRIMARY KEY NOT NULL,
	`week` text,
	`lightning` integer DEFAULT 0 NOT NULL,
	`bonus` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_hunts_week_unique` ON `game_hunts` (`week`);