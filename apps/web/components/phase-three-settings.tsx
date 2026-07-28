"use client";

import type { DayMode, NotificationLevel } from "@growlogue/domain";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const dayModes: Array<{ value: DayMode; label: string; note: string }> = [
  { value: "NORMAL", label: "通常", note: "いつものミッションと通知" },
  { value: "HOLIDAY", label: "休日", note: "通知はやさしく1回だけ" },
  { value: "SICK", label: "体調不良", note: "休養を優先する日" },
  { value: "BUSY", label: "忙しい", note: "最小の一歩だけ提案" },
  { value: "REST", label: "完全休息", note: "通知なし・連続記録を保護" }
];

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}

export function PhaseThreeSettings({
  initialMode,
  initialNotificationLevel,
  initialQuietHoursStart,
  initialQuietHoursEnd
}: {
  initialMode: DayMode;
  initialNotificationLevel: NotificationLevel;
  initialQuietHoursStart: string;
  initialQuietHoursEnd: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(initialMode);
  const [notificationLevel, setNotificationLevel] = useState(
    initialNotificationLevel
  );
  const [quietHoursStart, setQuietHoursStart] = useState(
    initialQuietHoursStart
  );
  const [quietHoursEnd, setQuietHoursEnd] = useState(initialQuietHoursEnd);
  const [message, setMessage] = useState("");
  const [pushGuide, setPushGuide] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const isIos =
      /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    const supported =
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    const guide =
      isIos && !standalone
        ? "iPhoneではSafariの共有メニューから「ホーム画面に追加」し、「Webアプリとして開く」をオンにしてください。その後、ホーム画面のGrowlogueから開くと通知を有効にできます。"
        : !supported
          ? "この環境ではWeb Pushを利用できません。"
          : "";
    const update = window.setTimeout(() => setPushGuide(guide), 0);
    return () => window.clearTimeout(update);
  }, []);

  async function updateMode(nextMode: DayMode) {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/v1/day-mode", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: nextMode })
    });
    setPending(false);
    if (!response.ok) {
      setMessage("今日のモードを変更できませんでした。");
      return;
    }
    setMode(nextMode);
    setMessage("今日のモードを変更しました。");
    router.refresh();
  }

  async function saveNotificationPreferences() {
    setPending(true);
    setMessage("");
    const response = await fetch("/api/v1/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notificationLevel,
        quietHoursStart,
        quietHoursEnd
      })
    });
    setPending(false);
    setMessage(
      response.ok
        ? "通知の時間設定を保存しました。"
        : "通知設定を保存できませんでした。"
    );
  }

  async function enablePush() {
    if (pushGuide) {
      setMessage(pushGuide);
      return;
    }
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setMessage("この環境ではWeb Pushを利用できません。");
      return;
    }

    setPending(true);
    setMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage("通知が許可されていません。端末の設定をご確認ください。");
        return;
      }
      const [{ publicKey }, registration] = await Promise.all([
        fetch("/api/v1/push/config").then((response) => {
          if (!response.ok) throw new Error("PUSH_CONFIG_FAILED");
          return response.json() as Promise<{ publicKey: string }>;
        }),
        navigator.serviceWorker.register("/sw.js", { scope: "/" })
      ]);
      const ready = await navigator.serviceWorker.ready;
      const existing = await ready.pushManager.getSubscription();
      const subscription =
        existing ??
        (await ready.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        }));
      const response = await fetch("/api/v1/push/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON())
      });
      if (!response.ok) throw new Error("PUSH_SUBSCRIPTION_FAILED");
      await registration.update();
      setMessage("この端末への通知を有効にしました。");
    } catch {
      setMessage("通知を有効にできませんでした。端末の設定をご確認ください。");
    } finally {
      setPending(false);
    }
  }

  async function disablePush() {
    if (!("serviceWorker" in navigator)) {
      setMessage("この端末には通知購読がありません。");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (!subscription) {
        setMessage("この端末には通知購読がありません。");
        return;
      }
      const response = await fetch("/api/v1/push/subscriptions", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });
      if (!response.ok) {
        throw new Error("PUSH_DISABLE_FAILED");
      }
      await subscription.unsubscribe();
      setMessage("この端末への通知を停止しました。");
    } catch {
      setMessage("通知を停止できませんでした。もう一度お試しください。");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="card my-6 p-5">
        <p className="eyebrow">Today&apos;s pace</p>
        <h2 className="serif text-xl font-semibold">今日のモード</h2>
        <div className="mt-4 grid gap-2">
          {dayModes.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={pending}
              onClick={() => updateMode(option.value)}
              className={`flex items-center justify-between gap-4 rounded-xl border p-3 text-left ${
                mode === option.value
                  ? "border-[#173f35] bg-[#edf5ef]"
                  : "border-[#173f3520] bg-white/50"
              }`}
            >
              <strong>{option.label}</strong>
              <span className="text-right text-xs text-[#667269]">
                {option.note}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="card my-6 p-5">
        <p className="eyebrow">Butler notifications</p>
        <h2 className="serif text-xl font-semibold">執事からの通知</h2>
        <label className="mt-4 block text-sm font-bold">
          通知レベル
          <select
            className="field mt-2"
            value={notificationLevel}
            onChange={(event) =>
              setNotificationLevel(event.target.value as NotificationLevel)
            }
          >
            <option value="QUIET">静か（最大1件/日）</option>
            <option value="STANDARD">標準（最大3件/日）</option>
            <option value="ACTIVE">積極的（最大5件/日）</option>
          </select>
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm font-bold">
            夜間停止 開始
            <input
              className="field mt-2"
              type="time"
              value={quietHoursStart}
              onChange={(event) => setQuietHoursStart(event.target.value)}
            />
          </label>
          <label className="text-sm font-bold">
            夜間停止 終了
            <input
              className="field mt-2"
              type="time"
              value={quietHoursEnd}
              onChange={(event) => setQuietHoursEnd(event.target.value)}
            />
          </label>
        </div>
        <button
          className="button-secondary mt-4 w-full"
          type="button"
          disabled={pending}
          onClick={saveNotificationPreferences}
        >
          時間設定を保存
        </button>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            className="button-primary"
            type="button"
            disabled={pending}
            onClick={enablePush}
          >
            この端末で通知を有効にする
          </button>
          <button
            className="button-secondary"
            type="button"
            disabled={pending}
            onClick={disablePush}
          >
            この端末の通知を停止
          </button>
        </div>
        {pushGuide ? (
          <p className="mt-3 rounded-xl bg-[#f1ecdf] p-3 text-sm leading-6 text-[#4f5d54]">
            <strong className="block text-[#173f35]">
              iPhoneで通知を使うには
            </strong>
            {pushGuide}
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-5 text-[#667269]">
          通知許可はボタンを押したときだけ求めます。完全休息日は送信しません。
        </p>
      </section>

      {message ? (
        <p className="card my-4 p-4 text-sm font-bold" role="status">
          {message}
        </p>
      ) : null}
    </>
  );
}
