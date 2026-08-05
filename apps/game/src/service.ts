import {
  britishGentlemanWorld,
  categories,
  companions,
  getEncoreLucienMessage,
  getCompanionArtwork,
  getCompanionMessage,
  getCompanionTapResponses,
  getHabitEncoreRule,
  habitTemplates,
  type ButlerMood
} from "@growlogue/content";
import {
  completeMissionAtomically,
  createPrisma,
  recordMissionEncoreAtomically,
  revertMissionAtomically
} from "@growlogue/db";
import {
  calculateStreaks,
  evaluateEncoreProgress,
  evaluateDailyProgress,
  getGameDate,
  levelFromXp,
  selectButlerMood,
  selectDailyMissions,
  type DayMode
} from "@growlogue/domain";

export async function ensureUserFoundation(db: D1Database, userId: string) {
  const prisma = createPrisma(db);

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
  for (const character of companions) {
    await prisma.character.upsert({
      where: { id: character.id },
      update: {
        name: character.name,
        personality: character.personality,
        avatarUrl: character.avatarUrl
      },
      create: {
        id: character.id,
        worldId: britishGentlemanWorld.id,
        name: character.name,
        personality: character.personality,
        avatarUrl: character.avatarUrl
      }
    });
  }
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
  db: D1Database,
  userId: string,
  templateIds: readonly string[]
) {
  if (templateIds.length < 3) {
    throw new Error("AT_LEAST_THREE_HABITS_REQUIRED");
  }
  const prisma = createPrisma(db);
  await ensureUserFoundation(db, userId);

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

export async function ensureTodayMissions(
  db: D1Database,
  userId: string,
  now = new Date()
) {
  const prisma = createPrisma(db);
  const profile = await ensureUserFoundation(db, userId);
  const gameDate = getGameDate(now, profile.timezone, profile.resetHour);
  const existing = await prisma.dailyMission.findMany({
    where: { userId, gameDate },
    include: {
      habit: { include: { category: true } },
      events: {
        where: { type: "ENCORE" },
        select: { id: true }
      }
    },
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
      include: {
        habit: { include: { category: true } },
        events: {
          where: { type: "ENCORE" },
          select: { id: true }
        }
      },
      orderBy: { position: "asc" }
    })
  };
}

async function recomputeProjections(db: D1Database, userId: string) {
  const prisma = createPrisma(db);
  const [missions, dailyModes] = await Promise.all([
    prisma.dailyMission.findMany({
      where: { userId },
      orderBy: [{ gameDate: "asc" }, { position: "asc" }]
    }),
    prisma.dailyMode.findMany({
      where: { userId, mode: { not: "NORMAL" } },
      select: { gameDate: true }
    })
  ]);
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

  const streaks = calculateStreaks(
    clearDates,
    new Set(dailyModes.map((mode) => mode.gameDate))
  );

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
      currentDays: streaks.currentDays,
      longestDays: streaks.longestDays,
      lastClearGameDate: streaks.lastClearGameDate
    }
  });
}

export async function mutateMission(
  db: D1Database,
  userId: string,
  missionId: string,
  idempotencyKey: string,
  action: "complete" | "revert"
) {
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
  if (result.applied) await recomputeProjections(db, userId);
  return result;
}

export async function recordMissionEncore(
  db: D1Database,
  userId: string,
  missionId: string,
  idempotencyKey: string
) {
  const prisma = createPrisma(db);
  const mission = await prisma.dailyMission.findFirst({
    where: { id: missionId, userId },
    select: { habitId: true }
  });
  if (!mission) throw new Error("MISSION_NOT_FOUND");
  const rule = getHabitEncoreRule(mission.habitId);
  if (!rule) throw new Error("MISSION_NOT_REPEATABLE");

  const result = await recordMissionEncoreAtomically(db, {
    userId,
    missionId,
    idempotencyKey,
    now: new Date(),
    bonusXp: rule.bonusXp,
    maxRewardedEncores: rule.maxRewardedEncores,
    maxDailyEncores: rule.maxDailyEncores
  });
  const progress = evaluateEncoreProgress({
    encoreCount: result.encoreCount,
    bonusXp: rule.bonusXp,
    maxRewardedEncores: rule.maxRewardedEncores,
    maxDailyEncores: rule.maxDailyEncores,
    softCapSets: rule.softCapSets
  });
  return {
    ...result,
    progress,
    lucienMessage: getEncoreLucienMessage(result.totalSets)
  };
}

