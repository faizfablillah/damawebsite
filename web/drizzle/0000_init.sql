CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"template" text NOT NULL,
	"user_id" uuid,
	"membership_id" uuid,
	"organisation_id" uuid,
	"status" text NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"tier" text NOT NULL,
	"user_id" uuid,
	"organisation_id" uuid,
	"state_code" text NOT NULL,
	"member_code" text,
	"join_year" integer,
	"seq" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"eligibility_status" text DEFAULT 'not_required' NOT NULL,
	"eligibility_note" text,
	"institution" text,
	"graduation_year" integer,
	"student_proof_key" text,
	"student_proof_name" text,
	"background" text,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_date" date,
	"end_date" date,
	"activated_at" timestamp with time zone,
	"imported" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_member_code_unique" UNIQUE("member_code")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"item_code" text NOT NULL,
	"description" text NOT NULL,
	"unit_price" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'awaiting_payment' NOT NULL,
	"payment_reference" text NOT NULL,
	"period_start" date,
	"period_end" date,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"author_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organisations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"ssm_no" text NOT NULL,
	"industry" text,
	"org_size" text,
	"address" text,
	"state_code" text NOT NULL,
	"contact_user_id" uuid NOT NULL,
	"contact_name" text NOT NULL,
	"contact_job_title" text,
	"contact_email" text NOT NULL,
	"contact_phone" text NOT NULL,
	"areas_of_interest" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"remarks" text,
	"wants_call" boolean DEFAULT false NOT NULL,
	"pipeline_status" text DEFAULT 'new_lead' NOT NULL,
	"assigned_pic_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"method" text DEFAULT 'bank_transfer' NOT NULL,
	"payment_date" date NOT NULL,
	"reference" text NOT NULL,
	"proof_key" text,
	"proof_name" text,
	"status" text DEFAULT 'submitted' NOT NULL,
	"reject_reason" text,
	"note" text,
	"submitted_by" uuid,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_no" text NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_receipt_no_unique" UNIQUE("receipt_no"),
	CONSTRAINT "receipts_payment_id_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
CREATE TABLE "renewal_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"end_date" date NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seat_id" uuid NOT NULL,
	"requested_by" uuid,
	"name" text NOT NULL,
	"job_title" text,
	"email" text NOT NULL,
	"phone" text,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"membership_id" uuid NOT NULL,
	"seat_no" integer NOT NULL,
	"name" text,
	"job_title" text,
	"email" text,
	"phone" text,
	"assigned_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"job_title" text,
	"organisation" text,
	"address" text,
	"state_code" text,
	"role" text DEFAULT 'member' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"consent_at" timestamp with time zone,
	"consent_version" text,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_log" ADD CONSTRAINT "email_log_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_documents" ADD CONSTRAINT "org_documents_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_documents" ADD CONSTRAINT "org_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_notes" ADD CONSTRAINT "org_notes_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_notes" ADD CONSTRAINT "org_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_contact_user_id_users_id_fk" FOREIGN KEY ("contact_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organisations" ADD CONSTRAINT "organisations_assigned_pic_id_users_id_fk" FOREIGN KEY ("assigned_pic_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renewal_reminders" ADD CONSTRAINT "renewal_reminders_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_requests" ADD CONSTRAINT "seat_requests_seat_id_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."seats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_requests" ADD CONSTRAINT "seat_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_requests" ADD CONSTRAINT "seat_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seats" ADD CONSTRAINT "seats_membership_id_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "email_log_membership_idx" ON "email_log" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_org_idx" ON "memberships" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "orders_membership_idx" ON "orders" USING btree ("membership_id");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "renewal_reminders_unique" ON "renewal_reminders" USING btree ("membership_id","end_date","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "seats_membership_no_idx" ON "seats" USING btree ("membership_id","seat_no");--> statement-breakpoint
CREATE INDEX "seats_email_idx" ON "seats" USING btree (lower("email"));