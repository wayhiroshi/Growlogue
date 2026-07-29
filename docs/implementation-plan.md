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
- 最小達成後の任意追加セットを「もう一巡」として記録し、追加しなくても成功の
  まま、少量XPとLucienの短い反応で自然な継続を支援する。

## Phase 4: Life Unlocks

- Wish、Quest、QuestCondition、Reward、ConditionFact、WishEventを追加する。
- HabitやXPと独立したCondition Engineで、総XP、カテゴリXP、連続日数、達成回数、手入力値、金額を評価する。
- Wish追加・編集、複数AND条件、進捗表示、手入力Fact、Unlocked演出、Reward完了、Lucienコメントを実装する。
- HomeへDreamsを追加し、現実の人生イベントをGrowlogueの報酬として見せる。
- 収入、体重、資産などのFactは本人限定とし、共有やAI送信の対象外とする。

## Phase 5以降

- Phase 5の最初の縦切りとして、本人専用の週間レポートを既存D1から都度集計し、
  日別達成、獲得XP、Daily Clear、Perfect、能力XP、連続記録を表示する。
- 次の縦切りとして、共有範囲を選べるPNGカード、非公開R2保存、
  有効期限付き・失効可能なShareLink、Web Share API導線を追加する。
- Phase 5の第三の縦切りとして、本人専用の月間レポート、月間カレンダー、
  決定的な月間称号、能力XPから選ぶ重点テーマを追加する。重点テーマは
  振り返り表示に限定し、この段階ではXP倍率を変更しない。
- OpenNext Workerの容量を継続的に確保するため、月間レポートのD1集計は
  非公開`growlogue-reports` Workerへ分離し、WebからService Bindingで呼び出す。
- Phase 6の最初の縦切りとして、非公開AI Worker、集計値だけを使うLucienの
  日次レビュー、安全検査、Moderation、決定的フォールバックを追加する。
- AI伴走の日次レビューを本人利用で確認した後、翌日提案と通知文の言い換えへ
  進む。Wish提案とQuest生成はさらに後とし、Condition FactはAIへ送らない。
- 複数ユーザー、世界観、課金、ネイティブアプリはその後に段階展開する。

## 完了判定

各Phaseで`pnpm verify`、ローカルD1の統合確認、Cloudflare preview、本番URLでのPC・スマートフォン確認が成功すること。
