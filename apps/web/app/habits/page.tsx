import { AppNav } from "@/components/app-nav";
import { HabitManager } from "@/components/habit-manager";
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
      <p className="eyebrow">Training menu</p>
      <h1 className="serif text-3xl font-semibold">習慣を整える</h1>
      <p className="mt-2 mb-6 text-sm leading-6 text-[#667269]">
        今の自分に必要なものだけを有効にします。休止しても履歴は残ります。
      </p>
      <HabitManager habits={habits} />
      <AppNav />
    </main>
  );
}
