import { AppNav } from "@/components/app-nav";
import { WeeklyReportClient } from "@/components/weekly-report-client";
import { Suspense } from "react";

export const metadata = { title: "週間レポート" };

export default function WeeklyReportPage() {
  return (
    <main className="app-shell">
      <p className="eyebrow">Weekly Chronicle</p>
      <h1 className="serif text-3xl font-semibold">週間レポート</h1>
      <Suspense
        fallback={
          <div className="card my-5 p-5 text-sm text-[#667269]">
            一週間の歩みを読み込んでいます…
          </div>
        }
      >
        <WeeklyReportClient />
      </Suspense>
      <AppNav />
    </main>
  );
}
