import { getCurrentSession } from "@/lib/session";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await getCurrentSession();
  if (session) redirect("/home");

  return (
    <main className="app-shell landing-shell">
      <section className="landing-hero">
        <div className="landing-hero__copy">
          <p className="eyebrow">Your life, your adventure</p>
          <h1>毎日に、<br />経験値を。</h1>
          <p>
            筋トレも、執筆も、英語も、ピアノも。
            すべてをあなた自身の成長物語へ変えるGrowlogue。
          </p>
          <div className="landing-actions">
            <Link className="button-primary no-underline" href="/login">
              物語を始める
            </Link>
            <a className="button-secondary no-underline" href="#how-it-works">
              仕組みを見る
            </a>
          </div>
        </div>
        <div className="landing-hero__art">
          <Image
            alt="英国庭園に立つ白兎の執事Lucien"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 360px"
            src="/images/companions/lucien.webp"
          />
          <span>Lucien</span>
        </div>
      </section>
      <section id="how-it-works" className="mt-16 grid gap-3 sm:grid-cols-3">
        {[
          ["01", "小さく始める", "タイトルだけ、5分だけでも達成。"],
          ["02", "能力へ変える", "行動がXPと能力値になります。"],
          ["03", "明日へ続ける", "執事が喜び、再開を待っています。"]
        ].map(([number, title, text]) => (
          <article className="landing-step" key={number}>
            <p className="text-xs font-black tracking-widest text-[#bd8d39]">{number}</p>
            <h2 className="serif mt-3 text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[#667269]">{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
