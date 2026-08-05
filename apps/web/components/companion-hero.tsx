"use client";

import { useEffect, useRef, useState } from "react";

interface CompanionHeroProps {
  avatarUrl: string | null;
  characterName: string;
  fullName: string;
  message: string;
  moodLabel: string;
  tapResponses: readonly string[];
  completed: number;
  total: number;
  percent: number;
}

export function CompanionHero({
  avatarUrl,
  characterName,
  fullName,
  message,
  moodLabel,
  tapResponses,
  completed,
  total,
  percent
}: CompanionHeroProps) {
  const [reactionMessage, setReactionMessage] = useState<string | null>(null);
  const [reacting, setReacting] = useState(false);
  const responseIndex = useRef(0);
  const reactionTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
    },
    []
  );

  function speak() {
    const response =
      tapResponses[responseIndex.current % tapResponses.length] ??
      tapResponses[0] ??
      message;
    responseIndex.current += 1;
    setReactionMessage(response);
    setReacting(false);
    window.requestAnimationFrame(() => setReacting(true));
    if (reactionTimer.current) window.clearTimeout(reactionTimer.current);
    reactionTimer.current = window.setTimeout(() => {
      setReacting(false);
      setReactionMessage(null);
    }, 3_500);
  }

  return (
    <section className={`companion-hero ${reacting ? "is-reacting" : ""}`}>
      <button
        aria-label={`${characterName}に話しかける`}
        className="companion-hero__image"
        onClick={speak}
        type="button"
      >
        {avatarUrl ? (
          <img
            alt={`${fullName}のポートレート`}
            fetchPriority="high"
            height="1152"
            src={avatarUrl}
            width="768"
          />
        ) : null}
        <span className="companion-hero__mood">{moodLabel}</span>
        <span className="companion-hero__tap" aria-hidden="true">
          話しかける
        </span>
      </button>
      <div className="companion-hero__body">
        <p className="eyebrow">Your companion</p>
        <h2>{characterName}</h2>
        <p
          aria-atomic="true"
          aria-live="polite"
          className="companion-hero__message"
        >
          「{reactionMessage ?? message}」
        </p>
        <div className="progress-summary">
          <div>
            <strong>
              {completed}/{total}
            </strong>
            <span>今日の完了</span>
          </div>
          <strong>{percent}%</strong>
        </div>
        <div
          aria-label={`今日の進捗 ${percent}%`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={percent}
          className="progress-track"
          role="progressbar"
        >
          <div style={{ width: `${percent}%` }} />
        </div>
      </div>
    </section>
  );
}
