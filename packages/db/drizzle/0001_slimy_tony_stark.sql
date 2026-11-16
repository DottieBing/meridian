CREATE TABLE "business_sources" (
	"business_id" uuid NOT NULL,
	"source_record_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_sources_business_id_source_record_id_pk" PRIMARY KEY("business_id","source_record_id")
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"investigation_id" uuid NOT NULL,
	"category" text NOT NULL,
	"code" text NOT NULL,
	"severity" text NOT NULL,
	"is_objective" boolean NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"affected_url" text,
	"evidence_id" uuid NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_records" DROP CONSTRAINT "source_records_business_id_businesses_id_fk";
--> statement-breakpoint
DROP INDEX "source_records_business_idx";--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "stale_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "stale_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "business_sources" ADD CONSTRAINT "business_sources_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_sources" ADD CONSTRAINT "business_sources_source_record_id_source_records_id_fk" FOREIGN KEY ("source_record_id") REFERENCES "public"."source_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "findings_investigation_idx" ON "findings" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "findings_code_idx" ON "findings" USING btree ("code");--> statement-breakpoint
CREATE INDEX "businesses_name_trgm_idx" ON "businesses" USING gin ("normalized_name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "source_records_provider_idx" ON "source_records" USING btree ("workspace_id","provider");--> statement-breakpoint
ALTER TABLE "source_records" DROP COLUMN "business_id";