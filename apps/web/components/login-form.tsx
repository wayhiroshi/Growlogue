"use client";

import { authClient } from "@/lib/auth-client";
import Link from "next/link";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "主人公");

    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(
        mode === "sign-up"
          ? "登録できませんでした。所有者メールと12文字以上のパスワードを確認してください。"
          : "ログインできませんでした。入力内容を確認してください。"
      );
      setPending(false);
      return;
    }
    window.location.href = mode === "sign-up" ? "/onboarding" : "/home";
  }

  return (
    <div className="card p-5 sm:p-7">
      <div className="mb-5 grid grid-cols-2 rounded-full bg-[#ece7da] p-1">
        <button
          type="button"
          className={`rounded-full px-3 py-2 text-sm font-bold ${
            mode === "sign-in" ? "bg-white text-[#173f35] shadow-sm" : "text-[#667269]"
          }`}
          onClick={() => setMode("sign-in")}
        >
          ログイン
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-2 text-sm font-bold ${
            mode === "sign-up" ? "bg-white text-[#173f35] shadow-sm" : "text-[#667269]"
          }`}
          onClick={() => setMode("sign-up")}
        >
          初回登録
        </button>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "sign-up" ? (
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold">お名前</span>
            <input className="field" name="name" required maxLength={50} />
          </label>
        ) : null}
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">メールアドレス</span>
          <input className="field" name="email" type="email" required autoComplete="email" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold">パスワード</span>
          <input
            className="field"
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          />
          {mode === "sign-up" ? (
            <span className="mt-1 block text-xs text-[#667269]">12文字以上</span>
          ) : null}
        </label>
        {mode === "sign-in" ? (
          <Link
            className="block text-right text-sm font-bold text-[#173f35]"
            href="/forgot-password"
          >
            パスワードを忘れた方
          </Link>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-xl bg-[#f6e3df] p-3 text-sm text-[#8b3d32]">
            {error}
          </p>
        ) : null}
        <button className="button-primary w-full" disabled={pending}>
          {pending ? "確認中…" : mode === "sign-up" ? "人生ゲームを始める" : "書斎へ入る"}
        </button>
      </form>
    </div>
  );
}
