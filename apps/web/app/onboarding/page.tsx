import { OnboardingForm } from "@/components/onboarding-form";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        description="毎日すべてをする必要はありません。まずは3つ以上選び、今日の小さな流れを作りましょう。"
        eyebrow="Chapter 0"
        icon="✦"
        title="育てたい自分を選ぶ"
      />
      <OnboardingForm />
    </main>
  );
}
