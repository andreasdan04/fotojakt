CREATE TABLE `friendships` (
	`a` text NOT NULL,
	`b` text NOT NULL,
	`requester` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_friend_pair` ON `friendships` (`a`,`b`);--> statement-breakpoint
CREATE TABLE `group_invites` (
	`group_id` text NOT NULL,
	`user` text NOT NULL,
	`inviter` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_group_invite` ON `group_invites` (`group_id`,`user`);--> statement-breakpoint
CREATE TABLE `group_members` (
	`group_id` text NOT NULL,
	`user` text NOT NULL,
	`joined` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_group_member` ON `group_members` (`group_id`,`user`);--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter` text NOT NULL,
	`target` text NOT NULL,
	`reason` text NOT NULL,
	`created` integer NOT NULL,
	`resolved` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `members` ADD `username` text;--> statement-breakpoint
CREATE UNIQUE INDEX `members_username_unique` ON `members` (`username`);--> statement-breakpoint
UPDATE members SET username=(
  WITH RECURSIVE candidates(n,handle) AS (
    SELECT 0,'bruker_'||members.rowid
    UNION ALL
    SELECT n+1,'bruker_'||members.rowid||'_'||(n+1) FROM candidates
    WHERE EXISTS(SELECT 1 FROM local_accounts WHERE login=handle)
  ) SELECT handle FROM candidates ORDER BY n DESC LIMIT 1
) WHERE username IS NULL;
--> statement-breakpoint
INSERT INTO groups(id,name,owner,created) SELECT 'familien-glum','Familien Glum',id,CAST(strftime('%s','now') AS INTEGER)*1000 FROM members WHERE admin=1 ORDER BY joined LIMIT 1;
--> statement-breakpoint
INSERT INTO group_members(group_id,user,joined) SELECT 'familien-glum',id,joined FROM members WHERE EXISTS(SELECT 1 FROM groups WHERE id='familien-glum');
--> statement-breakpoint
INSERT INTO friendships(a,b,requester,status,created) SELECT a.id,b.id,a.id,'accepted',MAX(a.joined,b.joined) FROM members a JOIN members b ON a.id<b.id;
--> statement-breakpoint
UPDATE members SET status='approved',approved=COALESCE(approved,CAST(strftime('%s','now') AS INTEGER)*1000) WHERE status='pending';
