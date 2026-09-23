ALTER TABLE "reminder_deliveries" ALTER COLUMN "sent_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ALTER COLUMN "sent_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD COLUMN "status" varchar(16) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder_deliveries" ADD COLUMN "claimed_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
UPDATE "reminder_deliveries" SET "status" = 'sent' WHERE "sent_at" IS NOT NULL;
