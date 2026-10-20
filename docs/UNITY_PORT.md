# Unity版

Unity 6000.5.8f1 + WebGL Build Supportを使用する、Unity単体のゲームです。UIはUnity UI Toolkit、対局管理・入力・アニメーションはC#で実装しています。ブラウザでReactのUIを重ねる構成は廃止しました。

## ビルド・起動

```sh
npm ci
npm run unity:build
npm run unity:preview
```

<http://127.0.0.1:4174/> を開きます。成果物は `dist-unity/` です。Unityが生成するHTML・Build・StreamingAssetsを一緒に配信します。Unity Editorのバージョンは `unity/ProjectSettings/ProjectVersion.txt` から読み、Windows/macOSの標準のHubインストール先を使用します。別の場所は `UNITY_EDITOR=/path/to/Unity` で指定できます。WindowsのPowerShellでは `$env:UNITY_EDITOR = 'C:\path\to\Unity.exe'` を使います。

Windows/macOSとも、ビルド前の検証に使うRustネイティブライブラリーを自動ビルドします。指定されたRust toolchainが必要で、WindowsではMSVC C++ Build ToolsとWindows SDKも必要です。Cargoの場所は `CARGO`、または `CARGO_HOME` で指定できます。元のWASMは引き続き共用し、Rustのルール・探索は変更しません。ソースの鮮度チェックではパス区切りを `/`、テキストの改行をLFとして扱い、WindowsのCRLFチェックアウトだけで不一致にならないようにしています。

`unity:build -- --reuse` は既存のUnity出力をコピーし直すだけです。ソース変更後は通常のビルドを実行してください。通常のReact版は `npm run dev` / `npm run build` で継続して利用できます。

## コードの再利用と責務

- **モデルと見た目の定義:** `scripts/export-unity-assets.tsx` が既存のTSXモデル・氷の盤面・アイコン・配色・照明・駒説明・AI難度設定をUnityアセットへ書き出します。ReactとThree.jsはこのビルド工程で使用し、Unity版の実行時には読み込みません。
- **描画:** `SceneRenderer` が出力されたメッシュ・材質を読み込みます。座標系の反転はこの境界で処理し、元Three r180のGGX・clearcoat・環境照明・ACESと、RGBA深度のPCFSoftをUnity用シェーダーへ移植しています。盤面・図鑑の影の投影とbiasも元の光源から出力します。GPU・文字描画を含むピクセル単位の完全一致を保証するものではありません。
- **合法手とAI:** 元のRustエンジンを共用します。WebGLでは同じWASMのルールAPIを呼び、探索はWeb Workerで行います。Editorでは同じRustコードをdylibとして呼びます。探索・評価・ルールのアルゴリズムをC#へ移植していません。Rust側の変更はネイティブ呼出用C ABIと計時・中断の接続です。
- **対局管理:** `NativeMatch` が局面・手番・選択・棋譜を所有し、Rustが返す合法手と移動後局面を適用します。古い探索結果は局面番号で拒否します。
- **表示と入力:** `NativeHud` はUI Toolkit、`NativeBoard` はモデルとガイド、`NativeCamera` は視点、`NativeMotion` と `NativeEffects` は移動・成り・捕食演出を担当します。UI展開で盤面の表示領域を変えません。
- **保存:** `NativeStorage` がUnityの永続領域へ棋譜を保存します。WebGLはIndexedDBへ同期します。JSON棋譜は元のReact版と相互読み込みできます。実況用テキストも出力できます。

画面には持ち駒、成り選択、敵駒の移動範囲、危険・王冠・助っ人マーク、AI時計、設定、図鑑、マス一覧での操作、リプレイ、勝敗演出をUnity内で表示します。人間対AI、AI対AI、ローカルPvPに対応します。ブラウザ連携はWASM接続・保存同期・ファイル選択/ダウンロード・画面解像度に限定しています。

## Editorと検証

一度 `unity:build` した後、Unity Hubで `unity/` を開き、`Assets/Scenes/Game.unity` をPlayできます。ビルドスクリプトがmacOSのdylibを `Assets/Plugins/macOS/`、WindowsのDLLを `Assets/Plugins/Windows/` に配置します。Linux Editor用のRustバイナリやモバイルのネイティブ配布設定は今回含みません。

ビルド前に `NativeValidation` がUnityのJSONシリアライザとRustネイティブ境界で15手の検証棋譜を再生します。配置・複数捕食・ペンギン変身・シャチ回転・王捕食を通し、Unityが出力した棋譜を元のTypeScriptデコーダでも再生して互換性を確認します。画面からも棋譜一覧で `docs/fixtures/unity-smoke.json` を読み込めます。

生成アセット・Unity Library・ビルド出力はGitへ入れず、ソース・設定・フォントとそのOFLライセンスを管理します。ビルドログは `unity/BuildLogs/native.log` にあります。

6000.5.8f1のWebGL UI Toolkitには大きなUI更新時のステージング確保の不具合があるため、通常ビルドはプロジェクト専用のEditorコピーを自動準備し、WebGL用モジュールに領域統合・端数調整を反映します。インストール済みUnityは変更しません。適用対象・元モジュール・修正コードのハッシュを検査し、毎回5つの境界ケースを検証します。詳細と最新の実画面検証結果は[UNITY_PRESENTATION.md](UNITY_PRESENTATION.md)に記録しています。

`docs/fixtures/unity-jet-smoke.json`は、元のルールエンジンで生成・検証した9手の追加棋譜です。8手目から進めるとジェットの飛行・炎・王の捕食を確認できます。15手棋譜には王の着地、雪煙、複数捕食と光球、ペンギン変身、シャチ回転が含まれます。

## unityroomへのビルド・アップロード

`npm run unityroom:build` で、Release・Gzip・Decompression Fallbackオフの専用ビルドを `dist-unityroom/` に生成します。通常の `dist-unity/` は変更しません。ログは `unity/BuildLogs/unityroom.log` です。

unityroomの「Webビルド設定」でUnity `6000.5.x` を選び、「Webビルドアップロード」で `dist-unityroom/Build` フォルダーを選択します。対象は `Unityroom.loader.js`、`Unityroom.data.gz`、`Unityroom.framework.js.gz`、`Unityroom.wasm.gz` の4ファイルです。`index.html` のアップロードは不要です。既存の `public/seal.svg` を512pxへ描画した `dist-unityroom/icon.png` も生成します。

ビルド時にGzipの解凍・Unityデータヘッダー・WebAssemblyの検証を実施します。配布用ライセンス文はUnityのdataペイロードにも同梱しています。出力だけを再検査する場合は `node scripts/package-unityroom.mjs` を使用できます（Unityの再ビルドは行いません）。

2026-10-20、[アザラシ将棋](https://unityroom.com/games/azarashi-shogi)を新規登録し、4ファイルのアップロード完了を確認しました。Unityroom側のゲーム画面で起動・合法手表示・王の移動・Rust AIの応手まで操作し、3手目へ進むことを確認しています。公開範囲・実況ポリシーはユーザー選択待ちのため、この時点では非公開です。スマートフォン実機は未確認なので「モバイルブラウザで遊べる」は有効にしていません。

設定要件は[unityroom公式ヘルプ](https://help.unityroom.com/unityroom-351dc3ed5de980eebd79eef3b153be31)に従っています。
