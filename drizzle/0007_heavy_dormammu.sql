CREATE TABLE `photo_reports` (
	`submission` text PRIMARY KEY NOT NULL,
	`reporter` text NOT NULL,
	`reason` text NOT NULL,
	`created` integer NOT NULL,
	`deadline` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`threshold` integer NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photo_voters` (
	`submission` text NOT NULL,
	`user` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_photo_voter` ON `photo_voters` (`submission`,`user`);--> statement-breakpoint
CREATE TABLE `photo_votes` (
	`submission` text NOT NULL,
	`user` text NOT NULL,
	`choice` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_photo_vote` ON `photo_votes` (`submission`,`user`);