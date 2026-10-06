CREATE TABLE `chat_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`user` text NOT NULL,
	`message` text,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`digest` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chat_attachment_message` ON `chat_attachments` (`message`);--> statement-breakpoint
CREATE TABLE `chat_reviews` (
	`message` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`categories` text DEFAULT '[]' NOT NULL,
	`lease` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`reviewer` text
);
--> statement-breakpoint
CREATE INDEX `idx_chat_review_queue` ON `chat_reviews` (`status`,`lease`);--> statement-breakpoint
ALTER TABLE `chat_messages` ADD `shared_photo` text;