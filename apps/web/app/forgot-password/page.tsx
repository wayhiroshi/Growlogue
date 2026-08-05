import { ForgotPasswordForm } from "@/components/forgot-password-form";
import Link from "next/link";

export const metadata = { title: "パスワード再設定" };

export default function ForgotPasswordPage() {
  return (
    <main className="app-shell grid min-h-screen content-center">
      <Link className="mb-8 text-sm font-bold text-[#173f35] no-underline" href="/">
        ← トップへ
      </Link>
      <div className="mx-auto w-full max-w-md">
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
