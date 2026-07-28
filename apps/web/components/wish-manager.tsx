"use client";

import { categories } from "@growlogue/content";
import type {
  ConditionMetric,
  ConditionOperator
} from "@growlogue/life-unlocks";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

interface ConditionView {
  id: string;
  metric: string;
  targetValue: number;
  label: string;
  unit: string | null;
  currentValue: number | null;
  completed: boolean;
}

export interface WishView {
  id: string;
  title: string;
  description: string | null;
  category: string;
  icon: string;
  priority: number;
  status: string;
  progressPercent: number;
  unlockable: boolean;
  lucienComment: string;
  reward: { message: string } | null;
  quests: Array<{
    id: string;
    title: string;
    progressPercent: number;
    completed: boolean;
    conditions: ConditionView[];
  }>;
}

interface ConditionDraft {
  key: string;
  metric: ConditionMetric;
  operator: ConditionOperator;
  label: string;
  targetValue: string;
  baselineValue: string;
  scopeKey: string;
  unit: string;
  currentValue: string;
}

const metricLabels: Record<ConditionMetric, string> = {
  TOTAL_XP: "総XP",
  CATEGORY_XP: "カテゴリXP",
  STREAK_DAYS: "連続日数",
  COMPLETION_COUNT: "達成回数",
  MANUAL_NUMBER: "手入力の数値",
  MONEY_AMOUNT: "金額"
};

const operatorLabels: Record<ConditionOperator, string> = {
  GTE: "以上",
  LTE: "以下",
  EQ: "ちょうど"
};

function newCondition(key: string): ConditionDraft {
  return {
    key,
    metric: "TOTAL_XP",
    operator: "GTE",
    label: "総XP",
    targetValue: "100",
    baselineValue: "",
    scopeKey: "",
    unit: "XP",
    currentValue: ""
  };
}

function optionalNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

function conditionPayload(condition: ConditionDraft) {
  return {
    metric: condition.metric,
    operator: condition.operator,
    targetValue: Number(condition.targetValue),
    baselineValue: optionalNumber(condition.baselineValue),
    scopeKey: condition.scopeKey.trim() || null,
    label: condition.label,
    unit: condition.unit.trim() || null,
    currentValue: optionalNumber(condition.currentValue)
  };
}

