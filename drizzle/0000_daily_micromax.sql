CREATE TYPE "public"."challenge_type" AS ENUM('personal', 'group');--> statement-breakpoint
CREATE TABLE "challenge_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" varchar(80) NOT NULL,
	"description" text,
	"emoji" varchar(32) NOT NULL,
	"type" "challenge_type" NOT NULL,
	"duration_days" integer NOT NULL,
	"start_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"telegram_id" varchar(32) NOT NULL,
	"username" varchar(64),
	"first_name" varchar(128) NOT NULL,
	"last_name" varchar(128),
	"photo_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_participants" ADD CONSTRAINT "challenge_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_participants_challenge_user_unique" ON "challenge_participants" USING btree ("challenge_id","user_id");--> statement-breakpoint
CREATE INDEX "challenge_participants_user_id_index" ON "challenge_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "challenges_owner_id_index" ON "challenges" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "check_ins_challenge_user_date_unique" ON "check_ins" USING btree ("challenge_id","user_id","date");--> statement-breakpoint
CREATE INDEX "check_ins_challenge_id_index" ON "check_ins" USING btree ("challenge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_id_unique" ON "users" USING btree ("telegram_id");