# Unity版の表現の移植

元版の表現の定義は `src/components`、`src/styles.css`、`src/scene`、`src/presentation` にある。Unity側で独自のデザインを作って置き換えない。

## データの所有者

- `NativeMatch`: 対局状態、操作意図、安全性。Rustが返した合法手を使う。
- `NativeHud`: UI状態。Stock / Dialogs / Promotion / Feedbackに分割した部分クラスは同じ所有者のビュー。
- `NativeViewTree`: 継続するUI要素の同一性と退場時の保持。再描画でフォーカスやポインターキャプチャーを破棄しない。
- `NativeUi`: UIの登場・退場・値の切り替え・押下・ホバー。元のCSSの曲線を使う。
- `NativeMotion`: 元のmotion / movement / captureTransfersの秒単位移植。駒、捕食、粒子、持ち駒は同じ時計を参照する。
- `NativeGuides`: 元のguideStyleの優先順位、色、透過率。描画層で安全判定を追加しない。
- `NativeBoard`: エクスポートされたモデル、連続したペンギンの姿、盤上ガイドの保持・補間。
- `NativeEffects`: 元のTravelEffects / SnowImpact / ActionEffectsの粒子プール、形状、経路、寿命。
- `SceneRenderer`: 右手座標からUnityへの変換、描画、元の物理照明式。UIやルールは持たない。

## 元の素材の取り込み

`npm run unity:build` は、TSXモデルと途中のペンギンの姿、粒子のジオメトリー、AnimalIconとLucideのSVG、CSSの多層シャドウ、ルール本文を生成する。影を厚い下枠に置き換えたり、記号を別の図形で描き直したりしない。生成PNGは高解像度で、影はスライスしてサイズ変更する。

場面の環境照明は元のThree.jsが生成したPMREMをlinear RGBA half floatで保持する。UnityのStandardシェーダーへの単純置換ではなく、元のGGX、clearcoat、多重散乱、CubeUVサンプリングとACESを移植している。色をsRGBへ二度変換しない。図鑑には元の図鑑専用の照明と床を使う。

素材契約の色は既に線形値なので、ShaderLabの `_Color` / `_Emission` は `Vector` として宣言する。`Color` 宣言では、`SetVector` で渡してもsRGBから線形への変換が入る。2026-10-20の実WebGL照合で、この二重入力変換による海と駒の暗転を確認し、宣言を修正した。手動の出力ガンマ変換は追加していない。Editor検証はこの型の契約もチェックする。照明・影の細部の一致は別途照合が必要。

環境光の強度はThree r180の `WebGLRenderer` と同じ条件で選ぶ。明示的な材質の `envMap` がないStandard/Physical材質には、材質の `envMapIntensity` ではなく場面の `environmentIntensity` が適用される。`SceneEncoder` はこの区別を `useSceneEnvironment` で出力し、元場面から採取した強度をUnityで使用する。盤面用・動物用モデルを別々に採取しても、この場面の条件を失わない。図鑑は図鑑専用の照明を使用する。

環境照明と捕食音の再生成は開発サーバーの `?unity-environment` 画面から行う。環境は元のIceWorldを実際のWebGLで描画して保存し、音は元のscheduleBiteをOfflineAudioContextでレンダリングする。出力はそれぞれ `Native/Lighting/Environment.bytes`、`Native/Audio/Bite.bytes`。`PresentationSources.json` は採取元のSHA-256を保持し、変更後の古い素材の使用をビルド前に拒否する。

## 検証

`unity-presentation-fixtures.ts` が元のTypeScript関数から動作とガイドの照合データを生成する。Unity Editorの `PresentationValidation` が移動・変身・王の伸縮・飛行と持ち駒の到着時刻、全32,768通りのガイド状態を照合する。対局の15手の棋譜もRust経由で再生して確認する。

