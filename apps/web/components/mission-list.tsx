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
}

export function MissionList({ missions }: { missions: Mission[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function toggle(mission: Mission) {
    setPendingId(mission.id);
    setMessage("");
    const action = mission.status === "COMPLETED" ? "revert" : "complete";
    const response = await fetch(`/api/v1/missions/${mission.id}/${action}`, {
      method: "POST",
      headers: {
        "Idempotency-Key": crypto.randomUUID()
      }
    });
    if (!response.ok) {
      setPendingId(null);
      setMessage("更新できませんでした。もう一度お試しください。");
      return;
    }
    const result = (await response.json()) as { earnedXp: number };
    if (action === "complete" && result.earnedXp > mission.xpSnapshot) {
      setMessage(
        `お帰りなさいませ。再開ボーナスを含む ${result.earnedXp} XP を獲得しました。`
      );
    }
    setPendingId(null);
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
                  return (
                    <button
                      aria-label={`${mission.habit.worldTitle}を${complete ? "未完了に戻す" : "完了する"}`}
                      className={`mission-item ${complete ? "is-complete" : ""}`}
                      disabled={pendingId === mission.id}
                      key={mission.id}
                      onClick={() => toggle(mission)}
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
