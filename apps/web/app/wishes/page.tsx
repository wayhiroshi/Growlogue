import { AppNav } from "@/components/app-nav";
import { WishManagerLoader } from "@/components/wish-manager-loader";
import { listWishes } from "@/lib/life-unlocks-service";
import { requireSession } from "@/lib/session";

export const metadata = { title: "人生の解放" };
export const dynamic = "force-dynamic";

export default async function WishesPage() {
  const session = await requireSession();
  const wishes = await listWishes(session.user.id);
  return (
    <main className="app-shell">
      <p className="eyebrow">Life Unlocks</p>
      <h1 className="serif text-3xl font-semibold">人生の解放</h1>
      <p className="mt-2 mb-6 text-sm leading-6 text-[#667269]">
        ゲーム内のアイテムではなく、現実で叶えたい出来事を解放します。
      </p>
      <WishManagerLoader wishes={wishes} />
      <AppNav />
    </main>
  );
}
