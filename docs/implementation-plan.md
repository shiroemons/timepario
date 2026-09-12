# TimePario 実装計画

## コミット時の追記

実装完了後、ユーザーからコミット作成とmainを維持する指示を受けたため、アプリ実装とドキュメントを分けてmainへコミットする。以下の「コミットを行わない」という記録は、実装中の当初方針を示す。push・本番公開は行わない。

## 調査と方針

- 2026-09-12: 既存構成は README.md のみ。main ブランチ、未コミット変更なし。
- ユーザー提供および上位 AGENTS.md を確認。ブランチ作成・コミット・push・本番デプロイは今回行わない。
- 指定された専用 subagent / Sonnet は利用できないため、利用可能なサブエージェントで責務と編集範囲を分離し、メインでレビュー・検証・統合を行う。
- Hono + hono/jsx、Workers Static Assets、TypeScript strict、pnpm、esbuild、Wrangler、Vitest、Playwright を使用。
- 公式ドキュメントとパッケージ公開メタデータで安定版・互換性・ライセンス・サイズを確認する。
- UI は英語。表示ロケールとタイムゾーンを分離し、文言は辞書、製品名は設定に集約する。

## 作業手順と進捗

- [x] 追加依頼: 共有操作を「リンクをコピー」とコピーアイコンで明確化し、成功表示をボタン内へ追加。淡い緑・生成り色へ調整し、日英・スマホ・文字拡大を確認済み。最終E2E333件、単体160件、型チェック・lint・本番ビルドが成功。

- [x] 追加依頼: ウィンドウ内の拡大表示。開始ボタンへの復帰、既存操作・スマートフォン表示を検証済み。
- [x] 追加依頼: PWA manifest・アプリアイコン・Service Worker・オフライン表示・キャッシュ更新。標準インストール要件と実通信遮断からの復帰を検証済み。
- [x] 追加依頼: スマートフォンでは並べ替え矢印が上下、PCでは左右になることを検証済み。
- [x] 追加依頼: OGP・Twitter Card・canonical URL・1200×630共有画像。日英の地域名・説明・絶対URL・画像配信を検証済み。

- [x] リポジトリ・ガイドライン・未コミット変更の確認
- [x] 実装計画の作成
- [x] 公式資料・依存バージョン確認
- [x] shared: URL の一度だけのデコード、検証、正規化、重複除去、候補、Intl による日時計算
- [x] server / scripts: Hono HTML、エラー応答、CSP、静的配信、監視付き開発と本番ビルド
- [x] client: 自動判定、時計更新、最大3時計、検索・操作、履歴同期、共有
- [x] UI: PC 1〜3列、スマートフォンの横並び時計、キーボード操作、拡大表示
- [x] 固定時刻の単体テストと E2E、異常系・DST・履歴・配信の検証
- [x] Chromium / Firefox / WebKit の実行可能性確認とブラウザーテスト
- [x] 指定4サイズ・文字拡大のスクリーンショットを実際に確認し修正
- [x] 型チェック・lint・本番ビルド・gzip サイズ実測
- [x] README と計画に結果・制限・操作コマンドを記録

## 責任範囲と統合契約

- shared 担当: `src/shared/**` と対応する `tests/unit/**`。URL / 日時の純粋関数と候補。
- 基盤担当: package / 設定 / scripts / `src/server/**` / public / サーバー単体テスト。依存導入と lockfile。
- client 担当: `src/client/**` / E2E と Playwright 設定。shared / server 契約に合わせた DOM 操作と CSS。
- メイン: 公式調査、計画、設計契約、レビュー、検証実行、スクリーンショット確認、README、結果統合。他者の変更は戻さない。
- shared API: `Zone { id, timeZone, label, description }`, `parsePath(path): { mode: 'auto' | 'explicit', zones: Zone[], canonicalPath: string }`, `pathForZones(zones): string`, `resolveZone(identifier): Zone`, `getCandidates(): Zone[]`, `zoneFromTimeZone(timeZone): Zone`。不正入力は明確な例外。
- time API: `readClock(now: Date, timeZone: string, locale?: string)` が `{ time, date, offset, hourAngle, minuteAngle, secondAngle }` を返し formatter を再利用。
- 設定 `APP` と辞書 `en` を shared から公開。client 専用の全UI文言は client 辞書にまとめてもよい。
- server は HTML の共通シェルと操作領域・時計カード template を出力。カード構築と更新は client。初期値は `--:--:--`、サーバー時刻は表示しない。
- server/client 詳細 DOM 契約は担当間で確認し、サーバーで検証された zone 情報は安全な HTML data 属性へ渡す。ブラウザーで非対応の zone は個別に表示エラーを示す。
- ハッシュなしの静的ファイルは再検証必須、HTML は no-store。SPA fallback を使わず、不明アセットは404。

## 検証方針

