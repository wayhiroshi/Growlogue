import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page-header";
import { WeeklyReportClient } from "@/components/weekly-report-client";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = { title: "週間レポート" };
export const dynamic = "force-dynamic";

export default function WeeklyReportPage() {
  return (
    <main className="app-shell">
      <PageHeader
        action={<Link className="text-link" href="/reports/monthly">月間へ</Link>}
        description="一週間の歩みを眺め、次の小さな一歩を見つけます。"
        eyebrow="Weekly Chronicle"
        icon="▥"
        title="週間レポート"
      />
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
