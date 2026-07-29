import { AppNav } from "@/components/app-nav";
import { HabitManager } from "@/components/habit-manager";
import { PageHeader } from "@/components/page-header";
import { ensureUserFoundation, listHabits } from "@/lib/game-service";
import { requireSession } from "@/lib/session";

export const metadata = { title: "習慣" };
export const dynamic = "force-dynamic";

export default async function HabitsPage() {
  const session = await requireSession();
  await ensureUserFoundation(session.user.id);
  const habits = await listHabits(session.user.id);
  return (
    <main className="app-shell">
      <PageHeader
        description="今の自分に必要なものだけを有効に。休止しても、これまでの歩みは残ります。"
        eyebrow="Training menu"
        icon="✓"
        title="習慣を整える"
      />
      <HabitManager habits={habits} />
      <AppNav />
    </main>
  );
}
