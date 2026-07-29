# プロダクト仕様

原典はリポジトリ直下の
[`jinsei_game_product_spec.md`](../jinsei_game_product_spec.md)とする。

正式ブランド名は**Growlogue（グロウローグ）**、キャッチコピーは
「今日の行動を、成長物語へ。」とする。

## 初期版で固定した判断

- 日本語中心のUIとし、XPや称号など世界観固有語には英語を使用できる。
- 初期世界観は英国紳士、初期利用者は1人とする。
- 1日に基本ミッション3件とボーナスミッション最大2件を表示する。
- 基本3件の達成でDaily Clear、表示された全件の達成でPerfectとする。
- ゲーム内の日付は利用者のタイムゾーンで午前4時に切り替える。
- Daily Clearを連続記録の条件とする。
- 最小達成を評価し、未達成や再開を責めない。

## 初期版の成功条件

本人がログインし、英国紳士の世界観で習慣を選び、今日のミッションを達成するとXP・能力値・連続記録が一貫して更新されること。

## Growlogueの中核: Life Unlocks

Growlogueの報酬はゲーム内アイテムではなく、利用者が現実で実行する人生イベントとする。

利用者は実現したいことをWishとして登録し、複数条件を持つQuestを進める。日々の行動や手入力した事実が条件を満たすとWishがUnlockedになり、Rewardを現実で実行してCompletedにする。

```text
Wish → Quest → Mission / Fact → 能力成長 → Wish Unlocked → Reward
```

Life UnlocksはHabitやXPへ直接依存しない独立ドメインとする。条件評価はCondition EngineがFactを受け取って行い、資格、健康、資産形成、家族、旅行などへ同じ仕組みを再利用できるようにする。

詳細仕様は[`life-unlocks-spec.md`](./life-unlocks-spec.md)を正本とする。

## 週間レポートと共有カード

本人は一週間の達成、XP、Daily Clear、Perfect、能力成長を振り返ることができる。
共有時は本人が許可した集計項目だけをPNGカードにし、非公開R2へ保存する。
共有URLは有効期限付きかつ手動で失効でき、Habit名、Wish、Quest、手入力Fact、
収入、体重、金額、資産、自由記述は共有しない。

詳細仕様は[`share-cards-spec.md`](./share-cards-spec.md)を正本とする。
