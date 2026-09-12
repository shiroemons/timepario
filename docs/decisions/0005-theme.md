# ADR 0005: テーマ切り替え

## 方針

- ライト・ダーク・システムの3択。初期値はシステム設定に従う。
- システム選択中はOSの配色変更へ追従。手動選択中は指定した配色を維持する。
- テーマだけを端末のlocalStorageに保存。時計の地域・順序は従来どおりURLで保持する。
- ストレージが利用できなくても、現在のページではテーマを切り替えられる。
- 保存値は初回描画前に適用する。CSPを緩めず、同一オリジンの外部スクリプトを使う。
- テーマ用アセットもバージョン管理・PWAプリキャッシュ・配信容量の計測対象に含める。初回描画用スクリプトは独立した1 KiB gzip枠で管理する。
- 文字盤の時間帯を表す色と、拡大・全画面表示の暗い背景は維持する。
- 「システム」はモニター、「ライト」は太陽、「ダーク」は月のアイコンで示し、各ボタンに日本語・英語のアクセシブル名を付ける。

## 参照

- [MDN: light-dark()](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark)
- [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme)
