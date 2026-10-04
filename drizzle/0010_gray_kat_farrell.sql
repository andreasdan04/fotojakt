DROP INDEX `idx_reactions_unique`;--> statement-breakpoint
DELETE FROM reactions WHERE rowid NOT IN (SELECT MAX(rowid) FROM reactions GROUP BY submission,user);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_reactions_unique` ON `reactions` (`submission`,`user`);--> statement-breakpoint
ALTER TABLE `comments` ADD `parent_id` text;--> statement-breakpoint
ALTER TABLE `comments` ADD `deleted` integer DEFAULT 0 NOT NULL;