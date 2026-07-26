import { LoginForm } from "@/components/login-form";
import { getCurrentSession } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "ログイン" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentSession()) redirect("/home");
  return (
    <main className="app-shell grid min-h-screen content-center">
      <Link href="/" className="mb-8 text-sm font-bold text-[#173f35] no-underline">
        ← トップへ
      </Link>
      <div className="mx-auto w-full max-w-md">
        <p className="eyebrow">Private entrance</p>
        <h1 className="serif mb-6 text-3xl font-semibold">書斎への入口</h1>
        <LoginForm />
      </div>
    </main>
  );
}
