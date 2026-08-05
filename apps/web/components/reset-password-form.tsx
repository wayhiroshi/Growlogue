"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useState, type FormEvent } from "react";

interface ResetPasswordFormProps {
  token: string | undefined;
  invalidToken: boolean;
}

export function ResetPasswordForm({
  token,
  invalidToken
}: ResetPasswordFormProps) {
  const [pending, setPending] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    if (newPassword !== confirmPassword) {
      setError("確認用パスワードが一致しません。");
      setPending(false);
      return;
    }

    const result = await authClient.resetPassword({ newPassword, token });
    setPending(false);
    if (result.error) {
      setError("リンクが無効または期限切れです。再設定メールをもう一度送ってください。");
      return;
    }
    setComplete(true);
  }

  if (complete) {
    return (
      <div className="card p-5 sm:p-7">
        <p className="eyebrow">Password updated</p>
        <h1 className="mb-3 text-2xl font-bold">再設定が完了しました</h1>
        <p className="text-sm leading-7 text-[#667269]">
          新しいパスワードで、もう一度ログインしてください。
        </p>
        <Link className="button-primary mt-6 flex justify-center" href="/login">
          ログインする
        </Link>
      </div>
    );
  }

  if (!token || invalidToken) {
    return (
      <div className="card p-5 sm:p-7">
        <h1 className="mb-3 text-2xl font-bold">リンクを利用できません</h1>
        <p className="text-sm leading-7 text-[#667269]">
          再設定リンクが無効または期限切れです。新しいリンクを発行してください。
        </p>
        <Link className="button-primary mt-6 flex justify-center" href="/forgot-password">
          再設定メールを送る
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-7">
      <h1 className="mb-2 text-2xl font-bold">新しいパスワード</h1>
      <p className="mb-6 text-sm leading-7 text-[#667269]">
        12文字以上の新しいパスワードを設定してください。
      </p>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">新しいパスワード</span>
          <input
            autoComplete="new-password"
            className="field"
            minLength={12}
            name="newPassword"
            required
            type="password"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">新しいパスワード（確認）</span>
          <input
            autoComplete="new-password"
            className="field"
            minLength={12}
            name="confirmPassword"
            required
            type="password"
          />
        </label>
        {error ? (
          <p className="rounded-xl bg-[#f6e3df] p-3 text-sm text-[#8b3d32]" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button-primary w-full" disabled={pending}>
          {pending ? "更新中…" : "パスワードを更新する"}
        </button>
      </form>
    </div>
  );
}
