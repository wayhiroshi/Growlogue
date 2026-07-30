"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Mission {
  id: string;
  role: string;
  status: string;
  xpSnapshot: number;
  habit: {
    worldTitle: string;
    minimumRule: string;
    category: {
      icon: string;
      name: string;
    };
  };
  encore: {
    amount: number;
    unit: string;
    actionLabel: string;
    encoreCount: number;
    totalSets: number;
    canRecord: boolean;
    nextXp: number;
    softCapReached: boolean;
  } | null;
}

export function MissionList({ missions }: { missions: Mission[] }) {
  const router = useRouter();
  const [visibleMissions, setVisibleMissions] = useState(missions);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [xpFeedback, setXpFeedback] = useState<{
    missionId: string;
    amount: number;
  } | null>(null);
  const [milestone, setMilestone] = useState<
    "DAILY_CLEAR" | "PERFECT" | null
  >(null);
  const [undoMissionId, setUndoMissionId] = useState<string | null>(null);
  const feedbackTimer = useRef<number | null>(null);
  const milestoneTimer = useRef<number | null>(null);
  const undoTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
      if (milestoneTimer.current) window.clearTimeout(milestoneTimer.current);
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
    },
    []
  );

  function showXp(missionId: string, amount: number) {
    if (feedbackTimer.current) window.clearTimeout(feedbackTimer.current);
    setXpFeedback({ missionId, amount });
    feedbackTimer.current = window.setTimeout(
      () => setXpFeedback(null),
      1_500
    );
  }

  function showMilestone(
    previousMissions: Mission[],
    nextMissions: Mission[]
  ) {
    const core = nextMissions.filter((mission) => mission.role === "CORE");
    const coreComplete = core.filter(
      (mission) => mission.status === "COMPLETED"
    ).length;
    const previousCoreComplete = previousMissions.filter(
      (mission) => mission.role === "CORE" && mission.status === "COMPLETED"
    ).length;
    const allComplete =
      nextMissions.length > 0 &&
      nextMissions.every((mission) => mission.status === "COMPLETED");
    const previouslyAllComplete =
      previousMissions.length > 0 &&
      previousMissions.every((mission) => mission.status === "COMPLETED");
    const nextMilestone =
      allComplete &&
      !previouslyAllComplete &&
      nextMissions.length > core.length
        ? "PERFECT"
        : core.length > 0 &&
            previousCoreComplete < core.length &&
            coreComplete === core.length
          ? "DAILY_CLEAR"
          : null;
    if (!nextMilestone) return;
    if (milestoneTimer.current) window.clearTimeout(milestoneTimer.current);
    setMilestone(nextMilestone);
    milestoneTimer.current = window.setTimeout(
      () => setMilestone(null),
      2_400
    );
  }

  function offerUndo(missionId: string) {
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    setUndoMissionId(missionId);
    undoTimer.current = window.setTimeout(
      () => setUndoMissionId(null),
      5_000
    );
  }

  async function mutateMission(
    missionId: string,
    action: "complete" | "revert"
  ) {
    const mission = visibleMissions.find((entry) => entry.id === missionId);
    if (!mission) return;
    const previousStatus = mission.status;
    const nextStatus = action === "complete" ? "COMPLETED" : "PENDING";
    const optimisticMissions = visibleMissions.map((entry) =>
      entry.id === mission.id ? { ...entry, status: nextStatus } : entry
    );

    setVisibleMissions(optimisticMissions);
    setPendingAction(`${mission.id}:toggle`);
    setMessage("");
    if (action === "complete") {
      showXp(mission.id, mission.xpSnapshot);
      showMilestone(visibleMissions, optimisticMissions);
    } else {
      setUndoMissionId(null);
      setXpFeedback(null);
      setMilestone(null);
    }

    const response = await fetch(`/api/v1/missions/${mission.id}/${action}`, {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID()
      }
    });
    if (!response.ok) {
      setVisibleMissions((current) =>
        current.map((entry) =>
          entry.id === mission.id
            ? { ...entry, status: previousStatus }
            : entry
        )
      );
      setXpFeedback(null);
      setMilestone(null);
      setPendingAction(null);
      setMessage("更新できませんでした。もう一度お試しください。");
      return;
    }
    const result = (await response.json()) as { earnedXp: number };
    if (action === "complete") {
      showXp(mission.id, result.earnedXp);
      offerUndo(mission.id);
      setMessage(
        result.earnedXp > mission.xpSnapshot
          ? `お帰りなさいませ。再開ボーナスを含む ${result.earnedXp} XP を獲得しました。`
          : `任務完了。${result.earnedXp} XPを物語に刻みました。`
      );
    } else {
      setMessage("達成を取り消しました。いつでも、もう一度始められます。");
    }
    setPendingAction(null);
    router.refresh();
  }

  async function addEncore(mission: Mission) {
    if (!mission.encore?.canRecord) return;
    setPendingAction(`${mission.id}:encore`);
    setMessage("");
    const response = await fetch(`/api/v1/missions/${mission.id}/encore`, {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID()
      }
    });
    const result = (await response.json()) as {
      earnedXp?: number;
      totalSets?: number;
      lucienMessage?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      setPendingAction(null);
      setMessage(
        result.error?.message ??
          "追加の積み重ねを記録できませんでした。もう一度お試しください。"
      );
      return;
    }
    const xpText = result.earnedXp ? ` +${result.earnedXp} XP。` : "。";
    setMessage(
      `${result.totalSets ?? mission.encore.totalSets + 1}セット目を記録しました${xpText}${result.lucienMessage ?? ""}`
    );
    if (result.earnedXp) showXp(mission.id, result.earnedXp);
    setVisibleMissions((current) =>
      current.map((entry) =>
        entry.id === mission.id && entry.encore
          ? {
              ...entry,
              encore: {
                ...entry.encore,
                encoreCount: entry.encore.encoreCount + 1,
                totalSets:
                  result.totalSets ?? entry.encore.totalSets + 1
              }
            }
          : entry
      )
    );
    setPendingAction(null);
    router.refresh();
  }

  const groups = [
    {
      role: "CORE",
      label: "今日の中心",
      note: "3つでDaily Clear",
      missions: visibleMissions.filter((mission) => mission.role === "CORE")
    },
    {
      role: "BONUS",
      label: "余力があれば",
      note: "すべてでPerfect",
      missions: visibleMissions.filter((mission) => mission.role !== "CORE")
    }
  ];

  return (
    <>
      <div aria-atomic="true" aria-live="polite">
        {message ? (
          <div className="mission-feedback" role="status">
            <p>{message}</p>
            {undoMissionId ? (
              <button
                disabled={pendingAction === `${undoMissionId}:toggle`}
                onClick={() => void mutateMission(undoMissionId, "revert")}
                type="button"
              >
                取り消す
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {milestone ? (
        <div
          className={`mission-milestone ${milestone === "PERFECT" ? "is-perfect" : ""}`}
          role="status"
        >
          <span aria-hidden="true">{milestone === "PERFECT" ? "✦" : "✓"}</span>
          <div>
            <p>{milestone === "PERFECT" ? "PERFECT DAY" : "DAILY CLEAR"}</p>
            <strong>
              {milestone === "PERFECT"
                ? "今日の物語を、すべて進めました"
                : "今日の中心を、やり遂げました"}
            </strong>
          </div>
        </div>
      ) : null}
      <section className="mission-board" aria-labelledby="missions-heading">
        <div className="section-heading">
          <span className="section-heading__icon" aria-hidden="true">☀</span>
          <div>
            <p className="eyebrow">Today&apos;s path</p>
            <h2 id="missions-heading">今日の流れ</h2>
          </div>
        </div>
        {groups.map((group) =>
          group.missions.length ? (
            <div className="mission-group" key={group.role}>
              <div className="mission-group__heading">
                <strong>{group.label}</strong>
                <span>{group.note}</span>
              </div>
              <div className="mission-timeline">
                {group.missions.map((mission) => {
                  const complete = mission.status === "COMPLETED";
                  const hasEncore = (mission.encore?.encoreCount ?? 0) > 0;
                  const togglePending =
                    pendingAction === `${mission.id}:toggle`;
                  const encorePending =
                    pendingAction === `${mission.id}:encore`;
                  return (
                    <div className="mission-entry" key={mission.id}>
                      <button
                        aria-disabled={complete && hasEncore}
                        aria-label={
                          complete && hasEncore
                            ? `${mission.habit.worldTitle}は追加セットを含めて完了済み`
                            : `${mission.habit.worldTitle}を${complete ? "未完了に戻す" : "完了する"}`
                        }
                        className={`mission-item ${complete ? "is-complete" : ""} ${hasEncore ? "is-locked" : ""}`}
                        disabled={togglePending || encorePending}
                        onClick={() => {
                          if (complete && hasEncore) {
                            setMessage(
                              "追加セットを記録済みです。最初の達成はそのまま残します。"
                            );
                            return;
                          }
                          void mutateMission(
                            mission.id,
                            complete ? "revert" : "complete"
                          );
                        }}
                        type="button"
                      >
                        <span className="mission-item__marker" aria-hidden="true">
                          {complete ? "✓" : mission.habit.category.icon}
                        </span>
                        <span className="mission-item__body">
                          <strong>{mission.habit.worldTitle}</strong>
                          <small>{mission.habit.minimumRule}</small>
                        </span>
                        <span className="mission-item__xp">
                          {xpFeedback?.missionId === mission.id ? (
                            <span className="mission-item__xp-pop" role="status">
                              +{xpFeedback.amount} XP
                            </span>
                          ) : null}
                          +{mission.xpSnapshot}
                          <small>XP</small>
                        </span>
                      </button>
                      {complete && mission.encore ? (
                        <div className="encore-panel">
                          <div className="encore-panel__summary">
                            <div>
                              <strong>
                                {mission.encore.totalSets}セット ·{" "}
                                {mission.encore.totalSets *
                                  mission.encore.amount}
                                {mission.encore.unit}
                              </strong>
                              <span>
                                {mission.encore.softCapReached
                                  ? "ここで終えても十分な積み重ねです"
                                  : "本日の任務は完了済みです"}
                              </span>
                            </div>
                            <span aria-label={`${mission.encore.totalSets}セット達成`}>
                              {Array.from(
                                { length: mission.encore.totalSets },
                                () => "●"
                              ).join(" ")}
                            </span>
                          </div>
                          {mission.encore.canRecord ? (
                            <button
                              className="encore-button"
                              disabled={encorePending || togglePending}
                              onClick={() => void addEncore(mission)}
                              type="button"
                            >
                              <span>{mission.encore.actionLabel}</span>
                              <small>
                                {mission.encore.nextXp > 0
                                  ? `+${mission.encore.nextXp} XP`
                                  : "記録のみ"}
                              </small>
                            </button>
                          ) : (
                            <p className="encore-panel__closed">
                              本日はここまで。Lucienとゆっくり休みましょう。
                            </p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null
        )}
      </section>
    </>
  );
}
