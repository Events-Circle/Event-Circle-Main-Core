-- Fail on orphan/mismatched existing records instead of deleting or rewriting customer data.
-- RESTRICT preserves module data until an explicit retention/deletion workflow is approved.
BEGIN;
CREATE UNIQUE INDEX "core_suppliers_id_organizationId_key" ON "core_suppliers"("id", "organizationId");
ALTER TABLE "presence_profiles" ADD CONSTRAINT "presence_profiles_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "core_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_opportunities" ADD CONSTRAINT "lead_opportunities_supplierId_organizationId_fkey"
  FOREIGN KEY ("supplierId", "organizationId") REFERENCES "core_suppliers"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "core_audit_logs" ADD COLUMN "correlationId" TEXT;
COMMIT;
