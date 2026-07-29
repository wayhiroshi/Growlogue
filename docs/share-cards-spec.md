# Phase 5 週間共有カード仕様

## 目的

本人専用の週間レポートから、共有範囲を本人が選んだPNGカードを生成する。
画像は非公開R2へ保存し、有効期限付き・失効可能なURLからだけ閲覧できるようにする。

## 共有できる項目

- 週の期間
- 達成数、獲得XP、達成率、Daily Clear、Perfect
- Lucienの週間コメント
- 能力XP（本人が選択した場合）
- 連続記録（本人が選択した場合）

Habit名、Wish、Quest、手入力Fact、収入、体重、金額、資産、自由記述は共有対象に
含めない。R2バケットは公開せず、WorkerがShareLinkを検証して画像を配信する。

## API

### `GET /api/v1/share-cards?weekStart=YYYY-MM-DD`

- 本人認証必須。
- 指定週の有効な共有リンク、または`null`を返す。

### `POST /api/v1/share-cards`

- 本人認証必須。
- `weekStart`は月曜日、`expiresInDays`は1、7、30のいずれか。
- `includeCategoryXp`と`includeStreak`で共有項目を選択する。
- Browser Run Quick Actionで1200×630pxのPNGを生成し、非公開R2へ保存する。
- 同じ週の以前のリンクは失効させ、新しいShareLinkを返す。

### `POST /api/v1/share-cards/:id/revoke`

- 本人認証必須。
- 本人が所有するShareLinkだけを失効できる。
- 再実行しても失効状態を維持する。

### `GET /share/:token`

- 認証不要。
- tokenのハッシュ、期限、失効状態を検証し、共有ページを返す。
- 無効、期限切れ、失効済みの場合は404を返す。

### `GET /share/:token/image`

- 認証不要。
- ShareLink検証後にR2のPNGをストリーミングする。
- `Cache-Control: private, no-store`とし、失効後の再利用を防ぐ。

## データ

既存の`WeeklyReport`と`ShareLink`を利用する。`WeeklyReport.summaryJson`には共有を
許可した項目だけを固定スナップショットとして保存する。token原文は保存せず、
SHA-256ハッシュだけを`ShareLink.tokenHash`へ保存する。

R2キーは推測不能なUUIDを含める。R2保存とD1更新は分散トランザクションに
できないため、D1失敗時は作成済みR2オブジェクトを削除する。新規作成成功後は、
以前の画像をバックグラウンドで削除する。

## 受入条件

1. 共有カードがPNGで生成され、iPhoneのWeb Share APIから共有できる。
2. 未認証でも有効な共有URLだけを閲覧できる。
3. Habit名とLife Unlocksの非公開Factが画像、HTML、JSONへ含まれない。
4. 期限切れまたは手動失効後は、共有ページと画像の両方が404になる。
5. R2オブジェクトへ直接公開URLではアクセスできない。
6. Browser RunやR2の失敗時も週間レポート本体は利用でき、安全なエラーを表示する。
