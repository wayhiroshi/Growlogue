import {
  britishGentlemanWorld,
  butlerMessages,
  categories,
  habitTemplates,
  type ButlerMood
} from "@growlogue/content";
import {
  completeMissionAtomically,
  revertMissionAtomically
} from "@growlogue/db";
import {
  evaluateDailyProgress,
  getGameDate,
  levelFromXp,
  selectDailyMissions
} from "@growlogue/domain";
import { getRuntime } from "./runtime";

export async function ensureUserFoundation(userId: string) {
  const { prisma } = getRuntime();

  await prisma.world.upsert({
    where: { id: britishGentlemanWorld.id },
    update: {
      name: britishGentlemanWorld.name,
      description: britishGentlemanWorld.description,
      xpLabel: britishGentlemanWorld.xpLabel
    },
    create: {
      id: britishGentlemanWorld.id,
      slug: britishGentlemanWorld.slug,
      name: britishGentlemanWorld.name,
      description: britishGentlemanWorld.description,
      xpLabel: britishGentlemanWorld.xpLabel
    }
  });
  await prisma.character.upsert({
    where: { id: britishGentlemanWorld.character.id },
    update: {
      name: britishGentlemanWorld.character.name,
      personality: britishGentlemanWorld.character.personality
    },
    create: {
      id: britishGentlemanWorld.character.id,
      worldId: britishGentlemanWorld.id,
      name: britishGentlemanWorld.character.name,
      personality: britishGentlemanWorld.character.personality
    }
  });
  for (const category of categories) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: {
        key: category.key,
        name: category.name,
        statusName: category.statusName,
        icon: category.icon
      },
      create: category
    });
  }

  const profile = await prisma.profile.upsert({
    where: { userId },
    update: {},
    create: {
      id: crypto.randomUUID(),
      userId,
      timezone: "Asia/Tokyo",
      resetHour: 4,
      activeWorldId: britishGentlemanWorld.id
    }
  });
  await prisma.userProgress.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });
  await prisma.streak.upsert({
    where: { userId },
    update: {},
    create: { userId }
  });
  await prisma.characterState.upsert({
    where: { userId },
    update: {},
    create: {
      id: crypto.randomUUID(),
      userId,
      characterId: britishGentlemanWorld.character.id
    }
  });
  return profile;
}

export async function completeOnboarding(
  userId: string,
  templateIds: readonly string[]
) {
  if (templateIds.length < 3) {
    throw new Error("AT_LEAST_THREE_HABITS_REQUIRED");
  }
  const { prisma } = getRuntime();
  await ensureUserFoundation(userId);

  const selected = habitTemplates.filter((template) =>
    templateIds.includes(template.id)
  );
  for (const template of selected) {
    const habitId = `${userId}:${template.id}`;
    await prisma.habit.upsert({
      where: { id: habitId },
      update: { isActive: true },
      create: {
        id: habitId,
        userId,
        categoryId: template.categoryId,
        title: template.title,
        worldTitle: template.worldTitle,
        minimumRule: template.minimumRule,
        baseXp: template.baseXp,
        preferredOrder: template.preferredOrder,
        statusWeights: {
          create: {
            id: crypto.randomUUID(),
            statusKey:
              categories.find((category) => category.id === template.categoryId)
                ?.key ?? "growth",
            weight: 1
          }
        }
      }
    });
  }
  await prisma.profile.update({
    where: { userId },
    data: {
      onboardingDone: true,
      activeWorldId: britishGentlemanWorld.id
    }
  });
}

export async function ensureTodayMissions(userId: string, now = new Date()) {
  const { prisma } = getRuntime();
  const profile = await ensureUserFoundation(userId);
  const gameDate = getGameDate(now, profile.timezone, profile.resetHour);
  const existing = await prisma.dailyMission.findMany({
    where: { userId, gameDate },
    include: { habit: { include: { category: true } } },
    orderBy: { position: "asc" }
  });
  if (existing.length > 0) return { gameDate, missions: existing };

  const habits = await prisma.habit.findMany({
    where: { userId, isActive: true },
    include: { category: true }
  });
  const selected = selectDailyMissions(
    habits.map((habit) => ({
      id: habit.id,
      categoryKey: habit.category.key,
      preferredOrder: habit.preferredOrder,
      isActive: habit.isActive
    })),
    gameDate
  );

  for (const mission of selected) {
    const habit = habits.find((item) => item.id === mission.id);
    if (!habit) continue;
    await prisma.dailyMission.upsert({
      where: {
        userId_gameDate_habitId: {
          userId,
          gameDate,
          habitId: habit.id
        }
      },
      update: {},
      create: {
        id: crypto.randomUUID(),
        userId,
        habitId: habit.id,
        gameDate,
        role: mission.role,
        position: mission.position,
        xpSnapshot: habit.baseXp
      }
    });
  }

  return {
    gameDate,
    missions: await prisma.dailyMission.findMany({
      where: { userId, gameDate },
      include: { habit: { include: { category: true } } },
      orderBy: { position: "asc" }
    })
  };
}

