CREATE TABLE "report_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"org_name" text DEFAULT 'Your Company Name' NOT NULL,
	"contact_line" text DEFAULT 'you@example.com' NOT NULL,
	"logo_path" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_settings" ADD CONSTRAINT "report_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;