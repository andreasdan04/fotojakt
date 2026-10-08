CREATE TABLE `review_appeals` (
	`id` text PRIMARY KEY NOT NULL,
	`decision` text NOT NULL,
	`user` text NOT NULL,
	`reason` text NOT NULL,
	`created` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`reviewer` text,
	`resolution` text,
	`resolved` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_appeals_decision_unique` ON `review_appeals` (`decision`);--> statement-breakpoint
CREATE INDEX `idx_appeal_queue` ON `review_appeals` (`status`,`created`);--> statement-breakpoint
CREATE TABLE `review_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`submission` text NOT NULL,
	`kind` text NOT NULL,
	`actor` text,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`created` integer NOT NULL,
	`current` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_review_current` ON `review_decisions` (`submission`,`kind`) WHERE "review_decisions"."current"=1;--> statement-breakpoint
CREATE INDEX `idx_review_actor` ON `review_decisions` (`actor`,`created`);--> statement-breakpoint
CREATE TABLE `staff_acceptances` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`version` text NOT NULL,
	`document` text NOT NULL,
	`signature` text NOT NULL,
	`created` integer NOT NULL,
	`revoked` integer
);
--> statement-breakpoint
CREATE INDEX `idx_staff_acceptance_user` ON `staff_acceptances` (`user`,`created`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_staff_signed_version` ON `staff_acceptances` (`user`,`version`) WHERE "staff_acceptances"."revoked" IS NULL;--> statement-breakpoint
CREATE TABLE `staff_roles` (
	`user` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL,
	`updated` integer NOT NULL,
	`actor` text NOT NULL
);

--> statement-breakpoint
INSERT INTO review_decisions(id,submission,kind,actor,status,reason,created,current)
SELECT 'legacy:bonus:'||b.submission,b.submission,'bonus',
 (SELECT json_extract(a.value,'$.actor') FROM settings a WHERE a.key LIKE 'privacy-audit:%' AND json_valid(a.value) AND json_extract(a.value,'$.action')='bonus-review' AND json_extract(a.value,'$.ids[0]')=b.submission ORDER BY json_extract(a.value,'$.created') DESC LIMIT 1),
 b.status,b.reason,b.updated,1 FROM bonus_reviews b JOIN submissions s ON s.id=b.submission WHERE b.status IN('approved','rejected');
--> statement-breakpoint
INSERT INTO review_decisions(id,submission,kind,actor,status,reason,created,current)
SELECT 'legacy:photo:'||s.id,s.id,'photo',
 (SELECT json_extract(a.value,'$.actor') FROM settings a WHERE a.key LIKE 'privacy-audit:%' AND json_valid(a.value) AND json_extract(a.value,'$.action')='hunt-submission-review' AND json_extract(a.value,'$.ids[0]')=s.id ORDER BY json_extract(a.value,'$.created') DESC LIMIT 1),
 'rejected',s.note,s.submitted,1 FROM submissions s WHERE s.valid=0 AND s.note<>'';
