"use client";

import type { DailyReviewResult } from "@growlogue/ai-coach";
import { useState } from "react";

export function DailyReviewCard({ characterName = "Lucien" }: { characterName?: string }) {
  const [review, setReview] = useState<DailyReviewResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function reviewToday() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/coach/daily-review", {
        method: "POST"
      });
      if (!response.ok) throw new Error("REQUEST_FAILED");
      setReview((await response.json()) as DailyReviewResult);
    } catch {
      setError("振り返りを用意できませんでした。少し時間をおいてお試しください。");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="section-block mb-5 overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="eyebrow">Daily review</p>
          <h2 className="serif text-xl font-semibold">{characterName}と振り返る</h2>
        </div>
        {!review ? (
          <button
            className="button-secondary min-h-0 shrink-0 px-4 py-2 text-xs"
            disabled={pending}
            onClick={() => void reviewToday()}
            type="button"
          >
            {pending ? "準備中…" : "今日を見る"}
          </button>
        ) : null}
      </div>
      {review ? (
        <div className="border-t border-[#173f3515] px-5 py-4" aria-live="polite">
          <p className="serif leading-7">{characterName}「{review.summary}」</p>
          <p className="mt-3 text-sm leading-6 text-[#4f5d54]">
            {review.nextAction}
          </p>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[10px] font-bold tracking-wider text-[#667269]">
              {review.source === "ai" ? "AI REVIEW" : "SAFE REVIEW"}
            </span>
            <button
              className="text-xs font-bold text-[#173f35] underline underline-offset-4"
              onClick={() => void reviewToday()}
              disabled={pending}
              type="button"
            >
              もう一度見る
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-[#173f3515] px-5 py-4 text-sm leading-6 text-[#667269]">
          今日の達成数とXPだけを使い、次の一歩を短く整えます。
        </div>
      )}
      {error ? (
        <p className="border-t border-[#173f3515] px-5 py-3 text-sm font-bold" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