function ConditionEditor({
  conditions,
  onChange
}: {
  conditions: ConditionDraft[];
  onChange: (conditions: ConditionDraft[]) => void;
}) {
  function update(key: string, patch: Partial<ConditionDraft>) {
    onChange(
      conditions.map((condition) =>
        condition.key === key ? { ...condition, ...patch } : condition
      )
    );
  }

  return (
    <div className="space-y-3">
      {conditions.map((condition, index) => {
        const manual =
          condition.metric === "MANUAL_NUMBER" ||
          condition.metric === "MONEY_AMOUNT";
        return (
          <div
            className="rounded-xl border border-[#173f3520] p-3"
            key={condition.key}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <strong className="text-sm">条件 {index + 1}</strong>
              {conditions.length > 1 ? (
                <button
                  className="text-xs font-bold text-[#8b3d32]"
                  type="button"
                  onClick={() =>
                    onChange(
                      conditions.filter((item) => item.key !== condition.key)
                    )
                  }
                >
                  削除
                </button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold">
                指標
                <select
                  className="field mt-1"
                  value={condition.metric}
                  onChange={(event) => {
                    const metric = event.target.value as ConditionMetric;
                    update(condition.key, {
                      metric,
                      label: metricLabels[metric],
                      unit:
                        metric === "TOTAL_XP" || metric === "CATEGORY_XP"
                          ? "XP"
                          : metric === "STREAK_DAYS"
                            ? "日"
                            : metric === "COMPLETION_COUNT"
                              ? "回"
                              : metric === "MONEY_AMOUNT"
                                ? "円"
                                : ""
                    });
                  }}
                >
                  {Object.entries(metricLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                表示名
                <input
                  className="field mt-1"
                  value={condition.label}
                  maxLength={80}
                  onChange={(event) =>
                    update(condition.key, { label: event.target.value })
                  }
                  required
                />
              </label>
              <label className="text-xs font-bold">
                判定
                <select
                  className="field mt-1"
                  value={condition.operator}
                  onChange={(event) =>
                    update(condition.key, {
                      operator: event.target.value as ConditionOperator
                    })
                  }
                >
                  {Object.entries(operatorLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold">
                目標値
                <input
                  className="field mt-1"
                  type="number"
                  min="0"
                  step="any"
                  value={condition.targetValue}
                  onChange={(event) =>
                    update(condition.key, { targetValue: event.target.value })
                  }
                  required
                />
              </label>
              <label className="text-xs font-bold">
                開始値（任意）
                <input
                  className="field mt-1"
                  type="number"
                  min="0"
                  step="any"
                  value={condition.baselineValue}
                  onChange={(event) =>
                    update(condition.key, {
                      baselineValue: event.target.value
                    })
                  }
                />
              </label>
              <label className="text-xs font-bold">
                単位
                <input
                  className="field mt-1"
                  value={condition.unit}
                  maxLength={20}
                  onChange={(event) =>
                    update(condition.key, { unit: event.target.value })
                  }
                />
              </label>
              {condition.metric === "CATEGORY_XP" ? (
                <label className="text-xs font-bold sm:col-span-2">
                  カテゴリ
                  <select
                    className="field mt-1"
                    value={condition.scopeKey}
                    onChange={(event) =>
                      update(condition.key, { scopeKey: event.target.value })
                    }
                    required
                  >
                    <option value="">選択してください</option>
                    {categories.map((category) => (
                      <option value={category.key} key={category.key}>
                        {category.icon} {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {manual ? (
                <>
                  <label className="text-xs font-bold">
                    変数名
                    <input
                      className="field mt-1"
                      placeholder="例：body_weight"
                      value={condition.scopeKey}
                      maxLength={80}
                      onChange={(event) =>
                        update(condition.key, {
                          scopeKey: event.target.value
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-bold">
                    現在値（任意）
                    <input
                      className="field mt-1"
                      type="number"
                      min="0"
                      step="any"
                      value={condition.currentValue}
                      onChange={(event) =>
                        update(condition.key, {
                          currentValue: event.target.value
                        })
                      }
                    />
                  </label>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
      {conditions.length < 5 ? (
        <button
          className="button-secondary w-full"
          type="button"
          onClick={() =>
            onChange([
              ...conditions,
              newCondition(`condition-${Date.now()}-${conditions.length}`)
            ])
          }
        >
          ＋ AND条件を追加
        </button>
      ) : null}
    </div>
  );
}

export function WishManager({ wishes }: { wishes: WishView[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [conditions, setConditions] = useState<ConditionDraft[]>([
    newCondition("condition-initial")
  ]);
  const [questWishId, setQuestWishId] = useState<string | null>(null);
  const [questConditions, setQuestConditions] = useState<ConditionDraft[]>([
    newCondition("quest-condition-initial")
  ]);
  const [factValues, setFactValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [celebration, setCelebration] = useState<string | null>(null);

  async function createWish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/wishes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description") || null,
        category: form.get("category"),
        icon: form.get("icon"),
        priority: Number(form.get("priority")),
        questTitle: form.get("questTitle"),
        rewardMessage: form.get("rewardMessage"),
        conditions: conditions.map(conditionPayload)
      })
    });
    setPending(false);
    if (!response.ok) {
      setMessage("Wishを追加できませんでした。入力内容をご確認ください。");
      return;
    }
    setShowCreate(false);
    setConditions([newCondition("condition-reset")]);
    setMessage("新しいWishを物語へ追加しました。");
    router.refresh();
  }

  async function addQuest(event: FormEvent<HTMLFormElement>, wishId: string) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/wishes/${wishId}/quests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description") || null,
        conditions: questConditions.map(conditionPayload)
      })
    });
    setPending(false);
    if (!response.ok) {
      setMessage("Questを追加できませんでした。");
      return;
    }
    setQuestWishId(null);
    setQuestConditions([newCondition("quest-condition-reset")]);
    router.refresh();
  }

  async function updateDetails(
    event: FormEvent<HTMLFormElement>,
    wishId: string
  ) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/wishes/${wishId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description") || null,
        priority: Number(form.get("priority"))
      })
    });
    setPending(false);
    setMessage(
      response.ok ? "Wishを更新しました。" : "Wishを更新できませんでした。"
    );
    if (response.ok) router.refresh();
  }

  async function recordFact(wishId: string, conditionId: string) {
    const raw = factValues[conditionId];
    if (!raw) return;
    setPending(true);
    const response = await fetch(`/api/v1/wishes/${wishId}/facts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conditionId, value: Number(raw) })
    });
    setPending(false);
    setMessage(
      response.ok
        ? "現在値を記録しました。"
        : "現在値を記録できませんでした。"
    );
    if (response.ok) router.refresh();
  }

  async function transition(wish: WishView, action: "evaluate" | "complete") {
    setPending(true);
    const response = await fetch(`/api/v1/wishes/${wish.id}/${action}`, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() }
    });
    setPending(false);
    if (!response.ok) {
      setMessage(
        action === "evaluate"
          ? "まだ解放条件が整っていません。"
          : "完了を記録できませんでした。"
      );
      return;
    }
    if (action === "evaluate") setCelebration(wish.title);
    router.refresh();
  }

  async function archive(wishId: string) {
    setPending(true);
    const response = await fetch(`/api/v1/wishes/${wishId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" })
    });
    setPending(false);
    if (response.ok) router.refresh();
  }

  return (
    <>
      {message ? (
        <p className="card mb-4 p-4 text-sm font-bold" role="status">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4">
        {wishes.map((wish) => (
          <article className="card overflow-hidden" key={wish.id}>
            <div className="p-5">
              <div className="flex items-start gap-3">
                <span className="text-3xl" aria-hidden="true">
                  {wish.status === "UNLOCKED" ||
                  wish.status === "COMPLETED"
                    ? "🔓"
                    : wish.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="serif text-xl font-semibold">{wish.title}</h2>
                    <span className="rounded-full bg-[#ece7da] px-2 py-1 text-[10px] font-black">
                      {wish.status}
                    </span>
                  </div>
                  {wish.description ? (
                    <p className="mt-1 text-sm leading-6 text-[#667269]">
                      {wish.description}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex justify-between text-xs font-black">
                <span>Quest progress</span>
                <span className="text-[#bd8d39]">{wish.progressPercent}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#ece7da]">
                <div
                  className="h-full rounded-full bg-[#bd8d39]"
                  style={{ width: `${wish.progressPercent}%` }}
                />
              </div>
            </div>

            <div className="border-t border-[#173f3515] bg-[#f8f4ea] p-5">
              <div className="space-y-4">
                {wish.quests.map((quest) => (
                  <section key={quest.id}>
                    <div className="flex justify-between gap-3">
                      <strong className="text-sm">
                        {quest.completed ? "✓" : "◇"} {quest.title}
                      </strong>
                      <span className="text-xs font-black text-[#667269]">
                        {quest.progressPercent}%
                      </span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {quest.conditions.map((condition) => {
                        const manual =
                          condition.metric === "MANUAL_NUMBER" ||
                          condition.metric === "MONEY_AMOUNT";
                        return (
                          <div
                            className="rounded-xl bg-white/70 p-3"
                            key={condition.id}
                          >
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span>
                                {condition.completed ? "✓" : "□"}{" "}
                                {condition.label}
                              </span>
                              <span className="shrink-0 font-black">
                                {condition.currentValue ?? "未記録"} /{" "}
                                {condition.targetValue}
                                {condition.unit ?? ""}
                              </span>
                            </div>
                            {manual && wish.status === "ACTIVE" ? (
                              <div className="mt-2 flex gap-2">
                                <input
                                  className="field min-h-0 py-2"
                                  type="number"
                                  min="0"
                                  step="any"
                                  placeholder="現在値"
                                  value={factValues[condition.id] ?? ""}
                                  onChange={(event) =>
                                    setFactValues((values) => ({
                                      ...values,
                                      [condition.id]: event.target.value
                                    }))
                                  }
                                />
                                <button
                                  className="button-secondary shrink-0"
                                  type="button"
                                  disabled={pending}
                                  onClick={() =>
                                    recordFact(wish.id, condition.id)
                                  }
                                >
                                  記録
                                </button>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              <p className="serif mt-5 rounded-xl bg-[#edf5ef] p-3 text-sm leading-6">
                Lucien「{wish.lucienComment}」
              </p>
              {wish.reward ? (
                <p className="mt-3 text-sm leading-6">
                  <strong>Reward:</strong> {wish.reward.message}
                </p>
              ) : null}

              {wish.unlockable ? (
                <button
                  className="button-primary mt-4 w-full"
                  disabled={pending}
                  onClick={() => transition(wish, "evaluate")}
                >
                  🔓 人生イベントを解放する
                </button>
              ) : null}
              {wish.status === "UNLOCKED" ? (
                <button
                  className="button-primary mt-4 w-full"
                  disabled={pending}
                  onClick={() => transition(wish, "complete")}
                >
                  現実で実行した
                </button>
              ) : null}

              {wish.status === "ACTIVE" ? (
                <div className="mt-4 grid gap-3">
                  <details>
                    <summary className="cursor-pointer text-sm font-bold text-[#173f35]">
                      Wishを編集
                    </summary>
                    <form
                      className="mt-3 space-y-3"
                      onSubmit={(event) => updateDetails(event, wish.id)}
                    >
                      <input
                        className="field"
                        name="title"
                        defaultValue={wish.title}
                        required
                        maxLength={80}
                      />
                      <textarea
                        className="field min-h-24"
                        name="description"
                        defaultValue={wish.description ?? ""}
                        maxLength={500}
                      />
                      <input
                        className="field"
                        name="priority"
                        type="number"
                        min="1"
                        max="999"
                        defaultValue={wish.priority}
                      />
                      <button
                        className="button-secondary w-full"
                        disabled={pending}
                      >
                        更新
                      </button>
                    </form>
                  </details>
                  {questWishId === wish.id ? (
                    <form
                      className="space-y-3 rounded-xl border border-[#173f3520] p-3"
                      onSubmit={(event) => addQuest(event, wish.id)}
                    >
                      <strong className="text-sm">Questを追加</strong>
                      <input
                        className="field"
                        name="title"
                        placeholder="Quest名"
                        required
                        maxLength={100}
                      />
                      <textarea
                        className="field min-h-20"
                        name="description"
                        placeholder="説明（任意）"
                        maxLength={500}
                      />
                      <ConditionEditor
                        conditions={questConditions}
                        onChange={setQuestConditions}
                      />
                      <div className="flex gap-2">
                        <button
                          className="button-primary flex-1"
                          disabled={pending}
                        >
                          追加
                        </button>
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => setQuestWishId(null)}
                        >
                          閉じる
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      className="button-secondary w-full"
                      type="button"
                      onClick={() => setQuestWishId(wish.id)}
                    >
                      ＋ Questを追加
                    </button>
                  )}
                  <button
                    className="text-xs font-bold text-[#8b3d32]"
                    type="button"
                    disabled={pending}
                    onClick={() => archive(wish.id)}
                  >
                    このWishをアーカイブ
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {showCreate ? (
        <form className="card mt-5 space-y-4 p-5" onSubmit={createWish}>
          <div>
            <p className="eyebrow">New life event</p>
            <h2 className="serif text-xl font-semibold">新しいWish</h2>
          </div>
          <div className="grid grid-cols-[5rem_1fr] gap-3">
            <input
              className="field text-center text-xl"
              name="icon"
              defaultValue="✨"
              required
              maxLength={8}
              aria-label="アイコン"
            />
            <input
              className="field"
              name="title"
              placeholder="例：ゴルフレッスンを始める"
              required
              maxLength={80}
            />
          </div>
          <textarea
            className="field min-h-24"
            name="description"
            placeholder="なぜ叶えたいか（任意）"
            maxLength={500}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              className="field"
              name="category"
              defaultValue="EXPERIENCE"
            >
              <option value="HEALTH">健康</option>
              <option value="LEARNING">学び・資格</option>
              <option value="CAREER">仕事</option>
              <option value="FINANCE">資産・購入</option>
              <option value="FAMILY">家族</option>
              <option value="TRAVEL">旅行</option>
              <option value="EXPERIENCE">体験</option>
              <option value="OTHER">その他</option>
            </select>
            <input
              className="field"
              name="priority"
              type="number"
              min="1"
              max="999"
              defaultValue="100"
              aria-label="優先度"
            />
          </div>
          <input
            className="field"
            name="questTitle"
            placeholder="Quest名（例：ゴルフへの準備）"
            required
            maxLength={100}
          />
          <ConditionEditor conditions={conditions} onChange={setConditions} />
          <textarea
            className="field min-h-24"
            name="rewardMessage"
            placeholder="解放後に現実で行うこと"
            required
            maxLength={500}
          />
          <div className="flex gap-2">
            <button className="button-primary flex-1" disabled={pending}>
              Wishを追加
            </button>
            <button
              className="button-secondary"
              type="button"
              onClick={() => setShowCreate(false)}
            >
              閉じる
            </button>
          </div>
        </form>
      ) : (
        <button
          className="button-primary mt-5 w-full"
          onClick={() => setShowCreate(true)}
        >
          ＋ Wishを追加
        </button>
      )}

      {celebration ? (
        <div
          className="unlock-celebration"
          role="dialog"
          aria-modal="true"
          aria-label="Wish Unlocked"
        >
          <div className="unlock-emblem max-w-md text-center">
            <p className="eyebrow text-[#e7bd6f]">Congratulations!</p>
            <div className="my-5 text-7xl" aria-hidden="true">
              🔓
            </div>
            <h2 className="serif text-3xl font-semibold">{celebration}</h2>
            <p className="mt-2 text-xl font-black tracking-widest text-[#e7bd6f]">
              UNLOCKED
            </p>
            <p className="serif mt-6 leading-8">
              旦那様、お待ちしておりました。現実の扉が開きました。
            </p>
            <button
              className="button-primary mt-7 bg-white text-[#173f35]"
              type="button"
              onClick={() => setCelebration(null)}
            >
              物語へ戻る
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
