CREATE TABLE `photo_admin_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`submission` text NOT NULL,
	`reporter` text NOT NULL,
	`reason` text NOT NULL,
	`created` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`resolved_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_photo_admin_report_user` ON `photo_admin_reports` (`submission`,`reporter`);--> statement-breakpoint
CREATE INDEX `idx_photo_admin_report_status` ON `photo_admin_reports` (`status`,`created`);