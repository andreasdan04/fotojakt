CREATE TABLE `chat_reactions` (
	`message` text NOT NULL,
	`user` text NOT NULL,
	`emoji` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chat_reaction` ON `chat_reactions` (`message`,`user`);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `reply_to` text;