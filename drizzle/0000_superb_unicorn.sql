CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`until` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `captures` (
	`token` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`challenge` text NOT NULL,
	`expires` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`title` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`start` integer,
	`end` integer,
	`duration` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_challenges_season_start` ON `challenges` (`season`,`start`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`joined` integer NOT NULL,
	`approved` integer,
	`admin` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`submission` text NOT NULL,
	`user` text NOT NULL,
	`emoji` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reactions_unique` ON `reactions` (`submission`,`user`,`emoji`);--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`start` integer NOT NULL,
	`end` integer
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`user` text NOT NULL,
	`key` text NOT NULL,
	`submitted` integer NOT NULL,
	`elapsed` integer NOT NULL,
	`valid` integer DEFAULT 1 NOT NULL,
	`note` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submission_challenge_user` ON `submissions` (`challenge`,`user`);