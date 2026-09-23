-- Existing check-ins used each user's mutable time zone. Normalize them to the
-- challenge's calendar day before the application starts using that day.
DROP INDEX "check_ins_challenge_user_date_unique";--> statement-breakpoint
WITH canonical AS (
  SELECT ci.id,
    row_number() OVER (
      PARTITION BY ci.challenge_id, ci.user_id,
        (ci.created_at AT TIME ZONE c.time_zone)::date
      ORDER BY ci.created_at, ci.id
    ) AS row_number
  FROM check_ins ci
  JOIN challenges c ON c.id = ci.challenge_id
)
DELETE FROM check_ins ci
USING canonical
WHERE ci.id = canonical.id AND canonical.row_number > 1;--> statement-breakpoint
UPDATE check_ins ci
SET date = (ci.created_at AT TIME ZONE c.time_zone)::date
FROM challenges c
WHERE c.id = ci.challenge_id;--> statement-breakpoint
CREATE UNIQUE INDEX "check_ins_challenge_user_date_unique"
  ON "check_ins" USING btree ("challenge_id", "user_id", "date");
