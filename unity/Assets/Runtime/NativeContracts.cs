using System;
using System.Collections.Generic;
using UnityEngine;

namespace Azarashi.UnityView
{
    [Serializable]
    public sealed class Cell
    {
        public int x, y; public Cell()
        {
        }
        public Cell(int x, int y)
        {
            this.x = x;
            this.y = y;
        }
        public bool Same(Cell c) => c != null && x == c.x && y == c.y;
    }
    [Serializable]
    public sealed class PieceState
    {
        public string id, kind, owner; public bool promoted; public Cell at;
    }
    [Serializable]
    public sealed class Stock
    {
        public int seal, penguin, bear, orca, walrus; public int Count(string kind) => kind == "seal" ? seal : kind == "penguin" ? penguin : kind == "bear" ? bear : kind == "orca" ? orca : walrus;
    }
    [Serializable]
    public sealed class Stocks
    {
        public Stock south, north; public Stock Of(string owner) => owner == "south" ? south : north;
    }
    [Serializable]
    public sealed class Outcome
    {
        public string winner, reason;
    }
    [Serializable]
    public sealed class Position
    {
        public int rulesVersion, revision; public string phase, turn; public PieceState[] pieces; public Stocks stocks; public Outcome result; public Position Copy() => JsonUtility.FromJson<Position>(JsonUtility.ToJson(this));
    }
    [Serializable]
    public sealed class Transformation
    {
        public string type; public int pivot, direction;
    }
    [Serializable]
    public sealed class GameAction
    {
        public string type, kind, pieceId; public Cell at, to; public Transformation transformation; public Cell Destination => type == "place" ? at : to;
    }
    [Serializable]
    public sealed class Preview
    {
        public GameAction action; public PieceState piece; public Cell from; public Cell[] footprint, captureCells; public PieceState[] captured; public Position after;
    }
    [Serializable]
    public sealed class Evaluation
    {
        public float score; public bool kingInDanger, canWinImmediately;
    }
    [Serializable]
    public sealed class Inspection
    {
        public int rulesVersion; public string positionIdentity, error; public Evaluation evaluation; public Preview[] moves;
    }
    [Serializable]
    public sealed class Level
    {
        public int level, maxDepth, tacticalDepth; public string name; public float thinkingMs, noise; public bool advanced;
    }
    [Serializable]
    public sealed class PieceDefinition
    {
        public string kind, name, shortName, description; public int count, value;
    }
    [Serializable]
    public sealed class Variant
    {
        public string kind, name; public bool promoted; public int width, height;
    }
    [Serializable]
    public sealed class GuidePalette
    {
        public string safe, danger, transformation, kingCaptureTrap, kingDanger, fill, active, last, enemy;
    }
    [Serializable]
    public sealed class GameConfig
    {
        public Position initial; public Level[] levels; public PieceDefinition[] pieces; public Variant[] variants; public GuidePalette colors;
    }
    [Serializable]
    public sealed class SearchProfile
    {
        public float budgetMs, noise; public int maxDepth, tacticalDepth; public bool advanced; public int[] values;
    }
    [Serializable]
    public sealed class EngineRequest
    {
        public Position state; public SearchProfile profile; public uint seed; public string[] positionHistory;
    }
    [Serializable]
    public sealed class AiResult
    {
        public GameAction action; public float score, elapsedMs; public int depth; public double nodes; public bool timedOut; public string error; public int revision;
    }
    [Serializable]
    public sealed class Settings
    {
        public string mode = "human-vs-ai", human = "south"; public int difficulty = 3, southLevel = 3;
    }
    [Serializable]
    public sealed class RecordSettings
    {
        public string mode, human; public int difficulty; public RecordLevels aiLevels;
    }
    [Serializable]
    public sealed class RecordLevels
    {
        public int south, north;
    }
    [Serializable]
    public sealed class MatchRecord
    {
        public string id, createdAt; public uint seed; public int version = 1, rulesVersion = 2; public RecordSettings settings; public List<GameAction> actions = new List<GameAction>();
    }
    [Serializable]
    public sealed class ReplayList
    {
        public List<MatchRecord> items = new List<MatchRecord>();
    }
    [Serializable]
    public sealed class ModelAsset
    {
        public string key; public RenderFrame frame;
    }
    [Serializable]
    public sealed class HemisphereSettings
    {
        public string sky, ground; public float intensity;
    }
    [Serializable]
    public sealed class DirectionalSettings
    {
        public float[] position; public string color; public float intensity; public bool shadows;
    }
    [Serializable]
    public sealed class LightingSettings
    {
        public float environmentIntensity;
        public HemisphereSettings hemisphere; public DirectionalSettings[] directional;
    }
    [Serializable]
    public sealed class PenguinPoses
    {
        public string owner; public RenderFrame[] frames;
    }
    [Serializable]
    public sealed class EffectMesh
    {
        public string name, mesh;
    }
    [Serializable]
    public sealed class SceneAssets
    {
        public RenderFrame world, effects; public ModelAsset[] models; public LightingSettings lighting; public PenguinPoses[] penguinPoses; public EffectMesh[] effectMeshes;
    }
    public static class NativeActions
    {
        private static string Key(Transformation t) => t?.type == "promote" ? "promote" : t?.type == "rotate" ? "rotate:" + t.pivot + ":" + t.direction : "";
        public static bool Same(GameAction a, GameAction b) => a != null && b != null && a.type == b.type && (a.type == "place" ? a.kind == b.kind && a.at != null && a.at.Same(b.at) : a.pieceId == b.pieceId && a.to != null && a.to.Same(b.to) && Key(a.transformation) == Key(b.transformation));
        public static Preview Find(Inspection inspected, GameAction action) => Array.Find(inspected.moves, m => Same(m.action, action));
    }

    public sealed class NativeGameData
    {
        public readonly GameConfig Config;
        public readonly SceneAssets Assets;
        public NativeGameData()
        {
            Config = JsonUtility.FromJson<GameConfig>(Resources.Load<TextAsset>("Native/GameConfig").text);
            Assets = JsonUtility.FromJson<SceneAssets>(Resources.Load<TextAsset>("Native/SceneAssets").text);
        }
        public Variant Variant(PieceState p) => Array.Find(Config.variants, v => v.kind == p.kind && v.promoted == p.promoted);
        public Level Level(int n) => Array.Find(Config.levels, v => v.level == n);
        public string Name(PieceState p) => Variant(p).name;
        public string ModelKey(PieceState p) => p.kind + ":" + p.owner + ":" + (p.promoted ? 1 : 0);
        public Vector3 Center(PieceState p)
        {
            var v = Variant(p);
            return new Vector3(p.at.x - 5 + v.width * .5f, 0, p.at.y - 5 + v.height * .5f);
        }
        public IEnumerable<Cell> Body(PieceState p)
        {
            var v = Variant(p);
            for (var y = 0; y < v.height; y++)
                for (var x = 0; x < v.width; x++)
                    yield return new Cell(p.at.x + x, p.at.y + y);
        }
        public static string Other(string owner) => owner == "south" ? "north" : "south";
        public static float Facing(PieceState p) => (p.owner == "south" ? 180 : 0) - (p.kind == "orca" && p.promoted ? 90 : 0);
        public SearchProfile Profile(int n)
        {
            var l = Level(n);
            return new SearchProfile { budgetMs = l.thinkingMs, maxDepth = l.maxDepth, noise = l.noise, tacticalDepth = l.tacticalDepth, advanced = l.advanced, values = Array.ConvertAll(Config.pieces, p => p.value) };
        }
    }
}
