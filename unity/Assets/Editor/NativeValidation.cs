using System;
using System.IO;
using System.Linq;
using UnityEngine;

namespace Azarashi.UnityView.Editor
{
    /// <summary>Checks the Unity serializer and native Rust boundary before spending time on a Web build.</summary>
    public static class NativeValidation
    {
        public static void Run()
        {
            var data = new NativeGameData();
            PresentationValidation.Run(data);
            var host = new GameObject("NativeEngine validation");
            try
            {
                var engine = host.AddComponent<NativeEngine>();
                engine.Initialize(data);
                foreach (var sample in new[] { ("seal", false, 1), ("seal", true, 8), ("penguin", false, 8), ("bear", false, 16), ("orca", false, 14), ("orca", true, 14), ("walrus", false, 24) })
                {
                    var moves = NativeHowTo.Destinations(engine, data.Config.initial.rulesVersion, sample.Item1, sample.Item2);
                    if (moves.Length != sample.Item3 || moves.Any(c => c.x == 4 && c.y == 4))
                        throw new Exception("Illustrated tutorial movement diverges: " + sample.Item1 + "/" + sample.Item2);
                    var wide = sample.Item1 == "walrus" || sample.Item1 == "orca" && sample.Item2 ? 2 : 1;
                    var tall = sample.Item1 == "walrus" || sample.Item1 == "orca" && !sample.Item2 ? 2 : 1;
                    var size = wide == 2 || tall == 2 ? 6 : 5;
                    foreach (var move in moves)
                    {
                        var center = NativeHowTo.Center(move, wide, tall, 2);
                        if (center.x - wide * .5f < 0 || center.y - tall * .5f < 0 || center.x + wide * .5f > size || center.y + tall * .5f > size)
                            throw new Exception("Tutorial destination footprint cropped: " + sample.Item1);
                        if (Mathf.Abs(center.x - (move.x - 2) - wide * .5f) > .001f || Mathf.Abs(center.y - (move.y - 2) - tall * .5f) > .001f)
                            throw new Exception("Tutorial marker is not the footprint centre.");
                    }
                }
                var placements = NativeHowTo.Placements(engine, data.Config.initial.rulesVersion);
                if (placements.Length != 12 || !placements.Any(c => c.Same(new Cell(3, 3))))
                    throw new Exception("Tutorial placement diagram must include all 12 adjacent free cells, including diagonals.");
                var rotation = NativeHowTo.Rotation(engine, data.Config.initial.rulesVersion);
                if (rotation.captureCells.Length != 3 || !rotation.footprint.Any(c => c.Same(new Cell(4, 3))))
                    throw new Exception("Tutorial rotation must retain the captured pivot and cover the L-shaped union.");
                var capture = NativeHowTo.Capture(engine, data.Config.initial.rulesVersion, false);
                var ownKing = NativeHowTo.Capture(engine, data.Config.initial.rulesVersion, true);
                if (capture.captured.Length != 2 || ownKing.captured.Length != 1 || ownKing.after.result?.winner != "north")
                    throw new Exception("Tutorial capture diagrams do not match their stated results.");
                if (NativeHowTo.SwipePage(0, 11, 100, 0, .3f, 320) != 0 ||
                    NativeHowTo.SwipePage(10, 11, -100, 0, .3f, 320) != 10 ||
                    NativeHowTo.SwipePage(4, 11, -80, 5, .3f, 320) != 5 ||
                    NativeHowTo.SwipePage(4, 11, 80, 5, .3f, 320) != 3 ||
                    NativeHowTo.SwipePage(4, 11, 30, 90, .1f, 320) != 4 ||
                    NativeHowTo.SwipePage(4, 11, 10, 0, .1f, 320) != 4 ||
                    NativeHowTo.SwipePage(4, 11, -30, 0, .05f, 320) != 5)
                    throw new Exception("Illustrated tutorial swipe navigation diverges.");
                Debug.Log("Illustrated tutorial validation passed: seven movement diagrams use Rust legal moves; swipe bounds, direction, flick and vertical rejection.");
                var record = NativeJson.Record(Resources.Load<TextAsset>("Native/smoke").text);
                var state = data.Config.initial.Copy();
                var captures = 0;
                var changes = 0;
                foreach (var action in record.actions)
                {
                    var inspection = engine.Inspect(state);
                    if (NativeActions.Find(inspection, new GameAction { type = "move", pieceId = "not-a-piece", to = new Cell(-1, -1) }) != null)
                        throw new Exception("Invalid action accepted.");
                    var preview = NativeActions.Find(inspection, action);
                    if (preview == null)
                        throw new Exception("Native replay diverges at ply " + state.revision);
                    captures += preview.captured.Length;
                    if (preview.action.transformation != null)
                        changes++;
                    state = preview.after;
                    if (data.Body(preview.piece).Any(c => c.x < 0 || c.x > 9 || c.y < 0 || c.y > 9))
                        throw new Exception("Native footprint is outside board.");
                }
                if (state.phase != "finished" || captures < 3 || changes < 2)
                    throw new Exception("Smoke record did not exercise capture, both transformations and a finished match.");
                var library = NativeJson.Library(NativeJson.Encode(new ReplayList { items = new System.Collections.Generic.List<MatchRecord> { record } }));
                if (library.items.Count != 1 || library.items[0].settings.aiLevels != null)
                    throw new Exception("Optional AI levels changed during library persistence.");
                record = library.items[0];
                var encoded = NativeJson.Encode(record, true);
                if (encoded.Contains("\"type\": \"\"") || encoded.Contains("\"south\": 0"))
                    throw new Exception("Absent optional fields were not normalized.");
                // Keep a concrete Unity-produced record for the original TypeScript decoder to verify.
                var directory = Path.GetFullPath("../.openai");
                Directory.CreateDirectory(directory);
                File.WriteAllText(Path.Combine(directory, "unity-roundtrip.json"), encoded);
                Debug.Log("Native Unity validation passed: " + record.actions.Count + " plies, " + captures + " captures, " + changes + " transformations; winner=" + state.result.winner);
            }
            finally { UnityEngine.Object.DestroyImmediate(host); }
        }
    }
}