function distanceInDays(from: string, to: string): number {
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${to}T00:00:00.000Z`) -
        Date.parse(`${from}T00:00:00.000Z`)) /
        86_400_000
    )
  );
}

export async function getDashboard(db: D1Database, userId: string) {
  const prisma = createPrisma(db);
  const { gameDate, missions } = await ensureTodayMissions(db, userId);
  const daily = evaluateDailyProgress(
    missions.map((mission) => ({
      role: mission.role === "CORE" ? "CORE" : "BONUS",
      status: mission.status === "COMPLETED" ? "COMPLETED" : "PENDING"
    }))
  );
  const [progress, streak, statuses, dailyMode, lastActivity, characterState] =
    await Promise.all([
      prisma.userProgress.findUniqueOrThrow({ where: { userId } }),
      prisma.streak.findUniqueOrThrow({ where: { userId } }),
      prisma.statusProgress.findMany({
        where: { userId },
        orderBy: { xp: "desc" }
      }),
      prisma.dailyMode.findUnique({
        where: { userId_gameDate: { userId, gameDate } }
      }),
      prisma.activityEvent.findFirst({
        where: { userId, type: "COMPLETE" },
        orderBy: { createdAt: "desc" },
        select: { gameDate: true }
      }),
      prisma.characterState.findUniqueOrThrow({
        where: { userId },
        include: { character: true }
      })
    ]);
  const dayMode = (dailyMode?.mode ?? "NORMAL") as DayMode;
  const mood = selectButlerMood({
    coreCompleted: daily.coreCompleted,
    totalCompleted: daily.totalCompleted,
    totalMissions: daily.totalMissions,
    inactiveDays: lastActivity
      ? distanceInDays(lastActivity.gameDate, gameDate)
      : 0,
    dayMode
  }) as ButlerMood;
  await prisma.characterState.update({
    where: { userId },
    data: {
      mood,
      moodScore:
        mood === "DELIGHTED"
          ? 100
          : mood === "PROUD"
            ? 85
            : mood === "CHEERFUL"
              ? 70
              : mood === "CALM"
                ? 50
                : mood === "WORRIED"
                  ? 40
                  : mood === "LONELY"
                    ? 25
                    : 15
    }
  });
  const dashboardMissions = missions.map((mission) => {
    const { events, ...missionData } = mission;
    const rule = getHabitEncoreRule(mission.habitId);
    if (!rule) return { ...missionData, encore: null };
    const progress = evaluateEncoreProgress({
      encoreCount: events.length,
      bonusXp: rule.bonusXp,
      maxRewardedEncores: rule.maxRewardedEncores,
      maxDailyEncores: rule.maxDailyEncores,
      softCapSets: rule.softCapSets
    });
    return {
      ...missionData,
      encore: {
        amount: rule.amount,
        unit: rule.unit,
        actionLabel: rule.actionLabel,
        ...progress
      }
    };
  });

  return {
    gameDate,
    dayMode,
    missions: dashboardMissions,
    daily,
    progress: {
      ...progress,
      level: levelFromXp(progress.totalXp)
    },
    streak,
    statuses,
    character: {
      id: characterState.character.id,
      name: characterState.character.name,
      personality: characterState.character.personality,
      avatarUrl:
        getCompanionArtwork(characterState.character.id, mood) ??
        characterState.character.avatarUrl,
      mood,
      message: getCompanionMessage(characterState.character.id, mood),
      tapResponses: getCompanionTapResponses(characterState.character.id)
    }
  };
}

export async function listCompanions(db: D1Database, userId: string) {
  const prisma = createPrisma(db);
  await ensureUserFoundation(db, userId);
  const [characters, selected] = await Promise.all([
    prisma.character.findMany({
      where: { worldId: britishGentlemanWorld.id },
      orderBy: { name: "asc" }
    }),
    prisma.characterState.findUniqueOrThrow({ where: { userId } })
  ]);
  return {
    characters,
    selectedCharacterId: selected.characterId
  };
}

export async function getDailyReviewSnapshot(db: D1Database, userId: string) {
  const dashboard = await getDashboard(db, userId);
  const prisma = createPrisma(db);
  const earned = await prisma.xpLedger.aggregate({
    where: {
      userId,
      gameDate: dashboard.gameDate
    },
    _sum: { amount: true }
  });
  return {
    gameDate: dashboard.gameDate,
    dayMode: dashboard.dayMode,
    coreCompleted: dashboard.daily.coreCompleted,
    totalCompleted: dashboard.daily.totalCompleted,
    totalMissions: dashboard.daily.totalMissions,
    earnedXp: Math.max(0, earned._sum.amount ?? 0),
    currentStreak: dashboard.streak.currentDays,
    dailyClear: dashboard.daily.isDailyClear,
    perfect: dashboard.daily.isPerfect
  };
}

export async function getTodayMode(
  db: D1Database,
  userId: string,
  now = new Date()
) {
  const prisma = createPrisma(db);
  const profile = await ensureUserFoundation(db, userId);
  const gameDate = getGameDate(now, profile.timezone, profile.resetHour);
  const dailyMode = await prisma.dailyMode.findUnique({
    where: { userId_gameDate: { userId, gameDate } }
  });
  return {
    gameDate,
    mode: (dailyMode?.mode ?? "NORMAL") as DayMode
  };
}

export async function setTodayMode(
  db: D1Database,
  userId: string,
  mode: DayMode,
  now = new Date()
) {
  const prisma = createPrisma(db);
  const profile = await ensureUserFoundation(db, userId);
  const gameDate = getGameDate(now, profile.timezone, profile.resetHour);
  const dailyMode = await prisma.dailyMode.upsert({
    where: { userId_gameDate: { userId, gameDate } },
    update: { mode },
    create: {
      id: crypto.randomUUID(),
      userId,
      gameDate,
      mode
    }
  });
  await recomputeProjections(db, userId);
  return dailyMode;
}

export async function listHabits(db: D1Database, userId: string) {
  return createPrisma(db).habit.findMany({
    where: { userId },
    include: { category: true },
    orderBy: [{ isActive: "desc" }, { preferredOrder: "asc" }]
  });
}

export async function createHabit(
  db: D1Database,
  userId: string,
  input: {
    title: string;
    categoryId: string;
    minimumRule: string;
    baseXp: number;
  }
) {
  const prisma = createPrisma(db);
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
  db: D1Database,
  userId: string,
  habitId: string,
  isActive: boolean
) {
  const prisma = createPrisma(db);
  const result = await prisma.habit.updateMany({
    where: { id: habitId, userId },
    data: { isActive }
  });
  if (result.count !== 1) throw new Error("HABIT_NOT_FOUND");
}
