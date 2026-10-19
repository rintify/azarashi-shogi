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
