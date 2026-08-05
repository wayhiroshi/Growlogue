import { ResetPasswordForm } from "@/components/reset-password-form";
import Link from "next/link";

export const metadata = { title: "新しいパスワード" };

interface ResetPasswordPageProps {
  searchParams: Promise<{ error?: string; token?: string }>;
}

export default async function ResetPasswordPage({
  searchParams
}: ResetPasswordPageProps) {
  const { error, token } = await searchParams;
  return (
    <main className="app-shell grid min-h-screen content-center">
      <Link className="mb-8 text-sm font-bold text-[#173f35] no-underline" href="/">
        ← トップへ
      </Link>
      <div className="mx-auto w-full max-w-md">
        <ResetPasswordForm invalidToken={error === "INVALID_TOKEN"} token={token} />
      </div>
    </main>
  );
}
