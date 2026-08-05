# Growlogue

> 今日の行動を、成長物語へ。

日々の小さな行動をXPと能力値へ変換し、自分自身を主人公として育てる
モバイルファーストの人生RPGです。

Life Unlocksでは、現実で実現したいことをWishとして登録し、複数条件を持つQuestを
達成すると、現実のRewardを解放できます。評価ロジックはHabitやXPから独立した
Condition Engineとして実装しています。

Phase 6の日次レビューは非公開AI Workerへ分離し、本人が明示的に操作した時だけ
匿名化した日次集計を使います。AI未設定・停止時も固定レビューで動作します。

## 必要環境

- Node.js 24.14.0
- pnpm 11.9.0
- Cloudflareアカウント（本番公開時のみ）

## ローカルセットアップ

```bash
pnpm install
cp apps/web/.env.example apps/web/.dev.vars
pnpm db:generate
pnpm db:migrate:local
pnpm dev
```

`apps/web/.dev.vars`の`OWNER_EMAIL`を本人のメールアドレスへ変更し、
`BETTER_AUTH_SECRET`には32文字以上のランダム値を設定します。このファイルはGitの対象外です。

`http://localhost:3000`を開きます。Cloudflare互換ランタイムでの確認は
`pnpm preview`を使用します。

## 環境変数

| 変数 | 必須 | 用途 |
|---|---|---|
| `OWNER_EMAIL` | 必須 | 初回登録を許可する本人メール |
| `BETTER_AUTH_SECRET` | 必須 | セッション署名用Secret（32文字以上） |
| `BETTER_AUTH_URL` | 必須 | 認証APIの公開オリジン |
| `AUTH_EMAIL_FROM` | 必須 | 認証メールのFrom。既定は`Growlogue <growlogue@notify.aether42.com>` |
| `RESEND_API_KEY` | 本番必須 | Growlogue専用・送信限定・`notify.aether42.com`限定のResend Secret |
| `NEXT_PUBLIC_APP_URL` | 必須 | Webアプリの公開オリジン |

AI伴走の環境変数と有効化手順は
[`docs/ai-coach-spec.md`](docs/ai-coach-spec.md)を参照してください。

本番値は`.dev.vars`から転記せず、Workers Secretsへ個別に登録します。

## 検証

```bash
pnpm verify
```

## デプロイ

本番リソースと秘密情報を確認した後に、D1 migrationを適用してからデプロイします。

```bash
pnpm --filter @growlogue/web exec wrangler d1 migrations apply growlogue-db --remote
pnpm deploy:game
pnpm deploy:life-unlocks
pnpm deploy
```

秘密情報はソースや`wrangler.jsonc`に書かず、`wrangler secret put`で登録します。
公開前後の確認事項は[`docs/deployment-runbook.md`](docs/deployment-runbook.md)にまとめています。
