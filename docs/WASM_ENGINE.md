# Rust / WebAssembly AIエンジン

AIの計算は全レベルでRustのWASMモジュールを使う。Reactは対局と画面の状態を所有し、Workerへ直列化可能な局面・難易度・シード・局面履歴を渡す。WorkerはWASMを読み込み、Rust内で合法手生成から探索まで実行する。返された指し手は既存の`useMatch`で再検証してから適用する。

## 責務

- `rust/azarashi-engine/src/model.rs`: 固定長の局面、駒、捕食ビット集合、局面ハッシュ。
- `rules.rs`: 占有マス、移動、隣接配置、捕食、変身、勝敗、局面の適用。
- `evaluation.rs`: 駒・持ち駒・行動範囲・王と他の駒への脅威を評価。
- `search.rs`: 反復深化、αβ/PVS、局面・評価キャッシュ、静かな手の優先順位、捕食延長、繰り返し回避、期限管理。
- `wire.rs`: 既存のTypeScript契約と内部の固定長データの変換、診断用プレビュー出力。
- `lib.rs`: メモリーの所有と小さなWASM ABI。
- `src/ai/wasmClient.ts`: バッファーの確保・解放、リクエスト生成、ルールバージョン照合。
- `src/ai/wasmRuntime.ts`: Viteが同梱するWASMの読み込み。MIMEが適切でない静的ホストでは通常のコンパイルへ切り替える。
- `src/ai/worker.ts`: 進捗と結果を既存のWorkerプロトコルへ戻す。

難易度・思考時間・評価用の駒の価値は既存の`LEVELS`と`DEFINITIONS`を所有者とし、リクエストでRustへ渡す。Rust側に別のレベル表を持たない。TypeScriptの探索は`src/ai/reference/`に置き、比較検証だけに使う。本番Workerは参照実装を読み込まない。

## 境界と中断

入力はUTF-8 JSONを1回だけ渡す。探索の各ノードでJavaScriptのルールを呼び出さず、時計の確認を64ノード単位にまとめる。探索深さが確定した時だけ`search_progress`で進捗を通知する。

`engine_alloc`の返す領域にリクエストを書き、`engine_search`を呼ぶ。返り値の64ビット整数は上位32ビットが結果のポインター、下位32ビットが長さ。呼び出し側は入力・結果とも`engine_free`で1度ずつ解放する。WASMのメモリー拡張後に古いArrayBufferを使わない。

新規対局・観戦の一時停止・リプレイ表示で、従来どおりWorker全体を終了する。思考中のWASMも中断される。以前のWorkerの返答は適用しない。WASMの読み込みに失敗した場合はNPCの再試行を案内する。

## ビルドと配布

```sh
npm run wasm:build
npm run test:rust
npm test
npm run build
```

Rustは`rust-toolchain.toml`、crateは`Cargo.lock`で固定。release/LTOで`wasm32-unknown-unknown`向けにビルドし、`src/ai/wasm/`へコピーする。生成済みWASMもコミットし、Node/npmだけの環境でも通常のWebビルドができるようにする。

`build.json`はRustソース、依存関係ロック、toolchainのハッシュと、WASM本体のハッシュを記録する。`predev`・`prebuild`・`pretest`が整合性をチェックする。Rustのルール変更時はTypeScript側のルールと`RULES_VERSION`も確認し、両実装の差分検証を通してからWASMを更新する。

本番ビルドはWASMをハッシュ付き静的ファイルとして`dist/assets/`へ出力する。配布時は`dist/`全体を使う。

## 検証と測定

`wasm.test.ts`は実際のコンパイル済みWASMをNodeで読み込み、TypeScript版と全合法手・捕食対象・占有範囲・局面適用・評価を比較する。両側、全種類、シャチのL字捕食と成りの接触条件、両王同時捕食、味方の捕食、ジェット停止、シード付きの実局面を含む。王の退避、繰り返し回避、期限、連続呼び出しも確認する。

```sh
npm run benchmark:ai
```

初期局面、同じシード、同じ評価、深さ2、捕食延長0、時間切れなしで比較する。測定前に両実装の探索深さとスコアが一致することを確認する。測定は1局面のCPU処理時間であり、すべての局面や実機で同じ倍率になるわけではない。通常の難易度設定は時間を上限とするため、高速化した分は同じ時間内でより多くの候補を読むことに使う。

2026-10-17のローカル計測（Node 25.8.2 / arm64 / Rust release）:

| 実装 | 深さ | 探索ノード | 評価値 | 平均時間 |
| --- | ---: | ---: | ---: | ---: |
| TypeScript参照実装 | 2 | 386 | 3.099999999994168 | 76.7952 ms |
| Rust / WASM | 2 | 386 | 3.099999999994168 | 0.3015 ms |

この条件では約255倍の速度差となった。WASMの初回ダウンロード・コンパイル時間、描画、移動アニメーションは測定に含めない。JSONによる入出力はWASM側の測定にも含む。
