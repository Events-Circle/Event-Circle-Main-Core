CREATE TABLE "circle_ai_plans" (
 "id" UUID NOT NULL PRIMARY KEY, "organizationId" UUID NOT NULL REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "actorId" UUID NOT NULL REFERENCES "core_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE, "requestId" UUID NOT NULL,
 "kind" TEXT NOT NULL CHECK ("kind" IN ('GROW_LEADS','PLAN_WEEK','REPLY_LEADS','CREATE_POST','PROMOTE_LISTING','GENERAL')),
 "prompt" TEXT NOT NULL, "title" TEXT NOT NULL, "response" TEXT NOT NULL, "draft" TEXT NOT NULL, "blockedReason" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT','APPROVED','REJECTED')),
 "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "circle_ai_plans_organizationId_requestId_key" ON "circle_ai_plans"("organizationId", "requestId");
CREATE INDEX "circle_ai_plans_organizationId_createdAt_id_idx" ON "circle_ai_plans"("organizationId", "createdAt", "id");
ALTER TABLE "circle_ai_plans" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "circle_ai_plans" FROM PUBLIC;
DO $$ DECLARE r TEXT; BEGIN FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('REVOKE ALL ON circle_ai_plans FROM %I', r); END IF;
END LOOP; END $$;
