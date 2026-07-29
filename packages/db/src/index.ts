import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "../generated/client/client";

export interface CompleteMissionInput {
  userId: string;
  missionId: string;
  idempotencyKey: string;
  now: Date;
}

export type RevertMissionInput = CompleteMissionInput;

export interface MissionMutationResult {
  applied: boolean;
  eventId: string | null;
  earnedXp: number;
}

export interface RecordMissionEncoreInput extends CompleteMissionInput {
  bonusXp: number;
  maxRewardedEncores: number;
  maxDailyEncores: number;
}

export interface MissionEncoreResult extends MissionMutationResult {
  encoreCount: number;
  totalSets: number;
}

export function createPrisma(db: D1Database): PrismaClient {
  return new PrismaClient({ adapter: new PrismaD1(db) });
}

function iso(date: Date): string {
  return date.toISOString();
}

export async function completeMissionAtomically(
  db: D1Database,
  input: CompleteMissionInput
): Promise<MissionMutationResult> {
  const prisma = createPrisma(db);
  const mission = await prisma.dailyMission.findFirst({
    where: { id: input.missionId, userId: input.userId },
    include: {
      habit: {
        include: {
          category: true
        }
      }
    }
  });

  if (!mission) throw new Error("MISSION_NOT_FOUND");
  if (mission.status === "COMPLETED") {
    const existing = await prisma.activityEvent.findFirst({
      where: {
        userId: input.userId,
        idempotencyKey: input.idempotencyKey
      },
      include: { xpEntries: true }
    });
    return {
      applied: false,
      eventId: existing?.id ?? null,
      earnedXp:
        existing?.xpEntries.reduce((total, entry) => total + entry.amount, 0) ??
        0
    };
  }

  const [previousActivity, existingResumeBonus] = await Promise.all([
    prisma.activityEvent.findFirst({
      where: {
        userId: input.userId,
        type: "COMPLETE",
        gameDate: { lt: mission.gameDate }
      },
      orderBy: [{ gameDate: "desc" }, { createdAt: "desc" }],
      select: { gameDate: true }
    }),
    prisma.xpLedger.findFirst({
      where: {
        userId: input.userId,
        gameDate: mission.gameDate,
        reason: "RESUME_BONUS"
      },
      select: { id: true }
    })
  ]);
  const inactiveDays = previousActivity
    ? Math.round(
        (Date.parse(`${mission.gameDate}T00:00:00.000Z`) -
          Date.parse(`${previousActivity.gameDate}T00:00:00.000Z`)) /
          86_400_000
      )
    : 0;
  const resumeBonus = inactiveDays >= 2 && !existingResumeBonus ? 5 : 0;
  const eventId = crypto.randomUUID();
  const ledgerId = crypto.randomUUID();
  const resumeLedgerId = crypto.randomUUID();
  const timestamp = iso(input.now);
  const statusKey = mission.habit.category.key;

  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO "ActivityEvent"
          ("id", "userId", "dailyMissionId", "type", "idempotencyKey", "gameDate", "createdAt")
         VALUES (?, ?, ?, 'COMPLETE', ?, ?, ?)
         ON CONFLICT("userId", "idempotencyKey") DO NOTHING`
      )
      .bind(
        eventId,
        input.userId,
        input.missionId,
        input.idempotencyKey,
        mission.gameDate,
        timestamp
      ),
    db
      .prepare(
        `UPDATE "DailyMission"
         SET "status" = 'COMPLETED', "completedAt" = ?
         WHERE "id" = ? AND "userId" = ? AND "status" = 'PENDING'
           AND EXISTS (SELECT 1 FROM "ActivityEvent" WHERE "id" = ?)`
      )
      .bind(timestamp, input.missionId, input.userId, eventId),
    db
      .prepare(
        `INSERT INTO "ProjectionApplication" ("eventId", "appliedAt")
         SELECT ?, ? WHERE changes() = 1`
      )
      .bind(eventId, timestamp),
    db
      .prepare(
        `INSERT INTO "XpLedger"
          ("id", "userId", "eventId", "amount", "reason", "statusKey", "gameDate", "createdAt")
         SELECT ?, ?, ?, ?, 'MISSION_COMPLETE', ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM "ProjectionApplication"
           WHERE "eventId" = ? AND "appliedAt" = ?
         )`
      )
      .bind(
        ledgerId,
        input.userId,
        eventId,
        mission.xpSnapshot,
        statusKey,
        mission.gameDate,
        timestamp,
        eventId,
        timestamp
      ),
    db
      .prepare(
        `UPDATE "UserProgress"
         SET "totalXp" = "totalXp" + ?, "updatedAt" = ?
         WHERE "userId" = ? AND EXISTS (
           SELECT 1 FROM "ProjectionApplication"
           WHERE "eventId" = ? AND "appliedAt" = ?
         )`
      )
      .bind(
        mission.xpSnapshot,
        timestamp,
        input.userId,
        eventId,
        timestamp
      ),
    db
      .prepare(
        `INSERT INTO "XpLedger"
          ("id", "userId", "eventId", "amount", "reason", "statusKey", "gameDate", "createdAt")
         SELECT ?, ?, ?, ?, 'RESUME_BONUS', 'resilience', ?, ?
         WHERE ? > 0
           AND EXISTS (
             SELECT 1 FROM "ProjectionApplication"
             WHERE "eventId" = ? AND "appliedAt" = ?
           )
           AND NOT EXISTS (
             SELECT 1 FROM "XpLedger"
             WHERE "userId" = ? AND "gameDate" = ? AND "reason" = 'RESUME_BONUS'
           )
         ON CONFLICT DO NOTHING`
      )
      .bind(
        resumeLedgerId,
        input.userId,
        eventId,
        resumeBonus,
        mission.gameDate,
        timestamp,
        resumeBonus,
        eventId,
        timestamp,
        input.userId,
        mission.gameDate
      ),
    db
      .prepare(
        `UPDATE "UserProgress"
         SET "totalXp" = "totalXp" + 5, "updatedAt" = ?
         WHERE "userId" = ? AND changes() = 1 AND EXISTS (
           SELECT 1 FROM "ProjectionApplication"
           WHERE "eventId" = ? AND "appliedAt" = ?
         )`
      )
      .bind(
        timestamp,
        input.userId,
        eventId,
        timestamp
      ),
    db
      .prepare(
        `INSERT INTO "StatusProgress" ("id", "userId", "statusKey", "xp", "updatedAt")
         SELECT ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM "ProjectionApplication"
           WHERE "eventId" = ? AND "appliedAt" = ?
         )
         ON CONFLICT("userId", "statusKey")
         DO UPDATE SET "xp" = "xp" + excluded."xp", "updatedAt" = excluded."updatedAt"`
      )
      .bind(
        crypto.randomUUID(),
        input.userId,
        statusKey,
        mission.xpSnapshot,
        timestamp,
        eventId,
        timestamp
      )
  ]);

  const applied = (results[1]?.meta.changes ?? 0) === 1;
  const resumeBonusApplied = (results[5]?.meta.changes ?? 0) === 1;
  return {
    applied,
    eventId: applied ? eventId : null,
    earnedXp:
      applied ? mission.xpSnapshot + (resumeBonusApplied ? 5 : 0) : 0
  };
}

export async function recordMissionEncoreAtomically(
  db: D1Database,
  input: RecordMissionEncoreInput
): Promise<MissionEncoreResult> {
  const prisma = createPrisma(db);
  const mission = await prisma.dailyMission.findFirst({
    where: { id: input.missionId, userId: input.userId },
    include: { habit: { include: { category: true } } }
  });
  if (!mission) throw new Error("MISSION_NOT_FOUND");
  if (mission.status !== "COMPLETED") {
    throw new Error("MISSION_NOT_COMPLETED");
  }

  const existing = await prisma.activityEvent.findFirst({
    where: {
      userId: input.userId,
      idempotencyKey: input.idempotencyKey
    },
    include: { xpEntries: true }
  });
  if (existing) {
    if (
      existing.dailyMissionId !== input.missionId ||
      existing.type !== "ENCORE"
    ) {
      throw new Error("IDEMPOTENCY_KEY_CONFLICT");
    }
    const encoreCount = await prisma.activityEvent.count({
      where: { dailyMissionId: input.missionId, type: "ENCORE" }
    });
    return {
      applied: false,
      eventId: existing.id,
      earnedXp: existing.xpEntries.reduce(
        (total, entry) => total + entry.amount,
        0
      ),
      encoreCount,
      totalSets: encoreCount + 1
    };
  }

  const currentEncoreCount = await prisma.activityEvent.count({
    where: { dailyMissionId: input.missionId, type: "ENCORE" }
  });
  if (currentEncoreCount >= input.maxDailyEncores) {
    throw new Error("ENCORE_LIMIT_REACHED");
  }

  const eventId = crypto.randomUUID();
  const ledgerId = crypto.randomUUID();
  const timestamp = iso(input.now);
  const statusKey = mission.habit.category.key;
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO "ActivityEvent"
          ("id", "userId", "dailyMissionId", "type", "idempotencyKey", "gameDate", "createdAt")
         SELECT ?, ?, ?, 'ENCORE', ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM "DailyMission"
           WHERE "id" = ? AND "userId" = ? AND "status" = 'COMPLETED'
         )
         AND (
           SELECT COUNT(*) FROM "ActivityEvent"
           WHERE "dailyMissionId" = ? AND "type" = 'ENCORE'
         ) < ?
         ON CONFLICT("userId", "idempotencyKey") DO NOTHING`
      )
      .bind(
        eventId,
        input.userId,
        input.missionId,
        input.idempotencyKey,
        mission.gameDate,
        timestamp,
        input.missionId,
        input.userId,
        input.missionId,
        input.maxDailyEncores
      ),
    db
      .prepare(
        `INSERT INTO "ProjectionApplication" ("eventId", "appliedAt")
         SELECT ?, ? WHERE changes() = 1`
      )
      .bind(eventId, timestamp),
    db
      .prepare(
        `INSERT INTO "XpLedger"
          ("id", "userId", "eventId", "amount", "reason", "statusKey", "gameDate", "createdAt")
         SELECT ?, ?, ?, ?, 'MISSION_ENCORE', ?, ?, ?
         WHERE ? > 0
           AND EXISTS (
             SELECT 1 FROM "ProjectionApplication" WHERE "eventId" = ?
           )
           AND (
             SELECT COUNT(*) FROM "ActivityEvent"
             WHERE "dailyMissionId" = ? AND "type" = 'ENCORE'
           ) <= ?`
      )
      .bind(
        ledgerId,
        input.userId,
        eventId,
        input.bonusXp,
        statusKey,
        mission.gameDate,
        timestamp,
        input.bonusXp,
        eventId,
        input.missionId,
        input.maxRewardedEncores
      ),
    db
      .prepare(
        `UPDATE "UserProgress"
         SET "totalXp" = "totalXp" + ?, "updatedAt" = ?
         WHERE "userId" = ?
           AND EXISTS (SELECT 1 FROM "XpLedger" WHERE "id" = ?)`
      )
      .bind(input.bonusXp, timestamp, input.userId, ledgerId),
    db
      .prepare(
        `INSERT INTO "StatusProgress" ("id", "userId", "statusKey", "xp", "updatedAt")
         SELECT ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM "XpLedger" WHERE "id" = ?)
         ON CONFLICT("userId", "statusKey")
         DO UPDATE SET "xp" = "xp" + excluded."xp", "updatedAt" = excluded."updatedAt"`
      )
      .bind(
        crypto.randomUUID(),
        input.userId,
        statusKey,
        input.bonusXp,
        timestamp,
        ledgerId
      )
  ]);

  const applied = (results[0]?.meta.changes ?? 0) === 1;
  const earnedXp = (results[2]?.meta.changes ?? 0) === 1 ? input.bonusXp : 0;
  const encoreCount = await prisma.activityEvent.count({
    where: { dailyMissionId: input.missionId, type: "ENCORE" }
  });
  if (!applied) {
    const racedEvent = await prisma.activityEvent.findFirst({
      where: {
        userId: input.userId,
        idempotencyKey: input.idempotencyKey,
        dailyMissionId: input.missionId,
        type: "ENCORE"
      },
      include: { xpEntries: true }
    });
    if (!racedEvent) throw new Error("ENCORE_LIMIT_REACHED");
    return {
      applied: false,
      eventId: racedEvent.id,
      earnedXp: racedEvent.xpEntries.reduce(
        (total, entry) => total + entry.amount,
        0
      ),
      encoreCount,
      totalSets: encoreCount + 1
    };
  }

  return {
    applied: true,
    eventId,
    earnedXp,
    encoreCount,
    totalSets: encoreCount + 1
  };
}

