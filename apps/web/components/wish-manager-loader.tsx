"use client";

import dynamic from "next/dynamic";
import type { WishView } from "./wish-manager";

const WishManager = dynamic(
  () => import("./wish-manager").then((module) => module.WishManager),
  {
    ssr: false,
    loading: () => (
      <div className="card p-5 text-sm text-[#667269]">
        Dreamsを読み込んでいます…
      </div>
    )
  }
);

export function WishManagerLoader({ wishes }: { wishes: WishView[] }) {
  return <WishManager wishes={wishes} />;
}
