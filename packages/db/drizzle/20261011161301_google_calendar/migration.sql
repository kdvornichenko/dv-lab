CREATE TABLE "google_command_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"stage" integer NOT NULL,
	"previous_stage" integer,
	"generation" bigint NOT NULL,
	"kind" text NOT NULL,
	"request" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"effect" text DEFAULT 'none' NOT NULL,
	"attempts" jsonb DEFAULT '[]' NOT NULL,
	"acknowledgement" jsonb,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_command_stages_position_uq" UNIQUE("command_id","stage"),
	CONSTRAINT "google_command_stages_position_ck" CHECK ("stage" >= 0 and ("previous_stage" is null or "previous_stage" between 0 and "stage" - 1) and "generation" between 0 and 9007199254740991),
	CONSTRAINT "google_command_stages_kind_ck" CHECK ("kind" in ('write', 'verify', 'trim', 'cancel_tail', 'detach', 'create_master', 'restore_prefix')),
	CONSTRAINT "google_command_stages_state_ck" CHECK ("state" in ('pending', 'dispatching', 'outcome_unknown', 'acknowledged', 'failed') and "effect" in ('none', 'unknown', 'confirmed')),
	CONSTRAINT "google_command_stages_ack_ck" CHECK (("state" = 'acknowledged') = ("acknowledgement" is not null) and ("state" = 'acknowledged') = ("acknowledged_at" is not null) and ("state" <> 'acknowledged' or "effect" = 'confirmed')),
	CONSTRAINT "google_command_stages_effect_ck" CHECK (("state" not in ('pending', 'failed') or "effect" = 'none') and ("state" <> 'outcome_unknown' or "effect" = 'unknown')),
	CONSTRAINT "google_command_stages_payload_ck" CHECK (jsonb_typeof("request") = 'object' and jsonb_typeof("attempts") = 'array' and ("acknowledgement" is null or jsonb_typeof("acknowledgement") = 'object'))
);
--> statement-breakpoint
CREATE TABLE "google_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"calendar_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"input_hash" text NOT NULL,
	"expected_version" text NOT NULL,
	"base_revision" bigint NOT NULL,
	"generation" bigint NOT NULL,
	"operation" text NOT NULL,
	"plan" jsonb NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"effect" text DEFAULT 'none' NOT NULL,
	"issue" text,
	"confirmed_revision" bigint,
	"next_action" text DEFAULT 'wait' NOT NULL,
	"dispatch_deadline" timestamp with time zone NOT NULL,
	"dispatched_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_commands_request_uq" UNIQUE("account_id","request_id"),
	CONSTRAINT "google_commands_owner_uq" UNIQUE("account_id","connection_id","id"),
	CONSTRAINT "google_commands_identity_ck" CHECK ("input_hash" ~ '^[0-9a-f]{64}$' and char_length("expected_version") between 1 and 2048),
	CONSTRAINT "google_commands_generation_ck" CHECK ("generation" between 0 and 9007199254740991 and "base_revision" >= 0 and ("confirmed_revision" is null or "confirmed_revision" >= "base_revision")),
	CONSTRAINT "google_commands_operation_ck" CHECK ("operation" in ('create', 'move', 'cancel', 'restore', 'move_series', 'end_series') and (jsonb_typeof("plan") = 'object' and "plan"->>'version' = '1' and "plan"->'input'->>'operation' = "operation") is true),
	CONSTRAINT "google_commands_state_ck" CHECK ("state" in ('pending', 'dispatching', 'outcome_unknown', 'projection_pending', 'applied', 'failed', 'partial_recovery', 'recovery_required') and "effect" in ('none', 'unknown', 'partial', 'confirmed')),
	CONSTRAINT "google_commands_issue_ck" CHECK ("issue" is null or "issue" in ('connection_required', 'reconnect_required', 'permission_required', 'provider_unavailable', 'command_pending', 'external_change', 'disconnect_failed', 'invalid_provider_data', 'history_only', 'precondition_failed', 'not_applied')),
	CONSTRAINT "google_commands_action_ck" CHECK ("next_action" in ('wait', 'refresh', 'retry_new_command', 'resume_recovery', 'none')),
	CONSTRAINT "google_commands_applied_ck" CHECK (("state" = 'applied') = ("applied_at" is not null) and ("state" = 'applied') = ("confirmed_revision" is not null) and ("state" <> 'applied' or ("effect" = 'confirmed' and "issue" is null and "acknowledged_at" is not null and "next_action" = 'none'))),
	CONSTRAINT "google_commands_effect_ck" CHECK (("state" not in ('pending', 'failed') or "effect" = 'none') and ("state" <> 'projection_pending' or ("effect" = 'confirmed' and "acknowledged_at" is not null)) and ("state" <> 'outcome_unknown' or "effect" in ('unknown', 'partial')) and ("state" <> 'partial_recovery' or "effect" = 'partial')),
	CONSTRAINT "google_commands_time_ck" CHECK ("dispatch_deadline" > "created_at" and ("dispatched_at" is null or "dispatched_at" >= "created_at") and ("acknowledged_at" is null or ("dispatched_at" is not null and "acknowledged_at" >= "dispatched_at")) and ("applied_at" is null or "applied_at" >= "acknowledged_at"))
);
--> statement-breakpoint
CREATE TABLE "google_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL CONSTRAINT "google_connections_account_uq" UNIQUE,
	"calendar_id" text,
	"calendar_label" text,
	"calendar_time_zone" text,
	"history_cutover_at" timestamp with time zone,
	"generation" bigint DEFAULT 0 NOT NULL,
	"credential_generation" bigint DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'not_connected' NOT NULL,
	"issue" text,
	"disconnect_resolution" text DEFAULT 'none' NOT NULL,
	"encrypted_refresh_token" jsonb,
	"credential_mode" text,
	"revoke_attempt_id" uuid,
	"revoke_started_at" timestamp with time zone,
	"revoke_finished_at" timestamp with time zone,
	"revoke_attempt_count" integer DEFAULT 0 NOT NULL,
	"snapshot_revision" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_connections_owner_uq" UNIQUE("account_id","id"),
	CONSTRAINT "google_connections_calendar_uq" UNIQUE("account_id","id","calendar_id"),
	CONSTRAINT "google_connections_generation_ck" CHECK ("generation" between 0 and 9007199254740991 and "credential_generation" between 0 and 9007199254740991 and "snapshot_revision" >= 0),
	CONSTRAINT "google_connections_state_ck" CHECK ("state" in ('not_connected', 'connected', 'reconnect_required', 'permission_required', 'disconnecting', 'disconnect_failed')),
	CONSTRAINT "google_connections_issue_ck" CHECK ("issue" is null or "issue" in ('connection_required', 'reconnect_required', 'permission_required', 'provider_unavailable', 'command_pending', 'external_change', 'disconnect_failed', 'invalid_provider_data', 'history_only')),
	CONSTRAINT "google_connections_target_ck" CHECK (("calendar_id" is null) = ("calendar_label" is null) and ("calendar_id" is null) = ("calendar_time_zone" is null) and ("calendar_id" is null) = ("history_cutover_at" is null)),
	CONSTRAINT "google_connections_credentials_ck" CHECK (("encrypted_refresh_token" is null) = ("credential_mode" is null) and ("credential_mode" is null or "credential_mode" in ('active', 'revoke_only'))),
	CONSTRAINT "google_connections_envelope_ck" CHECK ("encrypted_refresh_token" is null or (jsonb_typeof("encrypted_refresh_token") = 'object' and "encrypted_refresh_token" ?& array['keyId', 'nonce', 'tag', 'ciphertext'])),
	CONSTRAINT "google_connections_connected_ck" CHECK ("state" <> 'connected' or ("calendar_id" is not null and "credential_mode" = 'active' and "encrypted_refresh_token" is not null)),
	CONSTRAINT "google_connections_disconnected_ck" CHECK ("state" <> 'not_connected' or "encrypted_refresh_token" is null),
	CONSTRAINT "google_connections_revoking_ck" CHECK ("state" not in ('disconnecting', 'disconnect_failed') or ("credential_mode" = 'revoke_only' and "encrypted_refresh_token" is not null)),
	CONSTRAINT "google_connections_resolution_ck" CHECK ("disconnect_resolution" in ('none', 'provider_confirmed', 'operator_confirmed') and ("disconnect_resolution" = 'none' or ("state" = 'not_connected' and "encrypted_refresh_token" is null and ("revoke_attempt_id" is null or "revoke_finished_at" is not null)))),
	CONSTRAINT "google_connections_revoke_ck" CHECK ("revoke_attempt_count" >= 0 and ("revoke_attempt_id" is null) = ("revoke_started_at" is null) and ("revoke_finished_at" is null or ("revoke_started_at" is not null and "revoke_finished_at" >= "revoke_started_at")))
);
--> statement-breakpoint
CREATE TABLE "google_event_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"calendar_id" text NOT NULL,
	"entity_kind" text NOT NULL,
	"local_entity_id" uuid NOT NULL,
	"original_on" date,
	"student_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"recurring_event_id" text,
	"original_start_time" jsonb,
	"representation_generation" bigint NOT NULL,
	"command_id" uuid NOT NULL,
	"state" text DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone,
	CONSTRAINT "google_event_mappings_generation_uq" UNIQUE NULLS NOT DISTINCT("connection_id","entity_kind","local_entity_id","original_on","representation_generation"),
	CONSTRAINT "google_event_mappings_provider_uq" UNIQUE("connection_id","calendar_id","event_id"),
	CONSTRAINT "google_event_mappings_identity_ck" CHECK ("entity_kind" in ('single', 'series', 'occurrence') and ("entity_kind" = 'occurrence') = ("original_on" is not null) and ("entity_kind" = 'occurrence') = ("recurring_event_id" is not null) and ("entity_kind" = 'occurrence') = ("original_start_time" is not null)),
	CONSTRAINT "google_event_mappings_generation_ck" CHECK ("representation_generation" between 0 and 9007199254740991),
	CONSTRAINT "google_event_mappings_state_ck" CHECK ("state" in ('reserved', 'active', 'retired') and ("state" = 'retired') = ("retired_at" is not null) and ("retired_at" is null or "retired_at" >= "created_at"))
);
--> statement-breakpoint
CREATE TABLE "google_oauth_flows" (
	"state_digest" text PRIMARY KEY,
	"account_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"session_token_hash" text NOT NULL,
	"session_epoch" integer NOT NULL,
	"generation" bigint NOT NULL,
	"encrypted_verifier" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "google_oauth_flows_digest_ck" CHECK ("state_digest" ~ '^[0-9a-f]{64}$' and "session_token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "google_oauth_flows_generation_ck" CHECK ("generation" between 0 and 9007199254740991 and "session_epoch" >= 0),
	CONSTRAINT "google_oauth_flows_lifetime_ck" CHECK ("expires_at" > "created_at" and ("consumed_at" is null or "consumed_at" >= "created_at")),
	CONSTRAINT "google_oauth_flows_verifier_ck" CHECK (("consumed_at" is null) = ("encrypted_verifier" is not null) and ("encrypted_verifier" is null or (jsonb_typeof("encrypted_verifier") = 'object' and "encrypted_verifier" ?& array['keyId', 'nonce', 'tag', 'ciphertext'])))
);
--> statement-breakpoint
CREATE TABLE "google_next_lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"calendar_id" text NOT NULL,
	"student_id" uuid NOT NULL,
	"generation" bigint NOT NULL,
	"revision" bigint NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"result" text NOT NULL,
	"starts_at" timestamp with time zone,
	"checked_at" timestamp with time zone NOT NULL,
	"complete_prefix" boolean NOT NULL,
	"end_of_list" boolean NOT NULL,
	CONSTRAINT "google_next_lessons_snapshot_uq" UNIQUE("account_id","student_id","generation","revision","as_of"),
	CONSTRAINT "google_next_lessons_generation_ck" CHECK ("generation" between 0 and 9007199254740991 and "revision" >= 0),
	CONSTRAINT "google_next_lessons_result_ck" CHECK ("result" in ('known', 'none', 'unknown') and ("result" = 'known') = ("starts_at" is not null) and ("starts_at" is null or "starts_at" >= "as_of")),
	CONSTRAINT "google_next_lessons_proof_ck" CHECK (("result" = 'unknown' or "complete_prefix") and ("result" <> 'none' or "end_of_list") and (not "end_of_list" or "complete_prefix"))
);
--> statement-breakpoint
CREATE TABLE "google_read_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"window_id" uuid NOT NULL,
	"generation" bigint NOT NULL,
	"snapshot_revision" bigint NOT NULL,
	"event_id" text NOT NULL,
	"etag" text NOT NULL,
	"recurring_event_id" text,
	"original_start_time" jsonb,
	"summary" text,
	"start" jsonb,
	"end" jsonb,
	"status" text NOT NULL,
	"transparency" text NOT NULL,
	"event_type" text NOT NULL,
	"local_ref" jsonb,
	"student_id" uuid,
	"representation_generation" bigint,
	"command_id" uuid,
	"binding_kind" text NOT NULL,
	CONSTRAINT "google_read_events_window_event_uq" UNIQUE("window_id","event_id"),
	CONSTRAINT "google_read_events_status_ck" CHECK ("status" in ('confirmed', 'tentative', 'cancelled') and "transparency" in ('opaque', 'transparent')),
	CONSTRAINT "google_read_events_time_ck" CHECK (("start" is null) = ("end" is null) and ("status" = 'cancelled' or "start" is not null) and ("recurring_event_id" is null) = ("original_start_time" is null)),
	CONSTRAINT "google_read_events_binding_ck" CHECK (("binding_kind" = 'external' and "local_ref" is null and "student_id" is null and "representation_generation" is null and "command_id" is null) or ("binding_kind" in ('lesson', 'transition') and "local_ref" is not null and "student_id" is not null and "representation_generation" is not null and ("binding_kind" <> 'transition' or "command_id" is not null))),
	CONSTRAINT "google_read_events_representation_ck" CHECK ("representation_generation" is null or "representation_generation" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "google_read_windows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"calendar_id" text NOT NULL,
	"generation" bigint NOT NULL,
	"snapshot_revision" bigint NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"display_time_zone" text NOT NULL,
	"calendar_time_zone" text NOT NULL,
	"fetched_at" timestamp with time zone,
	"coverage_state" text DEFAULT 'incomplete' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "google_read_windows_snapshot_uq" UNIQUE("account_id","connection_id","id","generation","snapshot_revision"),
	CONSTRAINT "google_read_windows_revision_uq" UNIQUE("connection_id","window_start","window_end","display_time_zone","snapshot_revision"),
	CONSTRAINT "google_read_windows_generation_ck" CHECK ("generation" between 0 and 9007199254740991 and "snapshot_revision" >= 0),
	CONSTRAINT "google_read_windows_range_ck" CHECK ("window_start" < "window_end"),
	CONSTRAINT "google_read_windows_coverage_ck" CHECK ("coverage_state" in ('incomplete', 'complete') and ("coverage_state" = 'complete') = ("fetched_at" is not null))
);
--> statement-breakpoint
CREATE INDEX "google_commands_unresolved_idx" ON "google_commands" ("connection_id","created_at") WHERE "state" not in ('applied', 'failed');--> statement-breakpoint
CREATE UNIQUE INDEX "google_event_mappings_active_entity_uq" ON "google_event_mappings" ("connection_id","entity_kind","local_entity_id") WHERE "original_on" is null and "state" in ('reserved', 'active');--> statement-breakpoint
CREATE UNIQUE INDEX "google_event_mappings_active_occurrence_uq" ON "google_event_mappings" ("connection_id","local_entity_id","original_on") WHERE "entity_kind" = 'occurrence' and "state" in ('reserved', 'active');--> statement-breakpoint
CREATE INDEX "google_oauth_flows_owner_idx" ON "google_oauth_flows" ("account_id","expires_at");--> statement-breakpoint
CREATE INDEX "google_next_lessons_student_idx" ON "google_next_lessons" ("account_id","student_id","checked_at");--> statement-breakpoint
CREATE INDEX "google_read_events_student_idx" ON "google_read_events" ("account_id","student_id","snapshot_revision");--> statement-breakpoint
CREATE INDEX "google_read_windows_complete_idx" ON "google_read_windows" ("account_id","window_start","window_end","snapshot_revision") WHERE "coverage_state" = 'complete';--> statement-breakpoint
ALTER TABLE "google_command_stages" ADD CONSTRAINT "google_command_stages_owner_fk" FOREIGN KEY ("account_id","connection_id","command_id") REFERENCES "google_commands"("account_id","connection_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_commands" ADD CONSTRAINT "google_commands_calendar_fk" FOREIGN KEY ("account_id","connection_id","calendar_id") REFERENCES "google_connections"("account_id","id","calendar_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_connections" ADD CONSTRAINT "google_connections_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_event_mappings" ADD CONSTRAINT "google_event_mappings_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_event_mappings" ADD CONSTRAINT "google_event_mappings_calendar_fk" FOREIGN KEY ("account_id","connection_id","calendar_id") REFERENCES "google_connections"("account_id","id","calendar_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_event_mappings" ADD CONSTRAINT "google_event_mappings_command_fk" FOREIGN KEY ("account_id","connection_id","command_id") REFERENCES "google_commands"("account_id","connection_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_oauth_flows" ADD CONSTRAINT "google_oauth_flows_owner_fk" FOREIGN KEY ("account_id","connection_id") REFERENCES "google_connections"("account_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_next_lessons" ADD CONSTRAINT "google_next_lessons_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_next_lessons" ADD CONSTRAINT "google_next_lessons_calendar_fk" FOREIGN KEY ("account_id","connection_id","calendar_id") REFERENCES "google_connections"("account_id","id","calendar_id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_read_events" ADD CONSTRAINT "google_read_events_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_read_events" ADD CONSTRAINT "google_read_events_snapshot_fk" FOREIGN KEY ("account_id","connection_id","window_id","generation","snapshot_revision") REFERENCES "google_read_windows"("account_id","connection_id","id","generation","snapshot_revision") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_read_events" ADD CONSTRAINT "google_read_events_command_fk" FOREIGN KEY ("account_id","connection_id","command_id") REFERENCES "google_commands"("account_id","connection_id","id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "google_read_windows" ADD CONSTRAINT "google_read_windows_calendar_fk" FOREIGN KEY ("account_id","connection_id","calendar_id") REFERENCES "google_connections"("account_id","id","calendar_id") ON DELETE RESTRICT;