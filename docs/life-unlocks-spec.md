# Life Unlocks仕様

## 目的

Growlogueを習慣管理アプリではなく、現実の人生をゲームとして前進させるプロダクトにする。

利用者が「実現したい現実の出来事」をWishとして登録し、Quest条件を満たすとRewardがUnlockedになる。Rewardはゲーム内アイテムではなく、旅行、学習、購入、家族イベント、寄付、仕事など、現実で実行する出来事である。

## ドメイン境界

Life UnlocksはHabit、Mission、XPの実装へ直接依存しない。Condition Engineは次の入力だけを扱う。

- 条件定義
- 評価時点のFact
- 条件結合方法

既存の総XP、カテゴリXP、連続日数、達成回数はWeb層のFact Providerが読み取り、共通の`MetricFact`へ変換する。収入、体重、金額、任意変数は`ConditionFact`へ時系列で記録する。

## エンティティ

### Wish

- `id`, `userId`
- `title`, `description`, `category`, `icon`, `priority`
- `status`: `DRAFT | ACTIVE | UNLOCKED | COMPLETED | ARCHIVED`
- `unlockDate`, `completedAt`, `createdAt`, `updatedAt`

### Quest

- `id`, `wishId`
- `title`, `description`, `position`
- `conditionLogic`: MVPでは`ALL`
- 1つのWishに複数Questを設定できる。
- WishはすべてのQuestが完了したとき解放可能になる。

### QuestCondition

- `id`, `questId`
- `metric`, `operator`, `targetValue`
- `baselineValue`, `scopeKey`, `label`, `unit`, `position`

MVPのMetric:

- `TOTAL_XP`
- `CATEGORY_XP`
- `STREAK_DAYS`
- `COMPLETION_COUNT`
- `MANUAL_NUMBER`
- `MONEY_AMOUNT`

MVPのOperator:

- `GTE`
- `LTE`
- `EQ`

### Reward

- `id`, `wishId`
- `rewardType`: MVPでは`REAL_WORLD`
- `message`, `imageKey`
- `unlockedAt`, `completedAt`

### ConditionFact

- `id`, `userId`
- `metric`, `scopeKey`, `value`, `unit`
- `observedAt`, `createdAt`

値を上書きせず観測履歴として追記する。評価には同じMetricとscopeKeyの最新値を使用する。

### WishEvent

- `id`, `userId`, `wishId`
- `eventType`: `UNLOCK | COMPLETE`
- `idempotencyKey`, `createdAt`

UnlockedとCompletedを削除・上書きだけで表現せず、冪等なイベントを残す。

## 状態遷移

```text
DRAFT → ACTIVE → UNLOCKED → COMPLETED
           └──────────────→ ARCHIVED
```

- `ACTIVE → UNLOCKED`: 全Quest完了後の明示的な評価操作だけが許可される。
- `UNLOCKED → COMPLETED`: 利用者が現実のRewardを実行した後に明示する。
- Unlocked後にFactが変化してもロック状態へ戻さない。

## 進捗

- Factが存在しない条件は未達成、進捗0%とする。
- `GTE`: 目標以上で100%。baselineがあればbaselineから目標までを進捗化する。
- `LTE`: 目標以下で100%。baselineがあればbaselineから目標までを進捗化する。
- `EQ`: 一致で100%、それ以外は0%。
- Quest進捗は条件進捗の平均、Wish進捗はQuest進捗の平均とする。
- UnlockedまたはCompletedのWishは常に100%表示する。

## API

### Wish

- `GET /api/v1/wishes`
- `POST /api/v1/wishes`
- `PATCH /api/v1/wishes/:id`
- `POST /api/v1/wishes/:id/quests`

### Factと状態遷移

- `POST /api/v1/wishes/:id/facts`
- `POST /api/v1/wishes/:id/evaluate`
- `POST /api/v1/wishes/:id/complete`

`evaluate`と`complete`は`Idempotency-Key`必須とする。すべてのAPIはセッションの`userId`で所有者を限定し、他人のIDを404として扱う。

## MVP UI

- Homeに最優先のACTIVE WishをDreamsカードとして表示する。
- `/wishes`でWish一覧、進捗、Quest条件、Lucienコメントを表示する。
- Wish作成時にRewardと最初のQuest、複数AND条件を一緒に設定できる。
- 手入力条件は値を追記できる。
- 条件達成後に「解放する」を表示し、Unlocked演出を行う。
- 現実でRewardを実行した後に「人生で実行した」を押してCompletedにする。

## プライバシー

- 収入、体重、資産、金額、任意変数のFactは本人専用とする。
- Factの値を通知ログ、共有カード、公開リンク、AI入力へ含めない。
- APIエラーとWorkers LogsへWish本文やFact値を出さない。

## API受入条件

1. 未認証は401、別ユーザーのWish IDは404になる。
2. 無効なMetric、Operator、範囲外数値、空条件は400になる。
3. 1つのWishへ複数AND条件を保存し、再読込後も同じ順序で取得できる。
4. Factがない条件は未達成となり、最新Factで進捗が再計算される。
5. 総XP、カテゴリXP、連続日数、達成回数を既存テーブルからFactとして評価できる。
6. 全Quest完了前のunlockは409、完了後はUnlockedになる。
7. 同じ`Idempotency-Key`を再送してもWishEventは1件だけになる。
8. Unlocked後にFactが低下してもACTIVEへ戻らない。
9. Completed操作はUnlocked後だけ許可され、RewardとWishの完了時刻が一致する。
10. 本番移行後も既存User、Mission、XP、Streak、Pushデータの件数と値が変わらない。
