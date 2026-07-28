# 実装計画

## Phase 0: 開発基盤

pnpm workspace、Next.js、OpenNext、Cloudflare Workers、D1、Prisma、テスト基盤を構築する。

## Phase 1: 縦切りMVP

認証、オンボーディング、習慣、今日のミッション、XP、能力値、連続記録、ホーム、ステータス、設定を実装する。

## Phase 2: 本人用本番

Cloudflareの対象アカウントを確認し、D1とWorkerを作成して`workers.dev`へ公開する。R2は共有カードを実装するPhase 4で追加する。

## Phase 3: 執事・再開支援・Web Push

- 履歴から決定する執事の機嫌、固定通知テンプレート、休日・体調不良・忙しい日・完全休息を実装する。
- 休息日を挟んだ連続記録を保護し、2日以上空いた最初の達成へ再開ボーナス5 XPを一度だけ付与する。
- 明示操作によるPush購読、Service Worker、15分Cron、最大5件/日、23:30〜08:00の夜間停止を実装する。
- Schedulerは公開HTTP面を持たず、VAPID秘密鍵をWorker Secretとして保持する。

## 完了判定

`pnpm verify`、ローカルD1の統合確認、Cloudflare preview、本番URLでのPC・スマートフォン確認が成功すること。
