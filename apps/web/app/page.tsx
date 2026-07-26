import { getCurrentSession } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await getCurrentSession();
  if (session) redirect("/home");

  return (
    <main className="app-shell flex min-h-screen flex-col justify-center">
      <p className="eyebrow">Your life, your adventure</p>
      <h1 className="serif max-w-xl text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
        毎日に、
        <br />
        経験値を。
      </h1>
      <p className="mt-5 max-w-lg text-base leading-8 text-[#667269] sm:text-lg">
        筋トレも、執筆も、英語も、ピアノも。
        すべてを一人の主人公を育てる行動へ変える、あなただけのGrowlogue。
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link className="button-primary min-w-44 no-underline" href="/login">
          ゲームを始める
        </Link>
        <a className="button-secondary no-underline" href="#how-it-works">
          仕組みを見る
        </a>
      </div>
      <section id="how-it-works" className="mt-16 grid gap-3 sm:grid-cols-3">
        {[
          ["01", "小さく始める", "タイトルだけ、5分だけでも達成。"],
          ["02", "能力へ変える", "行動がXPと能力値になります。"],
          ["03", "明日へ続ける", "執事が喜び、再開を待っています。"]
        ].map(([number, title, text]) => (
          <article className="card p-5" key={number}>
            <p className="text-xs font-black tracking-widest text-[#bd8d39]">{number}</p>
            <h2 className="serif mt-3 text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#667269]">{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
