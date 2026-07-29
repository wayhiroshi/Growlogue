import { AppNav } from "@/components/app-nav";
import { CompanionSelector } from "@/components/companion-selector";
import { PageHeader } from "@/components/page-header";
import { PhaseThreeSettings } from "@/components/phase-three-settings";
import { SignOutButton } from "@/components/sign-out-button";
import {
  ensureUserFoundation,
  getTodayMode,
  listCompanions
} from "@/lib/game-service";
import { requireSession } from "@/lib/session";
import type { NotificationLevel } from "@growlogue/domain";

export const metadata = { title: "設定" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  const profile = await ensureUserFoundation(session.user.id);
  const [todayMode, companionData] = await Promise.all([
    getTodayMode(session.user.id),
    listCompanions(session.user.id)
  ]);
  return (
    <main className="app-shell">
      <PageHeader
        description="一日の過ごし方と、そばで見守る相棒を整えます。"
        eyebrow="Preferences"
        icon="◉"
        title="設定"
      />
      <section className="settings-list">
        {[
          ["アカウント", session.user.email],
          ["世界観", "英国紳士"],
          ["タイムゾーン", profile.timezone],
          ["1日の切替", `午前${profile.resetHour}時`],
          ["通知レベル", profile.notificationLevel]
        ].map(([label, value]) => (
          <div className="flex items-center justify-between gap-4 p-4" key={label}>
            <span className="text-sm font-bold">{label}</span>
            <span className="text-right text-sm text-[#667269]">{value}</span>
          </div>
        ))}
      </section>
      <CompanionSelector
        companions={companionData.characters}
        initialCharacterId={companionData.selectedCharacterId}
      />
      <PhaseThreeSettings
        initialMode={todayMode.mode}
        initialNotificationLevel={
          profile.notificationLevel as NotificationLevel
        }
        initialQuietHoursStart={profile.quietHoursStart}
        initialQuietHoursEnd={profile.quietHoursEnd}
      />
      <SignOutButton />
      <AppNav />
    </main>
  );
}
