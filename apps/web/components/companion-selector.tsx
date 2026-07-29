"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface Companion {
  id: string;
  name: string;
  personality: string;
  avatarUrl: string | null;
}

export function CompanionSelector({
  companions,
  initialCharacterId
}: {
  companions: Companion[];
  initialCharacterId: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialCharacterId);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function select(characterId: string) {
    if (characterId === selectedId || pendingId) return;
    setPendingId(characterId);
    setMessage("");
    const response = await fetch("/api/v1/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId })
    });
    setPendingId(null);
    if (!response.ok) {
      setMessage("相棒を変更できませんでした。");
      return;
    }
    setSelectedId(characterId);
    setMessage("相棒を変更しました。次の訪問から一緒に歩みます。");
    router.refresh();
  }

  return (
    <section className="section-block companion-section" aria-labelledby="companion-heading">
      <div className="section-heading">
        <span className="section-heading__icon" aria-hidden="true">
          ♙
        </span>
        <div>
          <p className="eyebrow">Your companion</p>
          <h2 id="companion-heading">相棒を選ぶ</h2>
        </div>
      </div>
      <div className="companion-grid">
        {companions.map((companion) => {
          const selected = companion.id === selectedId;
          return (
            <button
              aria-pressed={selected}
              className={`companion-option ${selected ? "is-selected" : ""}`}
              disabled={pendingId !== null}
              key={companion.id}
              onClick={() => void select(companion.id)}
              type="button"
            >
              <span className="companion-option__image">
                {companion.avatarUrl ? (
                  <Image
                    alt=""
                    fill
                    sizes="(max-width: 768px) 42vw, 260px"
                    src={companion.avatarUrl}
                  />
                ) : null}
              </span>
              <span className="companion-option__body">
                <strong>{companion.name.split("（")[0]}</strong>
                <small>{companion.personality}</small>
              </span>
              <span className="companion-option__check" aria-hidden="true">
                {pendingId === companion.id ? "…" : selected ? "✓" : "選ぶ"}
              </span>
            </button>
          );
        })}
      </div>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
