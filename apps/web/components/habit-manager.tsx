"use client";

import { categories } from "@growlogue/content";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface Habit {
  id: string;
  title: string;
  worldTitle: string;
  minimumRule: string;
  baseXp: number;
  isActive: boolean;
  category: { icon: string; name: string };
}

export function HabitManager({ habits }: { habits: Habit[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [pending, setPending] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/habits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        categoryId: form.get("categoryId"),
        minimumRule: form.get("minimumRule"),
        baseXp: Number(form.get("baseXp"))
      })
    });
    setPending(false);
    if (response.ok) {
      setShowForm(false);
      router.refresh();
    }
  }

  async function toggle(habit: Habit) {
    await fetch(`/api/v1/habits/${habit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !habit.isActive })
    });
    router.refresh();
  }

  return (
    <>
      <div className="grid gap-3">
        {habits.map((habit) => (
          <article className={`card p-4 ${habit.isActive ? "" : "opacity-55"}`} key={habit.id}>
            <div className="flex items-start gap-3">
              <span className="text-2xl" aria-hidden="true">{habit.category.icon}</span>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{habit.worldTitle}</h2>
                <p className="mt-1 text-sm leading-6 text-[#667269]">{habit.minimumRule}</p>
                <p className="mt-2 text-xs font-black text-[#bd8d39]">
                  {habit.category.name} · {habit.baseXp} XP
                </p>
              </div>
              <button className="button-secondary min-h-0 px-3 py-1 text-xs" onClick={() => toggle(habit)}>
                {habit.isActive ? "休止" : "再開"}
              </button>
            </div>
          </article>
        ))}
      </div>

      {showForm ? (
        <form className="card mt-5 space-y-4 p-5" onSubmit={create}>
          <h2 className="serif text-xl font-semibold">新しい習慣</h2>
          <input className="field" name="title" placeholder="習慣名" required maxLength={60} />
          <select className="field" name="categoryId">
            {categories.map((category) => (
              <option value={category.id} key={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
          <input
            className="field"
            name="minimumRule"
            placeholder="最小達成条件（例：1分だけでも達成）"
            required
            maxLength={120}
          />
          <select className="field" name="baseXp" defaultValue="10">
            <option value="5">小さな習慣 · 5 XP</option>
            <option value="10">標準習慣 · 10 XP</option>
            <option value="15">重点習慣 · 15 XP</option>
            <option value="20">難しい挑戦 · 20 XP</option>
          </select>
          <div className="flex gap-2">
            <button className="button-primary flex-1" disabled={pending}>保存</button>
            <button type="button" className="button-secondary" onClick={() => setShowForm(false)}>
              閉じる
            </button>
          </div>
        </form>
      ) : (
        <button className="button-primary mt-5 w-full" onClick={() => setShowForm(true)}>
          ＋ 習慣を追加
        </button>
      )}
    </>
  );
}
