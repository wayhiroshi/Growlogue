# Growlogue UI/UX Delight Review

更新日: 2026-07-30

## 結論

Growlogueが「触って楽しい」アプリになるための中心は、演出の量ではなく、利用者の行動にLucienと世界が短く、確実に応答することである。

優先順位は次の通り。

1. ミッション達成直後の応答を100ms以内に見せる
2. Lucienの表情とポーズを達成状況へ連動させる
3. Daily ClearとPerfectだけを明確な祝福の節目にする
4. 休息、未達、再開も肯定的な物語として扱う
5. 動き、音、触覚は短く、任意で、スキップ可能にする

常時動く画面や、報酬画面を何枚も通過させる設計にはしない。日常的な操作は静かに速く、大切な節目だけ豊かにする。

## 現状評価

### 良い点

- ホームの主役がLucien、次に今日のミッションという順序になっている
- 基本3件とボーナス2件を時系列として読み取れる
- タップ領域が大きく、モバイルで横スクロールがない
- 休息日や体調不良モードがあり、未達を責めない土台がある
- Life Unlocksによって、XPが現実の出来事へつながる

### まだ弱い点

- 達成ボタンを押してから再読込されるまで、操作が成功した実感が弱い
- XP、能力値、Lucienの反応が一つの因果として見えない
- Daily ClearとPerfectの節目が通常達成とほぼ同じ強度
- 読み込み中やWish未登録時の画面が静的で、世界観から切れる
- Lucienへ直接触れる行為がなく、相棒というより情報カードに近い

## 推奨する体験設計

### P1 — 一回のタップを気持ちよくする

- ミッションを押した瞬間にチェックへ変える楽観的更新
- 120〜180msの軽い押し込みと復元
- `+10 XP`が一度だけ浮かび、上部のXPへ吸収される
- API失敗時は元へ戻し、「もう一度」を同じ場所に表示
- 5秒間だけ取り消し可能なトーストを出す
- Lucien画像を現在のMoodへ300ms以内でクロスフェード

完了条件:

- タップから視覚応答まで100ms未満
- アニメーションを待たずに次のミッションを操作できる
- VoiceOverでは同じ結果を`aria-live`で伝える

### P1 — 節目だけを祝う

- 通常達成: チェック、XP、Lucienの小さな反応
- Daily Clear: Lucienが一礼し、短い光の演出
- Perfect: 翼を広げる専用ポーズと1秒程度の祝福
- レベルアップ／Wish Unlock: 全画面演出を許可するが、タップで即スキップ可能

毎回紙吹雪を出すと、重要な達成の価値が下がる。演出の階層を守る。

### P1 — 休息と再開をゲームの成功状態にする

- 体調不良／完全休息では「守れた一日」として扱う
- 3日以上空いた復帰日は、連続記録ではなく「帰還」を祝う
- Lucienの心配、孤独、拗ねは罪悪感ではなく、紅茶、読書、軽い喜劇で表現する
- 比較対象は他人ではなく、本人の過去だけにする

### P2 — Lucienを触れる相棒にする

- Lucienをタップすると、表情が変わり一言だけ返す
- 一日に3〜5種類まで。連打しても報酬は増やさない
- 朝、昼、夜、天候ではなくゲーム内状態に合わせて庭園の光を変える
- 衣装や小物は実績で増やせるが、日課を妨げるショップ導線にはしない

### P2 — 待ち時間と空状態も世界観に入れる

- スピナーではなく、庭園の道や本のページを使ったスケルトン表示
- Wish未登録時は庭園の門と「最初の行き先を決める」ボタンを表示
- レポート未生成時はLucienが記録帳を準備している絵を表示
- 画像は初回表示に必要な1枚だけ先読みし、他のMood画像は遅延読込する

### P2 — 音と触覚

- 通常達成は短い選択フィードバック
- Daily Clearは一度だけ成功フィードバック
- 音、触覚は設定で個別に無効化できる
- Web Pushの通知音とは分離する

Appleは、触覚を視覚・音と組み合わせ、原因と結果が明確な短いイベントに限定し、無効化可能にすることを推奨している。

## アクセシビリティと安全策

