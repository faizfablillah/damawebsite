CREATE TABLE "event_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"payment_date" date NOT NULL,
	"reference" text NOT NULL,
	"proof_key" text,
	"proof_name" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"reject_reason" text,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"receipt_no" text,
	"receipt" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_payments_receipt_no_unique" UNIQUE("receipt_no")
);
--> statement-breakpoint
CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"organisation" text,
	"member_code" text,
	"rate" text NOT NULL,
	"amount" integer NOT NULL,
	"payment_reference" text,
	"status" text NOT NULL,
	"attended" boolean DEFAULT false NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"summary" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"venue" text,
	"online_url" text,
	"audience" text DEFAULT 'public' NOT NULL,
	"capacity" integer,
	"member_price" integer DEFAULT 0 NOT NULL,
	"non_member_price" integer,
	"registration_closes_at" timestamp with time zone,
	"image_key" text,
	"materials" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_payments_status_idx" ON "event_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "event_payments_registration_idx" ON "event_payments" USING btree ("registration_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_registrations_event_user_idx" ON "event_registrations" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX "event_registrations_status_idx" ON "event_registrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_starts_idx" ON "events" USING btree ("starts_at");