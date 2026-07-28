-- CreateTable
CREATE TABLE "DailyMode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "gameDate" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyMode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ExtendTable
ALTER TABLE "PushSubscription" ADD COLUMN "expiresAt" DATETIME;
ALTER TABLE "PushSubscription" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "PushSubscription" ADD COLUMN "disabledAt" DATETIME;

-- RebuildTable
CREATE TABLE "NotificationDelivery_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "gameDate" TEXT NOT NULL,
    "habitId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "responseStatus" INTEGER,
    "errorCode" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptedAt" DATETIME,
    "deliveredAt" DATETIME,
    CONSTRAINT "NotificationDelivery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "NotificationDelivery_new" (
    "id",
    "userId",
    "triggerType",
    "gameDate",
    "habitId",
    "status",
    "attemptCount",
    "createdAt",
    "attemptedAt",
    "deliveredAt"
)
SELECT
    "id",
    "userId",
    "triggerType",
    "gameDate",
    "habitId",
    'SENT',
    1,
    "deliveredAt",
    "deliveredAt",
    "deliveredAt"
FROM "NotificationDelivery";

DROP TABLE "NotificationDelivery";
ALTER TABLE "NotificationDelivery_new" RENAME TO "NotificationDelivery";

-- CreateIndex
CREATE UNIQUE INDEX "DailyMode_userId_gameDate_key" ON "DailyMode"("userId", "gameDate");
CREATE INDEX "DailyMode_gameDate_mode_idx" ON "DailyMode"("gameDate", "mode");
CREATE INDEX "PushSubscription_userId_disabledAt_idx" ON "PushSubscription"("userId", "disabledAt");
CREATE INDEX "NotificationDelivery_userId_gameDate_status_idx" ON "NotificationDelivery"("userId", "gameDate", "status");
CREATE UNIQUE INDEX "NotificationDelivery_dedupe_key" ON "NotificationDelivery"(
    "userId",
    "triggerType",
    "gameDate",
    COALESCE("habitId", '')
);
