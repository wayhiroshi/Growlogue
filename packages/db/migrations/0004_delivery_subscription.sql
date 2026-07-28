ALTER TABLE "NotificationDelivery" ADD COLUMN "subscriptionId" TEXT
    REFERENCES "PushSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP INDEX "NotificationDelivery_dedupe_key";

CREATE UNIQUE INDEX "NotificationDelivery_dedupe_key" ON "NotificationDelivery"(
    "userId",
    COALESCE("subscriptionId", ''),
    "triggerType",
    "gameDate",
    COALESCE("habitId", '')
);
CREATE INDEX "NotificationDelivery_subscriptionId_idx" ON "NotificationDelivery"("subscriptionId");
