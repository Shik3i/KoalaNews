CREATE TABLE "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT,
  "email" TEXT NOT NULL,
  "password" TEXT,
  "image" TEXT,
  "role" TEXT NOT NULL DEFAULT 'USER',
  "banned" BOOLEAN NOT NULL DEFAULT false,
  "bannedAt" DATETIME,
  "bannedReason" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Setting" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL
);

CREATE TABLE "SourceFeed" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "url" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "language" TEXT NOT NULL DEFAULT 'en',
  "lastFetchedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Feed" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "url" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "language" TEXT NOT NULL DEFAULT 'en',
  "userId" TEXT NOT NULL,
  "sourceFeedId" TEXT,
  "lastFetchedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Feed_sourceFeedId_fkey" FOREIGN KEY ("sourceFeedId") REFERENCES "SourceFeed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Article" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT,
  "link" TEXT,
  "description" TEXT,
  "content" TEXT,
  "imageUrl" TEXT,
  "pubDate" DATETIME,
  "guid" TEXT,
  "feedId" TEXT,
  "sourceFeedId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Article_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Article_sourceFeedId_fkey" FOREIGN KEY ("sourceFeedId") REFERENCES "SourceFeed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ArticleRead" (
  "userId" TEXT NOT NULL,
  "articleId" TEXT NOT NULL,
  "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ArticleRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ArticleRead_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY ("userId", "articleId")
);

CREATE TABLE "PasswordResetToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RateLimitEntry" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL,
  "resetAt" DATETIME NOT NULL
);

CREATE TABLE "UserPreference" (
  "userId" TEXT NOT NULL PRIMARY KEY,
  "theme" TEXT NOT NULL DEFAULT 'system',
  "design" TEXT NOT NULL DEFAULT 'clean',
  "cardStyle" TEXT NOT NULL DEFAULT 'magazine',
  "density" TEXT NOT NULL DEFAULT 'comfortable',
  "fontScale" TEXT NOT NULL DEFAULT 'medium',
  "accentColor" TEXT NOT NULL DEFAULT 'blue',
  "showImages" BOOLEAN NOT NULL DEFAULT true,
  "showSource" BOOLEAN NOT NULL DEFAULT true,
  "showDate" BOOLEAN NOT NULL DEFAULT true,
  "showDescription" BOOLEAN NOT NULL DEFAULT true,
  "showReadMore" BOOLEAN NOT NULL DEFAULT true,
  "descriptionLines" INTEGER NOT NULL DEFAULT 2,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ImageCache" (
  "sourceUrl" TEXT NOT NULL PRIMARY KEY,
  "contentType" TEXT NOT NULL,
  "data" BLOB NOT NULL,
  "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "SourceFeed_url_key" ON "SourceFeed"("url");
CREATE INDEX "Feed_userId_idx" ON "Feed"("userId");
CREATE INDEX "Feed_userId_createdAt_idx" ON "Feed"("userId", "createdAt");
CREATE INDEX "Feed_language_idx" ON "Feed"("language");
CREATE INDEX "Feed_sourceFeedId_idx" ON "Feed"("sourceFeedId");
CREATE UNIQUE INDEX "Feed_userId_url_key" ON "Feed"("userId", "url");
CREATE INDEX "SourceFeed_language_idx" ON "SourceFeed"("language");
CREATE UNIQUE INDEX "Article_feedId_guid_key" ON "Article"("feedId", "guid");
CREATE UNIQUE INDEX "Article_sourceFeedId_guid_key" ON "Article"("sourceFeedId", "guid");
CREATE INDEX "Article_pubDate_idx" ON "Article"("pubDate");
CREATE INDEX "Article_createdAt_idx" ON "Article"("createdAt");
CREATE INDEX "Article_feedId_idx" ON "Article"("feedId");
CREATE INDEX "Article_feedId_pubDate_idx" ON "Article"("feedId", "pubDate");
CREATE INDEX "Article_sourceFeedId_idx" ON "Article"("sourceFeedId");
CREATE INDEX "Article_sourceFeedId_pubDate_idx" ON "Article"("sourceFeedId", "pubDate");
CREATE INDEX "ArticleRead_articleId_idx" ON "ArticleRead"("articleId");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");
CREATE INDEX "ImageCache_fetchedAt_idx" ON "ImageCache"("fetchedAt");
