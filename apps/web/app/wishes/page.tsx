import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page-header";
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
      <PageHeader
        description="ゲーム内のアイテムではなく、現実で叶えたい出来事を一つずつ解放します。"
        eyebrow="Life Unlocks"
        icon="◇"
        title="人生の解放"
      />
      <div className="page-illustration" aria-hidden="true">
        <img
          alt=""
          height="675"
          loading="lazy"
          src="/images/scenes/life-unlocks-garden.webp"
          width="1200"
        />
        <span>現実の人生が、報酬になる。</span>
      </div>
      <WishManagerLoader wishes={wishes} />
      <AppNav />
    </main>
  );
}