export async function revertMissionAtomically(
  db: D1Database,
  input: RevertMissionInput
): Promise<MissionMutationResult> {
  const prisma = createPrisma(db);
  const mission = await prisma.dailyMission.findFirst({
    where: { id: input.missionId, userId: input.userId },
    include: {
      habit: { include: { category: true } },
      events: {
        where: { type: "COMPLETE" },
        orderBy: { createdAt: "desc" },
        include: { xpEntries: true },
        take: 1
      }
    }
  });

  const originalEvent = mission?.events[0];
  const originalMissionXp = originalEvent?.xpEntries.find(
    (entry) => entry.reason === "MISSION_COMPLETE"
  )?.amount;
  const resumeBonusXp =
    originalEvent?.xpEntries.find((entry) => entry.reason === "RESUME_BONUS")
      ?.amount ?? 0;
  if (!mission || !originalEvent || originalMissionXp === undefined) {
    throw new Error("COMPLETION_NOT_FOUND");
  }
  const encoreCount = await prisma.activityEvent.count({
    where: { dailyMissionId: input.missionId, type: "ENCORE" }
  });
  if (encoreCount > 0) throw new Error("ENCORE_EXISTS");
  if (mission.status !== "COMPLETED") {
    return { applied: false, eventId: null, earnedXp: 0 };
  }

  const eventId = crypto.randomUUID();
  const ledgerId = crypto.randomUUID();
  const resumeLedgerId = crypto.randomUUID();
  const timestamp = iso(input.now);
  const statusKey = mission.habit.category.key;
  const totalOriginalXp = originalMissionXp + resumeBonusXp;

  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO "ActivityEvent"
          ("id", "userId", "dailyMissionId", "type", "idempotencyKey",
           "reversalOfEventId", "gameDate", "createdAt")
         VALUES (?, ?, ?, 'REVERT', ?, ?, ?, ?)
         ON CONFLICT("userId", "idempotencyKey") DO NOTHING`
      )
      .bind(
        eventId,
        input.userId,
        input.missionId,
        input.idempotencyKey,
        originalEvent.id,
        mission.gameDate,
        timestamp
      ),
    db
      .prepare(
        `UPDATE "DailyMission"
         SET "status" = 'PENDING', "completedAt" = NULL
         WHERE "id" = ? AND "userId" = ? AND "status" = 'COMPLETED'
           AND EXISTS (SELECT 1 FROM "ActivityEvent" WHERE "id" = ?)`
      )
      .bind(input.missionId, input.userId, eventId),
    db
      .prepare(
        `INSERT INTO "ProjectionApplication" ("eventId", "appliedAt")
         SELECT ?, ? WHERE changes() = 1`
      )
      .bind(eventId, timestamp),
    db
      .prepare(
        `INSERT INTO "XpLedger"
          ("id", "userId", "eventId", "amount", "reason", "statusKey", "gameDate", "createdAt")
         SELECT ?, ?, ?, ?, 'MISSION_REVERT', ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM "ProjectionApplication"
           WHERE "eventId" = ? AND "appliedAt" = ?
         )`
      )
      .bind(
        ledgerId,
        input.userId,
        eventId,
        -originalMissionXp,
        statusKey,
        mission.gameDate,
        timestamp,
        eventId,
        timestamp
      ),
    db
      .prepare(
        `INSERT INTO "XpLedger"
          ("id", "userId", "eventId", "amount", "reason", "statusKey", "gameDate", "createdAt")
         SELECT ?, ?, ?, ?, 'RESUME_BONUS_REVERT', 'resilience', ?, ?
         WHERE ? > 0 AND EXISTS (
           SELECT 1 FROM "ProjectionApplication"
           WHERE "eventId" = ? AND "appliedAt" = ?
         )`
      )
      .bind(
        resumeLedgerId,
        input.userId,
        eventId,
        -resumeBonusXp,
        mission.gameDate,
        timestamp,
        resumeBonusXp,
        eventId,
        timestamp
      ),
    db
      .prepare(
        `UPDATE "UserProgress"
         SET "totalXp" = MAX(0, "totalXp" - ?), "updatedAt" = ?
         WHERE "userId" = ? AND EXISTS (
           SELECT 1 FROM "ProjectionApplication"
           WHERE "eventId" = ? AND "appliedAt" = ?
         )`
      )
      .bind(totalOriginalXp, timestamp, input.userId, eventId, timestamp),
    db
      .prepare(
        `UPDATE "StatusProgress"
         SET "xp" = MAX(0, "xp" - ?), "updatedAt" = ?
         WHERE "userId" = ? AND "statusKey" = ? AND EXISTS (
           SELECT 1 FROM "ProjectionApplication"
           WHERE "eventId" = ? AND "appliedAt" = ?
         )`
      )
      .bind(
        originalMissionXp,
        timestamp,
        input.userId,
        statusKey,
        eventId,
        timestamp
      )
  ]);

  const applied = (results[1]?.meta.changes ?? 0) === 1;
  return {
    applied,
    eventId: applied ? eventId : null,
    earnedXp: applied ? -totalOriginalXp : 0
  };
}

export interface WishTransitionInput {
  userId: string;
  wishId: string;
  idempotencyKey: string;
  now: Date;
}

export interface WishTransitionResult {
  applied: boolean;
  eventId: string | null;
}

export async function unlockWishAtomically(
  db: D1Database,
  input: WishTransitionInput
): Promise<WishTransitionResult> {
  const eventId = crypto.randomUUID();
  const timestamp = iso(input.now);
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO "WishEvent"
          ("id", "userId", "wishId", "eventType", "idempotencyKey", "createdAt")
         SELECT ?, ?, ?, 'UNLOCK', ?, ?
         WHERE EXISTS (
           SELECT 1 FROM "Wish"
           WHERE "id" = ? AND "userId" = ? AND "status" = 'ACTIVE'
         )
         ON CONFLICT DO NOTHING`
      )
      .bind(
        eventId,
        input.userId,
        input.wishId,
        input.idempotencyKey,
        timestamp,
        input.wishId,
        input.userId
      ),
    db
      .prepare(
        `UPDATE "Wish"
         SET "status" = 'UNLOCKED', "unlockDate" = ?, "updatedAt" = ?
         WHERE "id" = ? AND "userId" = ? AND "status" = 'ACTIVE'
           AND EXISTS (SELECT 1 FROM "WishEvent" WHERE "id" = ?)`
      )
      .bind(
        timestamp,
        timestamp,
        input.wishId,
        input.userId,
        eventId
      ),
    db
      .prepare(
        `UPDATE "Reward"
         SET "unlockedAt" = ?, "updatedAt" = ?
         WHERE "wishId" = ?
           AND EXISTS (SELECT 1 FROM "WishEvent" WHERE "id" = ?)`
      )
      .bind(timestamp, timestamp, input.wishId, eventId)
  ]);

  const applied = (results[0]?.meta.changes ?? 0) === 1;
  return { applied, eventId: applied ? eventId : null };
}

