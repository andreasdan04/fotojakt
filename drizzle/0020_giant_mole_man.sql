CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`user` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chat_room_created` ON `chat_messages` (`room`,`created`,`id`);