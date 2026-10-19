# Unity Web版

Reactの画面・対局管理・ルール・棋譜・モデル・アニメーションと、RustのWASM探索エンジンを再利用し、GPU描画をUnityへ置き換えるWeb版です。Unity 6000.5.8f1 + WebGL Build Supportを使用します。

この構成はブラウザで動きます。Reactが必要なので、Unity EditorのPlayボタンやmacOS/iOS/Androidの単独アプリとして対局する構成ではありません。

## ビルド・起動

```sh
npm ci
npm run unity:build
npm run unity:preview
```

<http://127.0.0.1:4174/> を開きます。成果物は `dist-unity/`。HTML、Reactのassets、UnityBuildの全ファイルを一緒に配信します。既存の通常Web版は `npm run dev` / `npm run build` で起動・ビルドできます。

Unityの実行ファイルが標準位置にない場合:

```sh
UNITY_EDITOR="/path/to/Unity" npm run unity:build
```

Unity C#やシェーダーに変更がなく、React側だけ再ビルドする場合:

```sh
npm run unity:build -- --reuse
```

開発時は、一度ビルドしてから通常のVite開発サーバーのURLに `?renderer=unity` を付けてもUnity描画を選べます。

表示の検証には、棋譜一覧から `docs/fixtures/unity-smoke.json` を読み込めます。ルールエンジンで検証した15手で、配置・移動・捕食・ペンギンの変身・シャチの回転・王の捕食まで再生できます。

## 所有者と接続

- `src/scene/GameCanvas.tsx`: 描画バックエンドを選ぶ唯一の入口。通常版はThree.js、Unity版はUnityRendererを使用。
- `src/unity/UnityRenderer.ts`: React Three Fiberのrenderer契約を実装。Reactによるポインター入力・レイキャストと、既存モデル・アニメーションの更新を継続。
- `src/unity/SceneEncoder.ts`: 描画済みシーングラフから形状・マテリアル・座標の差分を生成。形状は初回と追加時に転送し、削除時にUnity側のリソースも解放。
- `src/unity/protocol.ts` / `unity/Assets/Runtime/RenderProtocol.cs`: 描画専用のJSON契約（version 1）。ゲームの合法手・危険マスなどをUnityで再計算しない。
- `unity/Assets/Runtime/SceneRenderer.cs`: カメラの投影を合わせ、Unityでメッシュと影を描画。左右の座標系変換をこの境界に集約。
- `unity/Assets/Shaders/`: Unity用の動物・ガイド・海のシェーダー。モデル形状や動きはTSX側の既存定義が所有。
- `scripts/build-unity.mjs`: Unity Editorのバッチビルド→ビルド情報の生成→ReactのUnity版ビルドを実行。

React UI・保存・リプレイ・効果音・成り選択・手番制御・TypeScriptルール・AI Worker・Rustソース・同梱Rust WASMは既存実装を共用します。AIをC#へ書き直したり、Unityのメインスレッドへ移したりしません。

## 描画上の違いと配信

Unityは独自のライティング・材質シェーダーで描くため、Three.js版と光沢や明るさが完全には一致しません。Dreiの環境マップ生成はUnityの照明へ置き換え、海の波は既存シェーダーの式をUnity用に移しています。

これはUnity + Reactの複合Webビルドです。Unityが生成した `.data` / `.wasm` だけを投稿してもReact側は起動しません。unityroomなどUnity単体のアップロード形式を使う場合は、その配信方式へReact側も同梱する対応が別途必要です。

Unityの生成物はGitへ入れません。プロジェクト設定・ソース・メタファイルをコミットし、`unity:build` で再生成します。Unityのログは `unity/BuildLogs/webgl.log` に残ります。
