CREATE TABLE `local_accounts` (
	`user` text PRIMARY KEY NOT NULL,
	`login` text NOT NULL,
	`salt` text NOT NULL,
	`hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `local_accounts_login_unique` ON `local_accounts` (`login`);--> statement-breakpoint
CREATE TABLE `login_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_login_user` ON `login_sessions` (`user`);