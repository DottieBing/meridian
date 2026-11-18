CREATE TABLE "website_technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"investigation_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"version" text,
	"versions" jsonb NOT NULL,
	"detail" text,
	"confidence" integer NOT NULL,
	"via" text NOT NULL,
	"evidence_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "website_technologies" ADD CONSTRAINT "website_technologies_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_technologies" ADD CONSTRAINT "website_technologies_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_technologies" ADD CONSTRAINT "website_technologies_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website_technologies" ADD CONSTRAINT "website_technologies_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "website_tech_investigation_idx" ON "website_technologies" USING btree ("investigation_id");--> statement-breakpoint
CREATE INDEX "website_tech_site_idx" ON "website_technologies" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "website_tech_slug_idx" ON "website_technologies" USING btree ("slug");