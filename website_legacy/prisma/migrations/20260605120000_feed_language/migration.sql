ALTER TABLE "Feed" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "SourceFeed" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';

CREATE INDEX "Feed_language_idx" ON "Feed"("language");
CREATE INDEX "SourceFeed_language_idx" ON "SourceFeed"("language");
