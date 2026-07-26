"use client";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      className="button-secondary w-full"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = "/";
      }}
    >
      ログアウト
    </button>
  );
}
