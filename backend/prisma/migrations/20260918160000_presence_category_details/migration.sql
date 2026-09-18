ALTER TABLE "presence_profiles" ADD COLUMN "categoryDetails" JSONB NOT NULL DEFAULT '{"type":"GENERAL","values":{}}';
