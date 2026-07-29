"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function toggle(mission: Mission) {
    setPendingAction(`${mission.id}:toggle`);
    setMessage("");
    const action = mission.status === "COMPLETED" ? "revert" : "complete";
    const response = await fetch(`/api/v1/missions/${mission.id}/${action}`, {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID()
      }
    });
    if (!response.ok) {
      setPendingAction(null);
      setMessage("更新できませんでした。もう一度お試しください。");
      return;
    }
    const result = (await response.json()) as { earnedXp: number };
    if (action === "complete" && result.earnedXp > mission.xpSnapshot) {
      setMessage(
        `お帰りなさいませ。再開ボーナスを含む ${result.earnedXp} XP を獲得しました。`
      );
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
    setPendingAction(null);
    router.refresh();
  }

  const groups = [
    {
      role: "CORE",
      label: "今日の中心",
      note: "3つでDaily Clear",
      missions: missions.filter((mission) => mission.role === "CORE")
    },
    {
      role: "BONUS",
      label: "余力があれば",
      note: "すべてでPerfect",
      missions: missions.filter((mission) => mission.role !== "CORE")
    }
  ];

  return (
    <>
      {message ? (
        <p className="card mb-3 p-4 text-sm font-bold" role="status">
          {message}
        </p>
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
                          void toggle(mission);
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