async function recomputeProjections(userId: string) {
  const { prisma } = getRuntime();
  const missions = await prisma.dailyMission.findMany({
    where: { userId },
    orderBy: [{ gameDate: "asc" }, { position: "asc" }]
  });
  const grouped = new Map<string, typeof missions>();
  for (const mission of missions) {
    const group = grouped.get(mission.gameDate) ?? [];
    group.push(mission);
    grouped.set(mission.gameDate, group);
  }

  const clearDates: string[] = [];
  let perfectCount = 0;
  for (const [date, dayMissions] of grouped) {
    const result = evaluateDailyProgress(
      dayMissions.map((mission) => ({
        role: mission.role === "CORE" ? "CORE" : "BONUS",
        status: mission.status === "COMPLETED" ? "COMPLETED" : "PENDING"
      }))
    );
    if (result.isDailyClear) clearDates.push(date);
    if (result.isPerfect) perfectCount += 1;
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const date of clearDates) {
    const distance = previous
      ? Math.round(
          (Date.parse(`${date}T00:00:00Z`) -
            Date.parse(`${previous}T00:00:00Z`)) /
            86_400_000
        )
      : 0;
    run = previous && distance === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  await prisma.userProgress.update({
    where: { userId },
    data: {
      dailyClearCount: clearDates.length,
      perfectCount
    }
  });
  await prisma.streak.update({
    where: { userId },
    data: {
      currentDays: run,
      longestDays: longest,
      lastClearGameDate: clearDates.at(-1) ?? null
    }
  });
}

export async function mutateMission(
  userId: string,
  missionId: string,
  idempotencyKey: string,
  action: "complete" | "revert"
) {
  const { db } = getRuntime();
  const mutation =
    action === "complete"
      ? completeMissionAtomically
      : revertMissionAtomically;
  const result = await mutation(db, {
    userId,
    missionId,
    idempotencyKey,
    now: new Date()
  });
  if (result.applied) await recomputeProjections(userId);
  return result;
}

function chooseMood(
  daily: ReturnType<typeof evaluateDailyProgress>
): ButlerMood {
  if (daily.isPerfect) return "DELIGHTED";
  if (daily.isDailyClear) return "PROUD";
  if (daily.totalCompleted >= 1) return "CHEERFUL";
  return "CALM";
}

export async function getDashboard(userId: string) {
  const { prisma } = getRuntime();
  const { gameDate, missions } = await ensureTodayMissions(userId);
  const daily = evaluateDailyProgress(
    missions.map((mission) => ({
      role: mission.role === "CORE" ? "CORE" : "BONUS",
      status: mission.status === "COMPLETED" ? "COMPLETED" : "PENDING"
    }))
  );
  const [progress, streak, statuses] = await Promise.all([
    prisma.userProgress.findUniqueOrThrow({ where: { userId } }),
    prisma.streak.findUniqueOrThrow({ where: { userId } }),
    prisma.statusProgress.findMany({
      where: { userId },
      orderBy: { xp: "desc" }
    })
  ]);
  const mood = chooseMood(daily);

  return {
    gameDate,
    missions,
    daily,
    progress: {
      ...progress,
      level: levelFromXp(progress.totalXp)
    },
    streak,
    statuses,
    character: {
      ...britishGentlemanWorld.character,
      mood,
      message: butlerMessages[mood][0]
    }
  };
}

export async function listHabits(userId: string) {
  return getRuntime().prisma.habit.findMany({
    where: { userId },
    include: { category: true },
    orderBy: [{ isActive: "desc" }, { preferredOrder: "asc" }]
  });
}

export async function createHabit(
  userId: string,
  input: {
    title: string;
    categoryId: string;
    minimumRule: string;
    baseXp: number;
  }
) {
  const { prisma } = getRuntime();
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId }
  });
  if (!category) throw new Error("CATEGORY_NOT_FOUND");
  return prisma.habit.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      categoryId: input.categoryId,
      title: input.title,
      worldTitle: input.title,
      minimumRule: input.minimumRule,
      baseXp: input.baseXp,
      preferredOrder: 100,
      statusWeights: {
        create: {
          id: crypto.randomUUID(),
          statusKey: category.key,
          weight: 1
        }
      }
    }
  });
}

export async function setHabitActive(
  userId: string,
  habitId: string,
  isActive: boolean
) {
  const { prisma } = getRuntime();
  const result = await prisma.habit.updateMany({
    where: { id: habitId, userId },
    data: { isActive }
  });
  if (result.count !== 1) throw new Error("HABIT_NOT_FOUND");
}
