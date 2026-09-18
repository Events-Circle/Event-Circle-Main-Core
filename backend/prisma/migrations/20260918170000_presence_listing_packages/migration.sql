ALTER TABLE "presence_content"
ADD COLUMN "priceUnit" TEXT,
ADD COLUMN "inclusions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "pricingNote" TEXT NOT NULL DEFAULT '';
ALTER TABLE "presence_content" ADD CONSTRAINT "presence_content_priceUnit_check"
CHECK ("priceUnit" IS NULL OR "priceUnit" IN ('EVENT', 'HOUR', 'PERSON', 'PACKAGE', 'ITEM', 'TOTAL'));
