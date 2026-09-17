BEGIN;
-- CreateEnum
CREATE TYPE "CatalogKind" AS ENUM ('CATEGORY', 'LOCATION');

-- CreateEnum
CREATE TYPE "PresenceContentKind" AS ENUM ('PORTFOLIO', 'LISTING', 'GALLERY');

-- CreateEnum
CREATE TYPE "PresenceContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PresenceListingType" AS ENUM ('SERVICE', 'PRODUCT', 'PACKAGE', 'OFFER');

-- CreateEnum
CREATE TYPE "PresencePricingMode" AS ENUM ('FIXED', 'FROM', 'ON_REQUEST', 'FREE');

-- AlterTable
ALTER TABLE "presence_profiles" ADD COLUMN     "accentColor" TEXT NOT NULL DEFAULT '#2563eb',
ADD COLUMN     "coverMediaId" UUID,
ADD COLUMN     "logoMediaId" UUID,
ADD COLUMN     "openingHours" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "sections" TEXT[] DEFAULT ARRAY['portfolio', 'listings', 'gallery']::TEXT[],
ADD COLUMN     "seoDescription" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "seoTitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "socialLinks" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "tagline" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "core_catalogs" (
    "id" UUID NOT NULL,
    "kind" "CatalogKind" NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "core_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "core_media" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/webp',
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "bytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "core_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presence_content" (
    "id" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "kind" "PresenceContentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "categoryId" UUID,
    "locationId" UUID,
    "occurredAt" TIMESTAMP(3),
    "type" "PresenceListingType",
    "pricingMode" "PresencePricingMode",
    "amountMinor" INTEGER,
    "currency" TEXT,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "serviceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availabilityNote" TEXT NOT NULL DEFAULT '',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "status" "PresenceContentStatus" NOT NULL DEFAULT 'DRAFT',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "presence_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "presence_content_media" (
    "id" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "altText" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL,

    CONSTRAINT "presence_content_media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "core_catalogs_kind_label_key" ON "core_catalogs"("kind", "label");

-- CreateIndex
CREATE UNIQUE INDEX "core_media_objectKey_key" ON "core_media"("objectKey");

-- CreateIndex
CREATE INDEX "core_media_organizationId_createdAt_idx" ON "core_media"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "presence_content_supplierId_kind_status_displayOrder_id_idx" ON "presence_content"("supplierId", "kind", "status", "displayOrder", "id");

-- CreateIndex
CREATE UNIQUE INDEX "presence_content_media_contentId_mediaId_key" ON "presence_content_media"("contentId", "mediaId");

-- AddForeignKey
ALTER TABLE "presence_profiles" ADD CONSTRAINT "presence_profiles_logoMediaId_fkey" FOREIGN KEY ("logoMediaId") REFERENCES "core_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_profiles" ADD CONSTRAINT "presence_profiles_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "core_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "core_media" ADD CONSTRAINT "core_media_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "core_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_content" ADD CONSTRAINT "presence_content_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "core_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_content" ADD CONSTRAINT "presence_content_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "core_catalogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_content" ADD CONSTRAINT "presence_content_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "core_catalogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_content_media" ADD CONSTRAINT "presence_content_media_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "presence_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "presence_content_media" ADD CONSTRAINT "presence_content_media_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "core_media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Preserve legacy publication; stricter readiness applies to subsequent publication writes.
UPDATE presence_profiles SET "publishedAt"="updatedAt" WHERE published=true;
ALTER TABLE core_media ADD CONSTRAINT media_dimensions CHECK (width > 0 AND height > 0 AND bytes > 0);
ALTER TABLE presence_content ADD CONSTRAINT presence_offer_window CHECK ("validFrom" IS NULL OR "validUntil" IS NULL OR "validUntil" > "validFrom");
ALTER TABLE presence_content ADD CONSTRAINT presence_listing_shape CHECK (
  (kind = 'LISTING' AND type IS NOT NULL AND "pricingMode" IS NOT NULL) OR
  (kind <> 'LISTING' AND type IS NULL AND "pricingMode" IS NULL AND "amountMinor" IS NULL AND currency IS NULL AND "validFrom" IS NULL AND "validUntil" IS NULL)
);
ALTER TABLE presence_content ADD CONSTRAINT presence_price CHECK (
  "pricingMode" IS NULL OR
  ("pricingMode" IN ('FREE','ON_REQUEST') AND "amountMinor" IS NULL AND currency IS NULL) OR
  ("pricingMode" IN ('FIXED','FROM') AND "amountMinor" IS NOT NULL AND "amountMinor" > 0 AND currency IS NOT NULL)
);
ALTER TABLE presence_content_media ADD CONSTRAINT presence_media_role CHECK (role IN ('COVER','GALLERY'));
CREATE UNIQUE INDEX presence_one_cover ON presence_content_media("contentId") WHERE role='COVER';
-- Small initial catalog, not an exhaustive geography/taxonomy. Existing supplier labels stay untouched.
INSERT INTO core_catalogs(id,kind,label) VALUES
 ('20000000-0000-4000-8000-000000000001','CATEGORY','Photography'),
 ('20000000-0000-4000-8000-000000000002','CATEGORY','Venue'),
 ('20000000-0000-4000-8000-000000000003','CATEGORY','Catering'),
 ('20000000-0000-4000-8000-000000000004','CATEGORY','Event Planning'),
 ('20000000-0000-4000-8000-000000000005','CATEGORY','Entertainment'),
 ('20000000-0000-4000-8000-000000000006','CATEGORY','Flowers and Decor'),
 ('20000000-0000-4000-8000-000000000007','CATEGORY','Other'),
 ('20000000-0000-4000-8000-000000000101','LOCATION','Beirut');
ALTER TABLE core_suppliers ADD COLUMN "categoryId" UUID REFERENCES core_catalogs(id) ON DELETE RESTRICT, ADD COLUMN "locationId" UUID REFERENCES core_catalogs(id) ON DELETE RESTRICT;
UPDATE core_suppliers s SET "categoryId"=c.id FROM core_catalogs c WHERE c.kind='CATEGORY' AND lower(s.category)=lower(c.label);
UPDATE core_suppliers s SET "locationId"=c.id FROM core_catalogs c WHERE c.kind='LOCATION' AND lower(s.city)=lower(c.label);
ALTER TABLE core_suppliers ADD COLUMN "contactEmail" TEXT, ADD COLUMN "contactPhone" TEXT;
ALTER TABLE presence_profiles ADD COLUMN "showEmail" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "showPhone" BOOLEAN NOT NULL DEFAULT false;
COMMIT;
