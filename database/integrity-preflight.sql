-- Read-only counts. Run against a backup/staging copy before applying the integrity migration.
-- Every result should be zero. Investigate ownership from verified source records;
-- do not guess a tenant, invent consent evidence, or delete records to make this pass.
SELECT count(*) AS orphan_presence_profiles
FROM presence_profiles p LEFT JOIN core_suppliers s ON s.id = p."supplierId"
WHERE s.id IS NULL;
SELECT count(*) AS orphan_or_mismatched_leads
FROM lead_opportunities l LEFT JOIN core_suppliers s
  ON s.id = l."supplierId" AND s."organizationId" = l."organizationId"
WHERE s.id IS NULL;
-- Historical input quality is reported, not rewritten by the migration.
SELECT count(*) AS blank_supplier_identity FROM core_suppliers
WHERE btrim("businessName") = '' OR btrim(category) = '' OR btrim(city) = '';
SELECT count(*) AS blank_lead_fields FROM lead_opportunities
WHERE btrim(name) = '' OR btrim(message) = '' OR btrim("contactConsentVersion") = '';
