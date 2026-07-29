import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page-header";
import { MonthlyReportClient } from "@/components/monthly-report-client";
import Link from "next/link";
import { Suspense } from "react";

export const metadata = { title: "月間レポート" };
export const dynamic = "force-dynamic";

export default function MonthlyReportPage() {
  return (
    <main className="app-shell">
      <PageHeader
        action={<Link className="text-link" href="/reports/weekly">週間へ</Link>}
        description="一か月の変化を、数字と物語の両方から振り返ります。"
        eyebrow="Monthly Chronicle"
        icon="▦"
        title="月間レポート"
      />
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
