"use client";

import { habitTemplates } from "@growlogue/content";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function OnboardingForm() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(
    habitTemplates.slice(0, 4).map((habit) => habit.id)
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (selected.length < 3) {
      setError("3つ以上選んでください。");
      return;
    }
    setPending(true);
    const response = await fetch("/api/v1/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateIds: selected })
    });
    if (!response.ok) {
      setError("設定を保存できませんでした。");
      setPending(false);
      return;
    }
    router.push("/home");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <div className="grid gap-3">
        {habitTemplates.map((habit) => {
          const checked = selected.includes(habit.id);
          return (
            <label
              className={`card flex cursor-pointer items-start gap-4 p-4 transition ${
                checked ? "border-[#bd8d39] bg-[#fffaf0]" : ""
              }`}
              key={habit.id}
            >
              <input
                type="checkbox"
                className="mt-1 size-5 accent-[#173f35]"
                checked={checked}
                onChange={() => toggle(habit.id)}
              />
              <span>
                <strong className="block">{habit.worldTitle}</strong>
                <span className="mt-1 block text-sm text-[#667269]">
                  {habit.title} — {habit.minimumRule}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error ? <p className="mt-4 text-sm text-[#8b3d32]">{error}</p> : null}
      <button className="button-primary mt-6 w-full" disabled={pending}>
        {pending ? "準備中…" : `${selected.length}つの習慣で始める`}
      </button>
    </form>
  );
}
