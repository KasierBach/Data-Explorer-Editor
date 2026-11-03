BEGIN;

-- CreateTable
CREATE TABLE "CommentEvent" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "legacyAuditId" TEXT,
    "action" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "resourceType" "ResourceType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT,
    "queryId" TEXT,
    "dashboardId" TEXT,
    "erdId" TEXT,

    CONSTRAINT "CommentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentBackfill" (
    "id" TEXT NOT NULL,
    "lastCreatedAt" TIMESTAMP(3),
    "lastAuditId" TEXT,
    "throughCreatedAt" TIMESTAMP(3),
    "throughAuditId" TEXT,
    "examined" INTEGER NOT NULL DEFAULT 0,
    "copied" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentBackfill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommentEvent_sequence_key" ON "CommentEvent"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "CommentEvent_legacyAuditId_key" ON "CommentEvent"("legacyAuditId");

-- CreateIndex
CREATE INDEX "CommentEvent_organizationId_resourceType_resourceId_sequenc_idx" ON "CommentEvent"("organizationId", "resourceType", "resourceId", "sequence");

-- CreateIndex
CREATE INDEX "CommentEvent_organizationId_threadId_sequence_idx" ON "CommentEvent"("organizationId", "threadId", "sequence");

-- AddForeignKey
ALTER TABLE "CommentEvent" ADD CONSTRAINT "CommentEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentEvent" ADD CONSTRAINT "CommentEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentEvent" ADD CONSTRAINT "CommentEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentEvent" ADD CONSTRAINT "CommentEvent_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "SavedQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentEvent" ADD CONSTRAINT "CommentEvent_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentEvent" ADD CONSTRAINT "CommentEvent_erdId_fkey" FOREIGN KEY ("erdId") REFERENCES "ErdWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentReaction" ADD CONSTRAINT "CommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "CommentEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;

ALTER TABLE "CommentEvent" ADD CONSTRAINT "CommentEvent_resource_binding_check" CHECK (
    ("resourceType" = 'CONNECTION' AND "connectionId" IS NOT NULL AND "connectionId" = "resourceId" AND "queryId" IS NULL AND "dashboardId" IS NULL AND "erdId" IS NULL) OR
    ("resourceType" = 'QUERY' AND "queryId" IS NOT NULL AND "queryId" = "resourceId" AND "connectionId" IS NULL AND "dashboardId" IS NULL AND "erdId" IS NULL) OR
    ("resourceType" = 'DASHBOARD' AND "dashboardId" IS NOT NULL AND "dashboardId" = "resourceId" AND "connectionId" IS NULL AND "queryId" IS NULL AND "erdId" IS NULL) OR
    ("resourceType" = 'ERD' AND "erdId" IS NOT NULL AND "erdId" = "resourceId" AND "connectionId" IS NULL AND "queryId" IS NULL AND "dashboardId" IS NULL)
);

CREATE FUNCTION data_explorer_comment_details(value TEXT) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    RETURN value::jsonb;
EXCEPTION WHEN invalid_text_representation THEN
    RETURN NULL;
END;
$$;

-- Each call commits its checkpoint with its batch; the initial migration is atomic.
CREATE FUNCTION data_explorer_backfill_comment_events(batch_size INTEGER DEFAULT 500)
RETURNS TABLE(examined INTEGER, copied INTEGER, skipped INTEGER, completed BOOLEAN)
LANGUAGE plpgsql AS $$
DECLARE
    state "CommentBackfill"%ROWTYPE;
    event RECORD;
    details JSONB;
    mentions JSONB;
    attachments JSONB;
    resource_type "ResourceType";
    resource_id TEXT;
    event_id TEXT;
    resource_exists BOOLEAN;
    valid BOOLEAN;
    seen INTEGER := 0;
    inserted INTEGER;
    batch_copied INTEGER := 0;
    batch_skipped INTEGER := 0;
BEGIN
    IF batch_size IS NULL OR batch_size < 1 OR batch_size > 500 THEN
        RAISE EXCEPTION 'Comment backfill batch size must be between 1 and 500';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('data-explorer:r09-comment-backfill'));
    INSERT INTO "CommentBackfill"("id", "throughCreatedAt", "throughAuditId")
    SELECT 'legacy-audit-v1', latest."createdAt", latest."id"
    FROM (SELECT 1) seed LEFT JOIN LATERAL (
        SELECT "createdAt", "id" FROM "AuditLog"
        WHERE "organizationId" IS NOT NULL AND "action" IN
            ('TEAM:COMMENT_CREATE', 'TEAM:COMMENT_REPLY', 'TEAM:COMMENT_EDIT', 'TEAM:COMMENT_DELETE', 'TEAM:COMMENT_RESOLVE')
        ORDER BY "createdAt" DESC, "id" DESC LIMIT 1
    ) latest ON TRUE
    ON CONFLICT ("id") DO NOTHING;
    SELECT * INTO STRICT state FROM "CommentBackfill" WHERE "id" = 'legacy-audit-v1';
    IF state."completed" THEN
        RETURN QUERY SELECT state."examined", state."copied", state."skipped", state."completed";
        RETURN;
    END IF;

    FOR event IN
        SELECT * FROM "AuditLog"
        WHERE "organizationId" IS NOT NULL AND "action" IN
            ('TEAM:COMMENT_CREATE', 'TEAM:COMMENT_REPLY', 'TEAM:COMMENT_EDIT', 'TEAM:COMMENT_DELETE', 'TEAM:COMMENT_RESOLVE')
          AND ("createdAt", "id") <= (state."throughCreatedAt", state."throughAuditId")
          AND (state."lastCreatedAt" IS NULL OR ("createdAt", "id") > (state."lastCreatedAt", state."lastAuditId"))
        ORDER BY "createdAt", "id" LIMIT batch_size
    LOOP
        seen := seen + 1;
        state."lastCreatedAt" := event."createdAt";
        state."lastAuditId" := event."id";
        details := data_explorer_comment_details(event."details");
        valid := jsonb_typeof(details) = 'object'
          AND COALESCE(details->>'storageVersion', '') <> '2'
          AND jsonb_typeof(details->'commentId') = 'string' AND length(details->>'commentId') > 0
          AND jsonb_typeof(details->'threadId') = 'string' AND length(details->>'threadId') > 0
          AND jsonb_typeof(details->'resourceId') = 'string' AND length(details->>'resourceId') > 0
          AND details->>'resourceType' IN ('CONNECTION', 'QUERY', 'DASHBOARD', 'ERD');
        IF event."action" IN ('TEAM:COMMENT_CREATE', 'TEAM:COMMENT_REPLY', 'TEAM:COMMENT_EDIT') THEN
            valid := valid AND jsonb_typeof(details->'body') = 'string';
        END IF;
        IF event."action" = 'TEAM:COMMENT_CREATE' THEN
            valid := valid AND details->>'threadId' = details->>'commentId'
              AND COALESCE(jsonb_typeof(details->'parentCommentId'), 'null') = 'null';
        ELSIF event."action" = 'TEAM:COMMENT_REPLY' THEN
            valid := valid AND jsonb_typeof(details->'parentCommentId') = 'string'
              AND length(details->>'parentCommentId') > 0;
        END IF;
        valid := valid AND COALESCE(jsonb_typeof(details->'mentions'), 'null') IN ('array', 'null')
          AND COALESCE(jsonb_typeof(details->'attachments'), 'null') IN ('array', 'null');
        mentions := CASE WHEN jsonb_typeof(details->'mentions') = 'array' THEN details->'mentions' ELSE '[]'::jsonb END;
        attachments := CASE WHEN jsonb_typeof(details->'attachments') = 'array' THEN details->'attachments' ELSE '[]'::jsonb END;
        valid := valid AND NOT EXISTS (SELECT FROM jsonb_array_elements(mentions) item WHERE jsonb_typeof(item) <> 'string')
          AND NOT EXISTS (SELECT FROM jsonb_array_elements(attachments) item WHERE jsonb_typeof(item) <> 'string'
            OR left(item #>> '{}', 5) <> 'data:'
            OR lower(item #>> '{}') !~ '^data:(image/(png|jpeg|gif|webp)|application/pdf|text/plain)[;,]')
          AND COALESCE((SELECT sum(length(item #>> '{}')) FROM jsonb_array_elements(attachments) item), 0) <= 2097152;
        IF valid IS NOT TRUE THEN
            batch_skipped := batch_skipped + 1;
            CONTINUE;
        END IF;
        resource_type := (details->>'resourceType')::"ResourceType";
        resource_id := details->>'resourceId';
        resource_exists := CASE resource_type
            WHEN 'CONNECTION' THEN EXISTS (SELECT FROM "Connection" WHERE "id" = resource_id AND "organizationId" = event."organizationId")
            WHEN 'QUERY' THEN EXISTS (SELECT FROM "SavedQuery" WHERE "id" = resource_id AND "organizationId" = event."organizationId")
            WHEN 'DASHBOARD' THEN EXISTS (SELECT FROM "Dashboard" WHERE "id" = resource_id AND "organizationId" = event."organizationId")
            WHEN 'ERD' THEN EXISTS (SELECT FROM "ErdWorkspace" WHERE "id" = resource_id AND "organizationId" = event."organizationId")
        END;
        IF NOT resource_exists THEN
            batch_skipped := batch_skipped + 1;
            CONTINUE;
        END IF;
        event_id := CASE WHEN event."action" IN ('TEAM:COMMENT_CREATE', 'TEAM:COMMENT_REPLY')
            THEN details->>'commentId' ELSE event."id" END;
        INSERT INTO "CommentEvent"("id", "legacyAuditId", "action", "commentId", "threadId", "resourceType", "resourceId",
            "details", "createdAt", "userId", "organizationId", "connectionId", "queryId", "dashboardId", "erdId")
        VALUES (event_id, event."id", event."action", details->>'commentId', details->>'threadId', resource_type, resource_id,
            (details || jsonb_build_object('mentions', mentions, 'attachments', attachments))::text,
            event."createdAt", event."userId", event."organizationId",
            CASE WHEN resource_type = 'CONNECTION' THEN resource_id END,
            CASE WHEN resource_type = 'QUERY' THEN resource_id END,
            CASE WHEN resource_type = 'DASHBOARD' THEN resource_id END,
            CASE WHEN resource_type = 'ERD' THEN resource_id END)
        ON CONFLICT DO NOTHING;
        GET DIAGNOSTICS inserted = ROW_COUNT;
        batch_copied := batch_copied + inserted;
        batch_skipped := batch_skipped + 1 - inserted;
    END LOOP;
    UPDATE "CommentBackfill" SET "lastCreatedAt" = state."lastCreatedAt", "lastAuditId" = state."lastAuditId",
        "examined" = "CommentBackfill"."examined" + seen, "copied" = "CommentBackfill"."copied" + batch_copied,
        "skipped" = "CommentBackfill"."skipped" + batch_skipped, "completed" = seen < batch_size, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = 'legacy-audit-v1' RETURNING * INTO state;
    RETURN QUERY SELECT state."examined", state."copied", state."skipped", state."completed";
END;
$$;

DO $$
DECLARE done BOOLEAN;
BEGIN
    LOOP
        SELECT completed INTO done FROM data_explorer_backfill_comment_events(500);
        EXIT WHEN done;
    END LOOP;
    -- Existing orphan reactions stay available for operator reconciliation, never silently deleted.
    IF NOT EXISTS (SELECT FROM "CommentReaction" r LEFT JOIN "CommentEvent" e ON e."id" = r."commentId" WHERE e."id" IS NULL) THEN
        ALTER TABLE "CommentReaction" VALIDATE CONSTRAINT "CommentReaction_commentId_fkey";
    END IF;
END;
$$;

COMMIT;