- `prefers-reduced-motion`では移動・拡大をやめ、色と不透明度だけにする
- 操作対象は原則44×44 CSS px以上
- 色だけで完了、失敗、Moodを区別しない
- フォーカスが下部ナビや固定トーストに隠れないようにする
- ドラッグ操作を追加する場合も、タップ操作の代替を必ず残す
- 長い演出はタップで中断可能にする
- Streak喪失、期間限定報酬、通知で不安を煽らない

参考:

- [Apple Human Interface Guidelines — Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Apple Human Interface Guidelines — Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## 参考にするアプリ／サイト

### Bears Gratitude

[Apple Design Award紹介](https://developer.apple.com/news/?id=i74v3f4r)

2024 Apple Design Award「Delight and Fun」受賞。手描きキャラクターを装飾ではなく、体験全体の設計軸にしている。利用者が最初に行う順番どおりにプロダクトを設計し、カードをめくる単純な操作自体を楽しさにしている。

Growlogueで採用する点:

- 「アートが体験の中心」という考え方
- 一画面一目的
- 小さな達成をキャラクターが祝う

### Gentler Streak

[Apple Behind the Design](https://developer.apple.com/news/?id=3m0ht22s)  
[公式サイト](https://gentler.app/)

2024 Apple Design Award「Social Impact」受賞。強く追い込むのではなく、その日の能力に合わせて導き、休息も継続の一部として扱う。比較ではなく本人の履歴を基準にする。

Growlogueで採用する点:

- 完全休息を失敗にしない
- 数字に説明と感情的な意味を添える
- Moodと提案を本人の状態へ合わせる

### Structured

[公式サイト](https://structured.app/)  
[App Store](https://apps.apple.com/us/app/structured-daily-planner-todo/id1499198946)

一日の予定を一本の視覚的タイムラインへ集約し、色とアイコンで判断負荷を下げる。VoiceOver、Voice Control、読みやすいフォントなどの対応も明示している。

Growlogueで採用する点:

- 今日の流れを一目で把握できる構造
- 基本とボーナスの階層
- 色、アイコン、文字の三重符号化

### Finch

[公式Feature Guide](https://help.finchcare.com/hc/en-us/categories/37934152903309-Finch-Features)  
[公式New User Guide](https://help.finchcare.com/hc/en-us/articles/42149821015693-New-User-Guide)

相棒、季節イベント、Micropet、Quest、Pause Modeなどで再訪理由を作る。公式ガイドでも、Streakは完璧さではなく穏やかな継続のためと説明している。

Growlogueで採用する点:

- 相棒の表情、ポーズ、衣装の変化
- Pause／再開支援
- 数日ごとの小さな発見

採用しない点:

- 日課より収集やショップが主役になる設計
- 期間限定報酬による取り逃し不安

### Waterllama

[公式サイト](https://waterllama.com/)

入力結果がキャラクターの満ち具合として即時に見え、45種類のキャラクターと短期Challengeで単純な記録を楽しくしている。

Growlogueで採用する点:

- 操作結果を大きな視覚変化で返す
- 相棒を選べる楽しさ
- 小さく明確なChallenge

### Duolingo

[Apple — Behind the Design](https://developer.apple.com/news/?id=jhkvppla)  
[公式Streak Animation解説](https://blog.duolingo.com/streak-milestone-design-animation/)

キャラクターの物語とアニメーションを一貫させ、Streak達成の演出改善が新規利用者の7日後継続率を1.7%高めたと公式に報告している。

Growlogueで採用する点:

- キャラクター設定の一貫性
- 行動直後の短い祝福
- 節目ごとに強度を変える

採用しない点:

- 完了後に複数の報酬画面を連続させる
- Streakや通知による罪悪感

### Apple Design Awards 2026

[2026 Winners and Finalists](https://developer.apple.com/design/awards/)

最新の「Delight and Fun」「Interaction」受賞作は、機能量より、短い日常体験の独自性と、説明なしでも理解できる操作を高く評価されている。Growlogueもゲーム機能を増やす前に、毎日の5回のタップを磨くべきである。

## 計測する指標

- ミッションのタップから視覚応答までの時間
- 1日目、7日目、30日目の再訪率
- Daily Clear到達率とPerfect到達率
- 3日以上離れた後の再開率
- Lucienをタップした利用者の翌日再訪率
- Reduce Motion、音、触覚を無効にした割合
- 演出をスキップした割合

最重要指標はStreakの長さではなく、「現実の行動が続いた日数」と「離れても再開できた割合」とする。
