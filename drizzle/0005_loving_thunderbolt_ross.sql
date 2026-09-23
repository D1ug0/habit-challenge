CREATE TABLE "rate_limit_buckets" (
	"key" varchar(128) PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_reset_at_index" ON "rate_limit_buckets" USING btree ("reset_at");