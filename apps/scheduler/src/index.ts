import {
  buildPushPayload,
  type PushSubscription
} from "@block65/webcrypto-web-push";
import { butlerNotificationTemplates } from "@growlogue/content";
import {
  getGameDate,
  getLocalMinute,
  maxNotificationsForLevel,
  selectNotificationTrigger,
  type DayMode,
  type NotificationLevel
} from "@growlogue/domain";

interface SubscriptionRow {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
  resetHour: number;
  notificationLevel: string;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface UserState {
  coreCompleted: number;
  totalCompleted: number;
  totalMissions: number;
  inactiveDays: number;
  dayMode: DayMode;
  deliveredTriggerCount: number;
}

function asNotificationLevel(value: string): NotificationLevel {
  if (value === "QUIET" || value === "STANDARD") return value;
  return "ACTIVE";
}

function asDayMode(value: string | null | undefined): DayMode {
  if (
    value === "HOLIDAY" ||
    value === "SICK" ||
    value === "BUSY" ||
    value === "REST"
  ) {
    return value;
  }
  return "NORMAL";
}

function dateDistanceInDays(from: string, to: string): number {
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${to}T00:00:00.000Z`) -
        Date.parse(`${from}T00:00:00.000Z`)) /
        86_400_000
    )
  );
}

async function loadSubscriptions(
  env: CloudflareEnv,
  now: Date
): Promise<SubscriptionRow[]> {
  const result = await env.DB.prepare(
    `SELECT
       ps."id",
       ps."userId",
       ps."endpoint",
       ps."p256dh",
       ps."auth",
       p."timezone",
       p."resetHour",
       p."notificationLevel",
       p."quietHoursStart",
       p."quietHoursEnd"
     FROM "PushSubscription" ps
     JOIN "Profile" p ON p."userId" = ps."userId"
     WHERE ps."disabledAt" IS NULL
       AND (ps."expiresAt" IS NULL OR ps."expiresAt" > ?)
     ORDER BY ps."userId", ps."createdAt"`
  )
    .bind(now.toISOString())
    .all<SubscriptionRow>();
  return result.results;
}

async function loadUserState(
  env: CloudflareEnv,
  userId: string,
  gameDate: string
): Promise<UserState> {
  const [missions, habits, lastActivity, dailyMode, deliveries] =
    await Promise.all([
      env.DB.prepare(
        `SELECT
           COUNT(*) AS "totalMissions",
           SUM(CASE WHEN "status" = 'COMPLETED' THEN 1 ELSE 0 END) AS "totalCompleted",
           SUM(CASE WHEN "role" = 'CORE' AND "status" = 'COMPLETED' THEN 1 ELSE 0 END) AS "coreCompleted"
         FROM "DailyMission"
         WHERE "userId" = ? AND "gameDate" = ?`
      )
        .bind(userId, gameDate)
        .first<{
          totalMissions: number;
          totalCompleted: number | null;
          coreCompleted: number | null;
        }>(),
      env.DB.prepare(
        `SELECT COUNT(*) AS "activeHabits"
         FROM "Habit"
         WHERE "userId" = ? AND "isActive" = 1`
      )
        .bind(userId)
        .first<{ activeHabits: number }>(),
      env.DB.prepare(
        `SELECT "gameDate"
         FROM "ActivityEvent"
         WHERE "userId" = ? AND "type" = 'COMPLETE'
         ORDER BY "createdAt" DESC
         LIMIT 1`
      )
        .bind(userId)
        .first<{ gameDate: string }>(),
      env.DB.prepare(
        `SELECT "mode"
         FROM "DailyMode"
         WHERE "userId" = ? AND "gameDate" = ?`
      )
        .bind(userId, gameDate)
        .first<{ mode: string }>(),
      env.DB.prepare(
        `SELECT COUNT(DISTINCT "triggerType") AS "triggerCount"
         FROM "NotificationDelivery"
         WHERE "userId" = ? AND "gameDate" = ?
           AND "status" = 'SENT'`
      )
        .bind(userId, gameDate)
        .first<{ triggerCount: number }>()
    ]);

  const generatedMissions = missions?.totalMissions ?? 0;
  return {
    coreCompleted: missions?.coreCompleted ?? 0,
    totalCompleted: missions?.totalCompleted ?? 0,
    totalMissions:
      generatedMissions > 0
        ? generatedMissions
        : Math.min(5, habits?.activeHabits ?? 0),
    inactiveDays: lastActivity
      ? dateDistanceInDays(lastActivity.gameDate, gameDate)
      : 0,
    dayMode: asDayMode(dailyMode?.mode),
    deliveredTriggerCount: deliveries?.triggerCount ?? 0
  };
}

async function markDelivery(
  env: CloudflareEnv,
  deliveryId: string,
  status: "SENT" | "FAILED",
  responseStatus: number | null,
  errorCode: string | null,
  now: Date
): Promise<void> {
  await env.DB.prepare(
    `UPDATE "NotificationDelivery"
     SET "status" = ?,
         "responseStatus" = ?,
         "errorCode" = ?,
         "attemptedAt" = ?,
         "deliveredAt" = CASE WHEN ? = 'SENT' THEN ? ELSE NULL END
     WHERE "id" = ?`
  )
    .bind(
      status,
      responseStatus,
      errorCode,
      now.toISOString(),
      status,
      now.toISOString(),
      deliveryId
    )
    .run();
}

async function deliverToSubscription(
  env: CloudflareEnv,
  subscription: SubscriptionRow,
  trigger: keyof typeof butlerNotificationTemplates,
  gameDate: string,
  now: Date
): Promise<"sent" | "skipped" | "failed"> {
  const deliveryId = crypto.randomUUID();
  const staleBefore = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const claim = await env.DB.prepare(
    `INSERT INTO "NotificationDelivery" (
       "id",
       "userId",
       "subscriptionId",
       "triggerType",
       "gameDate",
       "status",
       "attemptCount",
       "createdAt"
     )
     VALUES (?, ?, ?, ?, ?, 'PENDING', 1, ?)
     ON CONFLICT DO UPDATE SET
       "status" = 'PENDING',
       "attemptCount" = "NotificationDelivery"."attemptCount" + 1,
       "responseStatus" = NULL,
       "errorCode" = NULL,
       "createdAt" = excluded."createdAt",
       "attemptedAt" = NULL,
       "deliveredAt" = NULL
     WHERE (
       "NotificationDelivery"."status" = 'FAILED'
       AND "NotificationDelivery"."attemptCount" < 3
     ) OR (
       "NotificationDelivery"."status" = 'PENDING'
       AND "NotificationDelivery"."createdAt" < ?
       AND "NotificationDelivery"."attemptCount" < 3
     )`
  )
    .bind(
      deliveryId,
      subscription.userId,
      subscription.id,
      trigger,
      gameDate,
      now.toISOString(),
      staleBefore
    )
    .run();

  if ((claim.meta.changes ?? 0) !== 1) return "skipped";

  try {
    const template = butlerNotificationTemplates[trigger];
    const pushSubscription: PushSubscription = {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth
      }
    };
    const payload = await buildPushPayload(
      {
        data: {
          title: template.title,
          body: template.body,
          url: "/home",
          tag: `growlogue-${trigger.toLowerCase()}-${gameDate}`
        },
        options: {
          ttl: 15 * 60,
          urgency: trigger === "LAST_CALL" ? "high" : "normal",
          topic: `growlogue-${trigger.toLowerCase()}`
        }
      },
      pushSubscription,
      {
        publicKey: env.VAPID_PUBLIC_KEY,
        privateKey: env.VAPID_PRIVATE_KEY,
        subject: env.VAPID_SUBJECT
      }
    );
    const requestBody = new Uint8Array(payload.body.byteLength);
    requestBody.set(payload.body);
    const headers = new Headers();
    for (const [name, value] of Object.entries(payload.headers)) {
      if (value !== undefined) headers.set(name, value);
    }
    const response = await fetch(subscription.endpoint, {
      method: payload.method,
      headers,
      body: requestBody.buffer
    });
    await response.body?.cancel();

    if (response.ok) {
      await markDelivery(env, deliveryId, "SENT", response.status, null, now);
      return "sent";
    }

    if (response.status === 404 || response.status === 410) {
      await env.DB.prepare(
        `UPDATE "PushSubscription"
         SET "disabledAt" = ?, "updatedAt" = ?
         WHERE "id" = ?`
      )
        .bind(now.toISOString(), now.toISOString(), subscription.id)
        .run();
    }
    await markDelivery(
      env,
      deliveryId,
      "FAILED",
      response.status,
      response.status === 404 || response.status === 410
        ? "SUBSCRIPTION_EXPIRED"
        : "PUSH_REJECTED",
      now
    );
    return "failed";
  } catch {
    await markDelivery(
      env,
      deliveryId,
      "FAILED",
      null,
      "PUSH_REQUEST_FAILED",
      now
    );
    return "failed";
  }
}

export async function runNotificationCycle(
  env: CloudflareEnv,
  scheduledTime: number
): Promise<void> {
  const now = new Date(scheduledTime);
  const subscriptions = await loadSubscriptions(env, now);
  const grouped = new Map<string, SubscriptionRow[]>();
  for (const subscription of subscriptions) {
    const group = grouped.get(subscription.userId) ?? [];
    group.push(subscription);
    grouped.set(subscription.userId, group);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const userSubscriptions of grouped.values()) {
    const profile = userSubscriptions[0];
    if (!profile) continue;
    const gameDate = getGameDate(now, profile.timezone, profile.resetHour);
    const localMinute = getLocalMinute(now, profile.timezone);
    const state = await loadUserState(env, profile.userId, gameDate);
    const notificationLevel = asNotificationLevel(profile.notificationLevel);
    if (
      state.deliveredTriggerCount >=
      maxNotificationsForLevel(notificationLevel)
    ) {
      skipped += userSubscriptions.length;
      continue;
    }

    const trigger = selectNotificationTrigger({
      localMinute,
      quietHoursStart: profile.quietHoursStart,
      quietHoursEnd: profile.quietHoursEnd,
      notificationLevel,
      dayMode: state.dayMode,
      coreCompleted: state.coreCompleted,
      totalCompleted: state.totalCompleted,
      totalMissions: state.totalMissions,
      inactiveDays: state.inactiveDays
    });
    if (!trigger) {
      skipped += userSubscriptions.length;
      continue;
    }

    for (const subscription of userSubscriptions) {
      const result = await deliverToSubscription(
        env,
        subscription,
        trigger,
        gameDate,
        now
      );
      if (result === "sent") sent += 1;
      else if (result === "failed") failed += 1;
      else skipped += 1;
    }
  }

  console.log(
    JSON.stringify({
      message: "notification_cycle_completed",
      scheduledTime,
      users: grouped.size,
      subscriptions: subscriptions.length,
      sent,
      skipped,
      failed
    })
  );
}

export default {
  async fetch(): Promise<Response> {
    return Response.json({
      service: "growlogue-scheduler",
      status: "ok",
      phase: "notification-delivery-enabled"
    });
  },
  async scheduled(controller, env, ctx): Promise<void> {
    ctx.waitUntil(runNotificationCycle(env, controller.scheduledTime));
  }
} satisfies ExportedHandler<CloudflareEnv>;
