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

  return (
    <>
      {message ? (
        <p className="card mb-3 p-4 text-sm font-bold" role="status">
          {message}
        </p>
      ) : null}
      <div className="grid gap-3">
        {missions.map((mission) => {
          const complete = mission.status === "COMPLETED";
          return (
            <button
              key={mission.id}
              type="button"
              disabled={pendingId === mission.id}
              onClick={() => toggle(mission)}
              className={`card flex w-full items-center gap-4 p-4 text-left transition ${
                complete
                  ? "border-[#8bb29c] bg-[#edf5ef]"
                  : "hover:border-[#bd8d39]"
              }`}
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-full border-2 text-lg ${
                  complete
                    ? "border-[#173f35] bg-[#173f35] text-white"
                    : "border-[#b9b7ae] bg-white"
                }`}
                aria-hidden="true"
              >
                {complete ? "✓" : mission.habit.category.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="mb-1 flex items-center gap-2">
                  <strong className={complete ? "line-through opacity-65" : ""}>
                    {mission.habit.worldTitle}
                  </strong>
                  <span className="rounded-full bg-[#ece7da] px-2 py-0.5 text-[10px] font-black tracking-wider text-[#667269]">
                    {mission.role === "CORE" ? "CORE" : "BONUS"}
                  </span>
                </span>
                <span className="block truncate text-xs text-[#667269]">
                  {mission.habit.minimumRule}
                </span>
              </span>
              <span className="shrink-0 text-xs font-black text-[#bd8d39]">
                +{mission.xpSnapshot} XP
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