export async function completeWishAtomically(
  db: D1Database,
  input: WishTransitionInput
): Promise<WishTransitionResult> {
  const eventId = crypto.randomUUID();
  const timestamp = iso(input.now);
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO "WishEvent"
          ("id", "userId", "wishId", "eventType", "idempotencyKey", "createdAt")
         SELECT ?, ?, ?, 'COMPLETE', ?, ?
         WHERE EXISTS (
           SELECT 1 FROM "Wish"
           WHERE "id" = ? AND "userId" = ? AND "status" = 'UNLOCKED'
         )
         ON CONFLICT DO NOTHING`
      )
      .bind(
        eventId,
        input.userId,
        input.wishId,
        input.idempotencyKey,
        timestamp,
        input.wishId,
        input.userId
      ),
    db
      .prepare(
        `UPDATE "Wish"
         SET "status" = 'COMPLETED', "completedAt" = ?, "updatedAt" = ?
         WHERE "id" = ? AND "userId" = ? AND "status" = 'UNLOCKED'
           AND EXISTS (SELECT 1 FROM "WishEvent" WHERE "id" = ?)`
      )
      .bind(
        timestamp,
        timestamp,
        input.wishId,
        input.userId,
        eventId
      ),
    db
      .prepare(
        `UPDATE "Reward"
         SET "completedAt" = ?, "updatedAt" = ?
         WHERE "wishId" = ?
           AND EXISTS (SELECT 1 FROM "WishEvent" WHERE "id" = ?)`
      )
      .bind(timestamp, timestamp, input.wishId, eventId)
  ]);

  const applied = (results[0]?.meta.changes ?? 0) === 1;
  return { applied, eventId: applied ? eventId : null };
}
