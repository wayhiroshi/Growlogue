# 実装計画

## Phase 0: 開発基盤

pnpm workspace、Next.js、OpenNext、Cloudflare Workers、D1、Prisma、テスト基盤を構築する。

## Phase 1: 縦切りMVP

認証、オンボーディング、習慣、今日のミッション、XP、能力値、連続記録、ホーム、ステータス、設定を実装する。

## Phase 2: 本人用本番

Cloudflareの対象アカウントを確認し、D1・R2・Workerを作成して`workers.dev`へ公開する。

## 完了判定

`pnpm verify`、ローカルD1の統合確認、Cloudflare preview、本番URLでのPC・スマートフォン確認が成功すること。
