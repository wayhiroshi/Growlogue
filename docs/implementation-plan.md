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

## Phase 4: Life Unlocks

- Wish、Quest、QuestCondition、Reward、ConditionFact、WishEventを追加する。
- HabitやXPと独立したCondition Engineで、総XP、カテゴリXP、連続日数、達成回数、手入力値、金額を評価する。
- Wish追加・編集、複数AND条件、進捗表示、手入力Fact、Unlocked演出、Reward完了、Lucienコメントを実装する。
- HomeへDreamsを追加し、現実の人生イベントをGrowlogueの報酬として見せる。
- 収入、体重、資産などのFactは本人限定とし、共有やAI送信の対象外とする。

## Phase 5以降

- Phase 5の最初の縦切りとして、本人専用の週間レポートを既存D1から都度集計し、
  日別達成、獲得XP、Daily Clear、Perfect、能力XP、連続記録を表示する。
- 共有カード、R2保存、有効期限付きShareLinkは、週間集計の実利用確認後に追加する。
- AI伴走はPhase 6とし、Life Unlocksの実利用を確認してからWish提案とQuest生成を追加する。
- 複数ユーザー、世界観、課金、ネイティブアプリはその後に段階展開する。

## 完了判定

各Phaseで`pnpm verify`、ローカルD1の統合確認、Cloudflare preview、本番URLでのPC・スマートフォン確認が成功すること。