カメラの左右の回転経路は、元の `sampleCameraOrbit` が生成した246サンプルで比較する。Unity座標を元の右手座標へ戻してから補間し、最後にZを反転する。HUD領域が未確定の初回フレームではカメラを更新せず、ゼロ幅によるNaNと、その後の盤面消失を防ぐ。起動順の回帰検証もEditorで実行する。

数値の照合は見た目全体の一致を保証しない。シェーダー、シャドウ、UI Toolkitの文字組み、画面サイズ、hoverと退場中の入力について、実際のUnity Webビルドでも確認する。

## 2026-10-20のWindowsでの再開結果

Unity 6000.5.8f1 + Web Build Supportで通常のWebビルドを完了した。現在の `dist-unity/unity-build.json` の `builtAt` は `2026-10-19T16:51:04.158Z`（日本時間2026-10-20 01:51）。`--reuse` は使用していない。Unity単体のUI Toolkit版で、実行時のReact UI重ね合わせはない。

今回の確認・修正:

- Windows用Rust DLLの自動ビルド、Editorの標準パス、esbuildの起動、CRLF・パス区切りによる鮮度チェックの誤検出を修正。
- instancing設定を整数のKeepAll値で設定し、空のenumNamesによる警告を解消。
- 起動直後の未確定HUD領域からカメラがNaNになる不具合を実画面で確認し、修正後の盤面描画を確認。
- 元素材の線形色を二重変換しない材質宣言と、元Threeの場面環境光の適用条件を修正。海・盤面・王を同じ初期局面で比較。
- ヘッダーの縦方向の中央揃え、横画面で幅840px以上の盤面領域、相手の持ち駒の横並び・右寄せを元CSSに対応。
- ダイアログ外のタップ、スクロールバー、長文の実測幅による再配置、スライダーの矢印・Home・Endキーと整数刻み、ドラッグ中の即時更新を復元。
- UIの再描画後にリプレイ速度のラベルが隠れる不具合を修正。
- ScrollViewの内部contentContainerもNativeViewTreeの管理下へ登録。レイアウト更新で本文が重複する不具合を修正し、要素の同一性・重複防止・退場時の入力停止をEditor検証に追加。

通常のテストは35ファイル・240件通過。React本番ビルドと型チェックも通過。最新Unityビルドでは、動作1,025サンプル、盤上ガイド32,768状態、カメラ246サンプル、初回カメラ設定とScrollViewの保持の検証を通過。UnityのJSONとRustを経由した15手・4捕食・2変身・先手勝利の棋譜、および元TypeScript側での再生も通過。

ブラウザー操作はcua_replで行い、Reactを `http://127.0.0.1:5186/`、Unityを `http://127.0.0.1:4187/` で確認した。通常のプレビューとは別オリジンで、検証用棋譜は `docs/fixtures/unity-smoke.json` を読み込んだ。デスクトップ1280×800、縦375×812、横844×390で初期局面を比較した。スクリーンショットはローカルの `.openai/verification/` に保存している（Git管理外）。

残っている確認・差分:

- ダイアログ背景の7pxぼかしは未移植。スクロールバーの表示・操作は復元したが、元のダイアログ全体に対する配置・高さ、見出しの固定、文字組みには差分が残る。
- 手番の記号・文言・小さい文字の配置、王の危険表示、直前の手の説明、リプレイ中の手番通知などのUI差分。
- 色の大きな暗転は解消したが、PBR・環境光・影の最終的な出力は完全一致の判定をしていない。Unityの組み込み影は元のPCFSoftと同じ処理ではない。
- 全マークの出退場と入力透過、全危険ガイド、全回転候補、ペンギン変身・王の伸縮と雪煙・炎・波・捕食光球・加算のフレーム単位の実画面照合。
- ローカルPvPの実際のカメラ回転経路、図鑑、勝利・敗北・引き分けの全演出、捕食済みモデルのキャッシュ解放、モーダル内のキーボードフォーカス移動。

ビルドと一部画面・操作の照合は完了したが、移植全体の表現一致は未完了。公開・unityroomへの投稿は行っていない。