URL・日時は固定入力に対する明示的期待値で検証する。UI は固定時刻・タイムゾーンを設定し、検索・履歴・共有・キーボード・エラー隔離・復帰を検証する。静的配信と CSP は実際の Wrangler サーバーで確認する。画像は `output/playwright/` に保存する。ブラウザー未実行や環境制限は成功扱いにしない。

## 公式資料

- https://hono.dev/docs/getting-started/cloudflare-workers
- https://hono.dev/docs/guides/jsx
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/binding/
- https://developers.cloudflare.com/workers/static-assets/headers/

## 完了結果

最新の拡大表示・PWA・スマホ上下矢印・OGPまで対応済み。単体160件、3ブラウザーのE2E321件（通常機能とPWAの分割実行）、型チェック、lint、本番ビルドが成功。PWAの初回準備・通信遮断・更新失敗を検証し、OGP画像とメタ情報の配信を確認した。最新サイズと実行条件は `verification.md` を参照。以下には前回までの実装経過も残す。

### 追加依頼: 言語・選択候補・文字盤・並べ替え

- [x] 日本語・英語の優先言語判定。サーバーはAccept-Language、ブラウザーはnavigator.languagesを使用。
- [x] UI・日付・地域名・説明・エラー・アクセシビリティ文言を翻訳し、URLの地域や順序を維持。
- [x] Unicode CLDR由来の日本語都市名と別名557識別子を同梱し、取得コミットとライセンスを記録。
- [x] SVGアイコンとラベルの縦中央揃え。
- [x] マウス・タッチ・ペンのドラッグ並べ替え。確定時のみURL・履歴更新。キャンセル・矢印操作を維持。
- [x] 追加依頼: ドラッグ中の浮き上がりと移動先の強調、確定後にカードが収まるアニメーションを追加。動きを減らす設定・キャンセル・連続操作を検証する。
- [x] 追加修正: カードを持ち上げたままポインターへ自由に追従させる。移動中の配置枠・正しい移動先判定・離した位置からの確定演出・2時計と3時計・円状の動き・キャンセルを確認する。
- [x] 追加依頼: 最大化ボタンから全画面の時計表示へ切り替える。PCの1〜3時計を大きく配置し、操作部は無操作時に隠す。Escape・終了ボタン・ネイティブ全画面の解除・非対応時の拡大表示・時刻更新・基準保持・画面サイズを検証済み。
- [x] 追加依頼: 文字盤の数字を中心側へ寄せ、外周との余白を広げる。PC・スマートフォンで数字と目盛りの間隔を確認する。
- [x] 追加依頼: 表示中の時計から比較基準を選び、各カード下部に基準との差を控えめに表示する。UTC表示を維持し、符号・分単位の差・夏時間・基準削除・並べ替えを検証済み。
- [x] 候補一覧の現在のUTCオフセットを右寄せで表示。DST・固定PST・分単位時差に対応。
- [x] 現地の朝・昼・夜を文字盤の色とラベルで表示。
- [x] 追加依頼: 深夜（00:00〜04:59）を夜から分け、日英ラベル・濃い紺色・0時と5時の境界を検証。
- [x] 追加依頼: 昼を12:00〜15:59へ短縮し、夕方（16:00〜18:59）を追加、夜の開始を19:00へ調整。日英ラベル・オレンジ系の文字盤・16時と19時の境界を検証。
- [x] 候補名の括弧付き略称と略称検索。PST/PDTの表示変更時もURL識別子を維持。
- [x] 日英表示・フォールバック・SSR・履歴・指定画面サイズ・200%拡大を検証。
- [x] 型チェック・lint・単体・E2E・ビルド・サイズ確認とREADME・検証記録の更新。

言語担当が辞書・判定・server/client接続・言語テスト、アイコン担当がCSSとSVG専用モジュール、ドラッグ担当がPointer Eventsの並べ替えモジュールとテストを編集する。shell/indexの編集は言語担当へ集約し、他担当は接続仕様を渡す。メインはレビュー・テスト実行・画像確認・記録を担当し、既存の未コミット実装を維持する。

追加依頼を含め単体147件、E2E285件（3ブラウザー各95件、全体実行と修正対象の再実行）、型チェック、Biome、本番ビルドが成功。初期実装時の全依存auditも成功、その後パッケージ変更なし。最終E2Eはminify済み本番JS/CSSで実行し、配信ファイルとのバイト一致も確認した。gzip後JS20,066 bytes、CSS4,326 bytes。詳細は `verification.md`。全画面の設計は `decisions/0003-fullscreen-clocks.md` に記録した。

レビューと実ブラウザー検証で、候補非対応の隔離、大小文字違いの重複、CSPとfaviconの整合、Escape操作、非同期close後のフォーカス競合、IANA別名のruntime差、画面高さ・長文のはみ出し、タブレットでの整列を修正した。Firefoxの時計固定fixtureの競合は初期時刻を60秒前にしてから固定時刻まで進める方式で解消した。

本番公開・実機・スクリーンリーダー音声確認は未実施。ブランチ作成・コミット・push・外部リソース作成は行っていない。
