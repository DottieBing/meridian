CREATE TABLE "page_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"url" text NOT NULL,
	"final_url" text NOT NULL,
	"status" integer NOT NULL,
	"content_type" text,
	"bytes" integer NOT NULL,
	"truncated" boolean DEFAULT false NOT NULL,
	"content_hash" text NOT NULL,
	"storage_path" text NOT NULL,
	"headers" jsonb NOT NULL,
	"redirects" jsonb NOT NULL,
	"ttfb_ms" integer,
	"total_ms" integer,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_snapshots_site_url_idx" ON "page_snapshots" USING btree ("website_id","final_url","fetched_at");--> statement-breakpoint
CREATE INDEX "page_snapshots_hash_idx" ON "page_snapshots" USING btree ("content_hash");