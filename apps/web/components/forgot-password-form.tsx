"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const result = await authClient.requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`
    });

    setPending(false);
    if (result.error) {
      setError("送信できませんでした。しばらく待ってから、もう一度お試しください。");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card p-5 sm:p-7">
        <p className="eyebrow">Message sent</p>
        <h1 className="mb-3 text-2xl font-bold">メールをご確認ください</h1>
        <p className="text-sm leading-7 text-[#667269]">
          登録済みのメールアドレスであれば、再設定リンクを送信しました。リンクは1時間有効です。
        </p>
        <Link className="button-primary mt-6 flex justify-center" href="/login">
          ログインへ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-7">
      <h1 className="mb-2 text-2xl font-bold">パスワードを再設定</h1>
      <p className="mb-6 text-sm leading-7 text-[#667269]">
        登録したメールアドレスへ、再設定用のリンクをお送りします。
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">メールアドレス</span>
          <input
            autoComplete="email"
            className="field"
            name="email"
            required
            type="email"
          />
        </label>
        {error ? (
          <p className="rounded-xl bg-[#f6e3df] p-3 text-sm text-[#8b3d32]" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button-primary w-full" disabled={pending}>
          {pending ? "送信中…" : "再設定メールを送る"}
        </button>
      </form>
      <Link className="mt-5 block text-center text-sm font-bold text-[#173f35]" href="/login">
        ログインへ戻る
      </Link>
    </div>
  );
}
