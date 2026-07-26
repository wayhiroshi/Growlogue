import { OnboardingForm } from "@/components/onboarding-form";
import { ensureUserFoundation } from "@/lib/game-service";
import { requireSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const metadata = { title: "最初の設定" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await requireSession();
  const profile = await ensureUserFoundation(session.user.id);
  if (profile.onboardingDone) redirect("/home");

  return (
    <main className="app-shell">
      <p className="eyebrow">Chapter 0</p>
      <h1 className="serif text-3xl font-semibold">育てたい自分を選ぶ</h1>
      <p className="mt-3 mb-7 leading-7 text-[#667269]">
        毎日すべてをする必要はありません。まずは3つ以上選び、今日の一歩を作りましょう。
      </p>
      <OnboardingForm />
    </main>
  );
}
