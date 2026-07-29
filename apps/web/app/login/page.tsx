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
        <div className="login-companion">
          <div className="login-companion__image">
            <img
              alt=""
              fetchPriority="high"
              height="1152"
              src="/images/companions/lucien.webp"
              width="768"
            />
          </div>
          <div>
            <p className="eyebrow">Private entrance</p>
            <h1>お帰りなさいませ</h1>
            <p>今日の物語を、ここから続けましょう。</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
