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
      earnedXp: existing?.xpEntries[0]?.amount ?? 0
    };
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
  return {
    applied,
    eventId: applied ? eventId : null,
    earnedXp: applied ? mission.xpSnapshot : 0
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
  const originalXp = originalEvent?.xpEntries[0]?.amount;
  if (!mission || !originalEvent || originalXp === undefined) {
    throw new Error("COMPLETION_NOT_FOUND");
  }
  if (mission.status !== "COMPLETED") {
    return { applied: false, eventId: null, earnedXp: 0 };
  }

  const eventId = crypto.randomUUID();
  const ledgerId = crypto.randomUUID();
  const timestamp = iso(input.now);
  const statusKey = mission.habit.category.key;

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
        -originalXp,
        statusKey,
        mission.gameDate,
        timestamp,
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
      .bind(originalXp, timestamp, input.userId, eventId, timestamp),
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
        originalXp,
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
    earnedXp: applied ? -originalXp : 0
  };
}
