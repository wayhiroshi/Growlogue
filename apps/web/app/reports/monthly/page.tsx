import { AppNav } from "@/components/app-nav";
import { MonthlyReportClient } from "@/components/monthly-report-client";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = { title: "月間レポート" };
export const dynamic = "force-dynamic";

export default function MonthlyReportPage() {
  return (
    <main className="app-shell">
      <p className="eyebrow">Monthly Chronicle</p>
      <div className="flex items-end justify-between gap-4">
        <h1 className="serif text-3xl font-semibold">月間レポート</h1>
        <Link
          className="text-sm font-bold text-[#2f6556] underline"
          href="/reports/weekly"
        >
          週間を見る
        </Link>
      </div>
      <Suspense
        fallback={
          <div className="card my-5 p-5 text-sm text-[#667269]">
            一か月の年代記を読み込んでいます…
          </div>
        }
      >
        <MonthlyReportClient />
      </Suspense>
      <AppNav />
    </main>
  );
}
