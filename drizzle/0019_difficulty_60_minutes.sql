UPDATE difficulty_polls SET deadline=created+3600000 WHERE status='open';
--> statement-breakpoint
DELETE FROM hunt_changes WHERE kind='difficulty-poll' AND poll IN (SELECT id FROM difficulty_polls WHERE status='open') AND NOT EXISTS (SELECT 1 FROM starts a WHERE a.challenge=hunt_changes.challenge AND a.user=hunt_changes.user);
