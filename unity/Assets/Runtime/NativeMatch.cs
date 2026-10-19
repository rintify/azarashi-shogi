using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Azarashi.UnityView
{
    public sealed class CellSafety
    {
        public bool unsafeCell, kingDanger, trap; public bool Red => unsafeCell && !trap;
    }

    /// <summary>Unity application owner. Legal actions and successor positions come from the unchanged Rust rules.</summary>
    public sealed class NativeMatch : MonoBehaviour
    {
        public NativeGameData Data
        {
            get; private set;
        }
        public Position State
        {
            get; private set;
        }
        public Settings Settings { get; private set; } = new Settings();
        public NativeMotion Motion
        {
            get; private set;
        }
        public NativeBoard Board
        {
            get; private set;
        }
        public NativeHud Hud
        {
            get; private set;
        }
        public NativeEngine Engine
        {
            get; private set;
        }
        public Preview[] Pending
        {
            get; private set;
        }
        public Preview HoverPreview
        {
            get; private set;
        }
        public string SelectedId
        {
            get; private set;
        }
        public string SelectedStock
        {
            get; private set;
        }
        public bool TopView, Muted, Paused, ReplayPlaying, ResultDismissed;
        public bool Replaying => replayRecord != null;
        public int ReplayCursor
        {
            get; private set;
        }
        public int ReplayTotal => replayRecord?.actions.Count ?? 0;
        public float ReplaySpeed = 1;
        public string Dialog
        {
            get; private set;
        }
        public bool Thinking
        {
            get; private set;
        }
        public float ThinkingStarted
        {
            get; private set;
        }
        public float ThinkingBudget
        {
            get; private set;
        }
        public readonly Dictionary<string, string> Marks = new Dictionary<string, string>();
        public readonly Dictionary<string, CellSafety> Safety = new Dictionary<string, CellSafety>();
        private readonly Dictionary<string, string> cellColors = new Dictionary<string, string>();
        public readonly List<MatchRecord> Replays = new List<MatchRecord>();
        public MatchRecord Record
        {
            get; private set;
        }
        private MatchRecord replayRecord;
        private List<Position> replayStates;
        private Inspection legal;
        private Preview[] selected = Array.Empty<Preview>();
        private Cell grab = new Cell(), hover;
        private readonly GuideState[] guideStates = new GuideState[100];
        public GuideState GuideAt(Cell cell) => guideStates[cell.y * 10 + cell.x];
        public bool InspectingEnemy => SelectedId != null && State.pieces.Any(p => p.id == SelectedId && p.owner != Viewer);
        public void HoverCell(Cell cell)
        {
            hover = cell;
            var at = new Cell(cell.x - grab.x, cell.y - grab.y);
            HoverPreview = selected.FirstOrDefault(m => m.action.Destination.Same(at));
        }
        private NativeCamera orbit;
        private Vector2 down;
        private bool pointerDown, wasReady, stepRequested;
        private float nextReplay, turnStarted;
        private readonly List<string> history = new List<string>();
        private NativeAudio audio;
        public bool Busy => Motion != null || orbit != null && orbit.Rotating;
        public string Viewer => Settings.mode == "local-pvp" && !Replaying ? (Motion?.BeforeState.turn ?? State.turn) : Settings.human;
        public bool HumanTurn => Settings.mode == "local-pvp" || Settings.mode == "human-vs-ai" && State.turn == Settings.human;
        public Preview LastAction => last;
        public bool KingThreatened { get; private set; }
        public string Actor(string side) => Settings.mode == "local-pvp" ? (side == "south" ? "先手" : "後手") : Settings.mode == "ai-vs-ai" ? (side == "south" ? "先手AI" : "後手AI") : side == Settings.human ? "あなた" : "NPC";
        public IEnumerable<Preview> SelectedMoves => selected;
        public Cell Grab => grab;
        public Cell Stationary => SelectedId == null ? null : Array.Find(State.pieces, p => p.id == SelectedId)?.at;

        private void Awake()
        {
            name = "NativeMatch";
            Data = new NativeGameData();
            Engine = new GameObject("NativeEngine").AddComponent<NativeEngine>();
            Engine.Initialize(Data);
            Engine.Completed += OnAi;
            var renderer = new GameObject("AzarashiRenderer").AddComponent<SceneRenderer>();
            Board = new NativeBoard(renderer, Data);
            orbit = new NativeCamera(Board.Camera);
            State = Data.Config.initial.Copy();
            Hud = gameObject.AddComponent<NativeHud>();
            Hud.Initialize(this);
            audio = gameObject.AddComponent<NativeAudio>();
            Muted = NativeStorage.Read("sound", "azarashi-shogi.sound") == "off";
            LoadLibrary();
        }
        private void Update()
        {
            if (!Engine.Ready)
            {
                Hud.Tick();
                return;
            }
            if (!wasReady)
            {
                wasReady = true;
                Restore();
            }
            audio.Sync(Motion, Muted);
            if (Motion != null)
            {
                if (Motion.Done)
                {
                    Motion = null;
                    turnStarted = Time.unscaledTime;
                    nextReplay = Time.unscaledTime + .34f / ReplaySpeed;
                    Refresh();
                }
            }
            if (!Busy && Dialog == null && Pending == null && State.phase == "playing")
            {
                if (Replaying)
                {
                    if (ReplayPlaying && Time.unscaledTime >= nextReplay)
                    {
                        if (ReplayCursor < ReplayTotal)
                            StepReplay(1);
                        else
                            ReplayPlaying = false;
                    }
                }
                else if (!HumanTurn && !Thinking && (!Paused || Settings.mode != "ai-vs-ai" || stepRequested))
                    StartThinking();
            }
            var focus = !Replaying && State.phase == "finished" && !Busy && !ResultDismissed ? last?.piece : null;
            orbit.Frame(Hud.PlayArea, Viewer, TopView, focus, Data, false, Motion?.Aerial == true ? 3.25f : 1.7f);
            orbit.Tick(false);
            HandleInput();
            Draw();
            Hud.Tick();
        }
        private Preview last;
        private void Restore()
        {
            var json = NativeStorage.Read("match", "azarashi.unity.match.v1");
            if (!string.IsNullOrEmpty(json))
                try
                {
                    var record = NativeJson.Record(json);
                    var timeline = Validate(record);
                    Record = record;
                    Settings = SettingsOf(record);
                    State = timeline.Last();
                    last = record.actions.Count > 0 ? Find(Engine.Inspect(timeline[timeline.Count - 2]), record.actions.Last()) : null;
                    history.Clear();
                    foreach (var p in timeline)
                        history.Add(Engine.Inspect(p).positionIdentity);
                    Refresh();
                    return;
                }
                catch (Exception error) { Debug.LogWarning("Saved Unity match could not be restored: " + error.Message); }
            NewGame(Settings);
        }
        public void NewGame(Settings settings)
        {
            if (!Engine.Ready)
            {
                Settings = settings;
                Dialog = null;
                Hud.Rebuild();
                return;
            }
            Engine.Cancel();
            Thinking = false;
            SaveRecord();
            Settings = settings;
            replayRecord = null;
            ReplayPlaying = false;
            Motion = null;
            Pending = null;
            Dialog = null;
            ResultDismissed = false;
            last = null;
            State = Data.Config.initial.Copy();
            Record = new MatchRecord { rulesVersion = Data.Config.initial.rulesVersion, id = Guid.NewGuid().ToString(), createdAt = DateTime.UtcNow.ToString("o"), seed = (uint)UnityEngine.Random.Range(1, int.MaxValue), settings = new RecordSettings { mode = settings.mode, human = settings.human, difficulty = settings.difficulty, aiLevels = new RecordLevels { south = settings.southLevel, north = settings.difficulty } } };
            Hud.NewMatch();
            introStarted = -1;
            Paused = false;
            history.Clear();
            Engine.ClearCache();
            history.Add(Engine.Inspect(State).positionIdentity);
            ClearSelection();
            Refresh();
            SaveRecord();
        }
        private static Settings SettingsOf(MatchRecord record)
        {
            var s = record.settings;
            var north = s.aiLevels != null && s.aiLevels.north > 0 ? s.aiLevels.north : s.difficulty;
            var south = s.aiLevels != null && s.aiLevels.south > 0 ? s.aiLevels.south : s.difficulty;
            return new Settings { mode = string.IsNullOrEmpty(s.mode) ? "human-vs-ai" : s.mode, human = s.human, difficulty = s.mode == "ai-vs-ai" ? north : s.human == "north" ? south : north, southLevel = south };
        }
        public void Open(string dialog)
        {
            CancelThinking();
            if (dialog == "catalog" && Dialog != "catalog") Hud.ResetCatalog();
            Dialog = dialog;
            ReplayPlaying = false;
            ClearSelection();
            Hud.Rebuild();
        }
        public void ToggleSound()
        {
            Muted = !Muted;
            audio.Sync(Motion, Muted);
            NativeStorage.Write("sound", Muted ? "off" : "on");
            NativeStorage.Flush();
        }
        public void Close()
        {
            Dialog = null;
            Hud.Rebuild();
        }
        public void ClearSelection()
        {
            SelectedId = null;
            SelectedStock = null;
            selected = Array.Empty<Preview>();
            Safety.Clear();
            cellColors.Clear();
            HoverPreview = null;
            hover = null;
            Hud?.Rebuild();
        }
        public void SelectStock(string kind)
        {
            if (!CanInput || State.stocks.Of(State.turn).Count(kind) <= 0)
                return;
            if (SelectedStock == kind)
            {
                ClearSelection();
                return;
            }
            SelectedStock = kind;
            SelectedId = null;
            grab = AnchorOffset(new PieceState { kind = kind, promoted = false });
            selected = legal.moves.Where(m => m.action.type == "place" && m.action.kind == kind).ToArray();
            ComputeSafety();
            Hud.Rebuild();
        }
        private bool CanInput => Engine.Ready && !Busy && Dialog == null && Pending == null && !Replaying && HumanTurn && State.phase == "playing";
        public void Click(Cell cell)
        {
            if (!CanInput)
                return;
            var at = new Cell(cell.x - grab.x, cell.y - grab.y);
            var choices = selected.Where(m => m.action.Destination.Same(at)).ToArray();
            if (choices.Length > 0 && (SelectedStock != null || State.pieces.Any(p => p.id == SelectedId && p.owner == State.turn)))
            {
                ChooseDestination(choices);
                return;
            }
            var piece = State.pieces.FirstOrDefault(p => Data.Body(p).Any(c => c.Same(cell)));
            if (piece == null)
            {
                ClearSelection();
                return;
            }
            if (SelectedId == piece.id)
            {
                ClearSelection();
                return;
            }
            SelectedId = piece.id;
            SelectedStock = null;
            HoverPreview = null;
            hover = null;
            grab = AnchorOffset(piece);
            var inspected = State;
            if (piece.owner != State.turn)
            {
                inspected = State.Copy();
                inspected.turn = piece.owner;
            }
            selected = Engine.Inspect(inspected, false).moves.Where(m => m.action.pieceId == piece.id)
                .GroupBy(m => m.action.Destination.x + "," + m.action.Destination.y)
                .SelectMany(group => NativeChoices.Offered(piece, group.ToArray())).ToArray();
            if (piece.owner == Viewer)
                ComputeSafety();
            else
                Safety.Clear();
            Hud.Rebuild();
        }
        private Cell AnchorOffset(PieceState piece)
        {
            var size = Data.Variant(piece);
            return Viewer == "north" ? new Cell(size.width - 1, size.height - 1) : new Cell();
        }
        private void ChooseDestination(Preview[] choices)
        {
            choices = NativeChoices.Offered(State.pieces.FirstOrDefault(p => p.id == choices[0].action.pieceId), choices);
            if (!NativeChoices.RequiresChoice(choices, Viewer))
            {
                Commit(choices[0]);
                return;
            }
            Pending = choices;
            HoverPreview = choices[0];
            Motion = choices.Length > 1 ? new NativeMotion(Data, State, choices[0], true) : null;
            Hud.Rebuild();
        }
        public void PreviewChoice(int index)
        {
            if (Pending == null || index < 0 || index >= Pending.Length)
                return;
            Motion.Preview(Pending[index]);
            HoverPreview = Pending[index];
        }
        public void ResolveChoice(int index)
        {
            if (Pending == null)
                return;
            var choice = Pending[index];
            if (Motion == null)
            {
                Pending = null;
                Commit(choice);
                return;
            }
            Motion.Resolve(choice);
            Pending = null;
            Apply(choice);
            Hud.Rebuild();
        }
        public void CancelChoice()
        {
            if (Pending == null)
                return;
            Motion?.Return();
            Pending = null;
            HoverPreview = null;
            Hud.Rebuild();
        }
        private void Commit(Preview preview)
        {
            Motion = new NativeMotion(Data, State, preview);
            Apply(preview);
        }
        private void Apply(Preview preview)
        {
            State = preview.after;
            last = preview;
            Record.actions.Add(preview.action);
            history.Add(Engine.Inspect(State).positionIdentity);
            Engine.ClearCache();
            ClearSelection();
            Marks.Clear();
            SaveRecord();
            Hud.Rebuild();
        }
        private void Refresh()
        {
            Engine.ClearCache();
            legal = Engine.Inspect(State);
            Marks.Clear();
            Safety.Clear();
            KingThreatened = false;
            if (State.phase == "playing")
            {
                var enemy = State.Copy();
                enemy.turn = NativeGameData.Other(Viewer);
                var enemyMoves = Engine.Inspect(enemy, false).moves;
                foreach (var piece in State.pieces.Where(p => p.owner == Viewer))
                    if (enemyMoves.Any(m => m.captured.Any(c => c.id == piece.id)))
                        Marks[piece.id] = "danger";
                var mine = State.Copy();
                mine.turn = Viewer;
                var myMoves = Engine.Inspect(mine, false).moves;
                foreach (var move in myMoves)
                    if (move.captured.Any(p => p.owner != Viewer && p.kind == "walrus"))
                        Marks[move.piece.id] = "king";
                var king = State.pieces.FirstOrDefault(p => p.owner == Viewer && p.kind == "walrus");
                KingThreatened = king != null && enemyMoves.Any(m => m.captured.Any(p => p.id == king.id));
                if (king != null && enemyMoves.Any(m => m.captured.Any(p => p.id == king.id)) && myMoves.Where(m => m.piece.id == king.id).All(m => Assess(m.after, m.piece).unsafeCell))
                    foreach (var group in myMoves.Where(m => m.piece.id != king.id).GroupBy(m => m.piece.id))
                        if (group.Any(m => !m.captured.Any(p => p.id == king.id) && !Assess(m.after, m.piece).kingDanger) && (!Marks.TryGetValue(group.Key, out var mark) || mark != "king"))
                            Marks[group.Key] = "helper";
                foreach (var piece in State.pieces.Where(p => Marks.TryGetValue(p.id, out var mark) && mark == "danger"))
                    if (Assess(State, piece).Red && myMoves.Where(m => m.piece.id == piece.id).All(m => Assess(m.after, m.piece).Red))
                        Marks[piece.id] = "trapped";
            }
            if (SelectedId != null || SelectedStock != null)
                ComputeSafety();
            Hud.Rebuild();
        }
        public CellSafety Assess(Position next, PieceState piece)
        {
            var owner = piece.owner;
            if (next.phase == "finished")
                return new CellSafety { unsafeCell = next.result?.winner == NativeGameData.Other(owner), kingDanger = next.result?.winner == NativeGameData.Other(owner) };
            var inspected = next;
            if (next.turn == owner)
            {
                inspected = next.Copy();
                inspected.turn = NativeGameData.Other(owner);
            }
            var replies = Engine.Inspect(inspected, false).moves;
            var captures = replies.Where(m => m.captured.Any(c => c.id == piece.id)).ToArray();
            var kingDanger = replies.Any(m => m.captured.Any(c => c.kind == "walrus" && c.owner == owner));
            var trap = !kingDanger && piece.kind != "walrus" && captures.Length > 0 && captures.All(m => m.piece.kind == "walrus" && m.after.phase == "playing" && Engine.Inspect(m.after, false).moves.Any(counter => counter.captured.Any(c => c.id == m.piece.id) && counter.after.result?.winner == owner));
            return new CellSafety { unsafeCell = kingDanger || captures.Length > 0, kingDanger = kingDanger, trap = trap };
        }
        private void ComputeSafety()
        {
            Safety.Clear();
            cellColors.Clear();
            foreach (var group in selected.GroupBy(m => m.action.Destination.x + "," + m.action.Destination.y))
            {
                var safety = Assess(group.First().after, group.First().piece);
                var transformationSafe = group.First().piece.kind == "orca" && safety.unsafeCell && group.Any(m => m.action.transformation?.type == "rotate" && !Assess(m.after, m.piece).unsafeCell);
                Safety[group.Key] = safety;
                cellColors[group.Key] = transformationSafe ? Data.Config.colors.transformation : SafetyColor(safety);
            }
            if (SelectedId != null)
            {
                var piece = State.pieces.First(p => p.id == SelectedId);
                var stationary = Assess(State, piece);
                Safety["stationary"] = stationary;
                if (stationary.Red && selected.All(m => Assess(m.after, m.piece).Red) && Marks.TryGetValue(piece.id, out var mark) && mark == "danger")
                    Marks[piece.id] = "trapped";
            }
        }
        private string SafetyColor(CellSafety safety) => safety.kingDanger ? Data.Config.colors.kingDanger : safety.trap ? Data.Config.colors.kingCaptureTrap : safety.unsafeCell ? Data.Config.colors.danger : Data.Config.colors.safe;
        public int CurrentChoice => Pending == null ? 0 : Mathf.Max(0, Array.IndexOf(Pending, HoverPreview ?? Motion?.Action));
        public string ChoiceColor(int index)
        {
            if (Pending == null || index < 0 || index >= Pending.Length)
                return Data.Config.colors.safe;
            var key = "choice:" + index;
            if (!Safety.TryGetValue(key, out var safety))
            {
                var option = Pending[index];
                safety = Assess(option.after, option.piece);
                Safety[key] = safety;
            }
            return SafetyColor(safety);
        }
        public string CellColor(Preview preview)
        {
            var key = preview.action.Destination.x + "," + preview.action.Destination.y;
            return cellColors.TryGetValue(key, out var color) ? color : Data.Config.colors.safe;
        }
        private void StartThinking()
        {
            Thinking = true;
            ThinkingStarted = Time.unscaledTime;
            var level = Settings.mode == "ai-vs-ai" && State.turn == "south" ? Settings.southLevel : Settings.difficulty;
            ThinkingBudget = Data.Level(level).thinkingMs / 1000;
            Engine.Search(new EngineRequest { state = State, profile = Data.Profile(level), seed = Record.seed, positionHistory = history.ToArray() });
            Hud.Rebuild();
        }
        private void OnAi(AiResult result)
        {
            if (!Thinking || result.revision != State.revision || Replaying)
                return;
            Thinking = false;
            stepRequested = false;
            if (!string.IsNullOrEmpty(result.error))
            {
                Hud.Notify(result.error);
                return;
            }
            var move = Find(legal, result.action);
            if (move != null)
                Commit(move);
            else
                Hud.Notify("AIの手を適用できませんでした。再試行してください。");
        }
        public void CancelThinking()
        {
            if (Thinking)
            {
                Engine.Cancel();
                Thinking = false;
            }
        }
        public void StepAi()
        {
            Paused = true;
            stepRequested = true;
        }
        private static Preview Find(Inspection inspected, GameAction action) => NativeActions.Find(inspected, action);
        private void HandleInput()
        {
            if (Input.GetKeyDown(KeyCode.Escape))
            {
                if (Pending != null)
                    CancelChoice();
                else if (Dialog != null)
                    Close();
                else if (State.phase == "finished" && !Replaying && !ResultDismissed)
                {
                    ResultDismissed = true;
                    Hud.Rebuild();
                }
                else if (!Hud.EscapeUi())
                    ClearSelection();
            }
            var mouse = (Vector2)Input.mousePosition;
            if (Input.GetMouseButtonDown(0) && !Hud.Blocks(mouse))
            {
                Hud.BoardPointerDown();
                pointerDown = true;
                down = mouse;
            }
            if (CanInput && !Hud.Blocks(mouse) && (SelectedId == null || State.pieces.Any(p => p.id == SelectedId && p.owner == Viewer)) && ResolveCell(mouse, out var cell))
            {
                if (hover == null || !hover.Same(cell))
                {
                    hover = cell;
                    var at = new Cell(cell.x - grab.x, cell.y - grab.y);
                    HoverPreview = selected.FirstOrDefault(m => m.action.Destination.Same(at));
                }
            }
            else if (Pending == null && !Hud.Blocks(mouse))
            {
                hover = null;
                HoverPreview = null;
            }
            if (Input.GetMouseButtonUp(0))
            {
                if (pointerDown && (down - mouse).magnitude < 8 && !Hud.Blocks(mouse))
                {
                    if (ResolveCell(mouse, out var clicked))
                        Click(clicked);
                }
                pointerDown = false;
            }
        }
        private bool ResolveCell(Vector2 screen, out Cell cell)
        {
            if (Board.PieceAt(screen, out var id, out var point))
            {
                var piece = State.pieces.FirstOrDefault(p => p.id == id);
                if (piece != null)
                {
                    var size = Data.Variant(piece);
                    cell = new Cell(Mathf.Clamp(Mathf.FloorToInt(point.x + 5), piece.at.x, piece.at.x + size.width - 1), Mathf.Clamp(Mathf.FloorToInt(-point.z + 5), piece.at.y, piece.at.y + size.height - 1));
                    return true;
                }
            }
            return Board.CellAt(screen, out cell);
        }
        private PieceState ghost;
        private Vector3 ghostPosition;
        private float ghostAmount;
        private float introStarted = -1;
        private void Draw()
        {
            Board.OceanTime(Time.unscaledTime);
            Board.Begin();
            if (State.revision == 0 && introStarted < 0)
                introStarted = Time.unscaledTime;
            var shown = new List<PieceState>(State.pieces);
            if (Motion != null)
                foreach (var victim in Motion.Action.captured)
                    if (!shown.Any(p => p.id == victim.id))
                        shown.Add(victim);
            foreach (var piece in shown)
            {
                if (Motion != null && piece.id == Motion.Action.piece.id)
                {
                    var pose = Motion.Sample();
                    var dynamics = Motion.Dynamics(Motion.Progress);
                    var p = new PieceState { id = piece.id, kind = piece.kind, owner = piece.owner, at = piece.at, promoted = pose.promoted };
                    var morph = piece.kind == "penguin" ? Mathf.Abs(pose.morph - (Motion.Before?.promoted == true ? 1 : 0)) : -1;
                    Board.Piece(p, pose.position, pose.yaw, pose.scale, morph, Motion.Before?.promoted ?? false, dynamics.pitch, dynamics.roll, dynamics.stretch);
                }
                else
                {
                    var eaten = Motion != null && Motion.Action.captured.Any(p => p.id == piece.id) ? Motion.CaptureProgress(piece) : 0;
                    var p = Data.Center(piece) + Vector3.up * eaten * .7f;
                    var scale = 1 - eaten;
                    if (State.revision == 0 && Motion == null)
                    {
                        var t = Mathf.Clamp01((Time.unscaledTime - introStarted) / .42f);
                        var ease = 1 - Mathf.Pow(1 - t, 3);
                        p.y += (1 - ease) * .7f;
                        scale *= .75f + .25f * ease;
                    }
                    if (piece.id == SelectedId && !Busy)
                        p.y += Mathf.Sin(Time.unscaledTime * 2.2f) * .018f;
                    Board.Piece(piece, p, NativeGameData.Facing(piece), scale);
                }
            }
            var inspecting = SelectedId != null && State.pieces.Any(p => p.id == SelectedId && p.owner != Viewer);
            var preview = HoverPreview ?? (Motion?.Stage == "return" ? null : Motion?.Action);
            var target = preview?.footprint ?? Array.Empty<Cell>();
            var extra = preview?.captureCells ?? Array.Empty<Cell>();
            var destinations = selected.GroupBy(m => m.action.Destination.x + "," + m.action.Destination.y).Select(g => g.First()).ToDictionary(m => (m.action.Destination.y + grab.y) * 10 + m.action.Destination.x + grab.x);
            var reachable = new HashSet<int>(selected.SelectMany(m => m.captureCells.Concat(m.footprint)).Select(c => c.y * 10 + c.x));
            var stationary = SelectedId == null ? Array.Empty<Cell>() : Data.Body(State.pieces.First(p => p.id == SelectedId)).ToArray();
            for (var index = 0; index < 100; index++)
            {
                var cell = new Cell(index % 10, index / 10);
                destinations.TryGetValue(index, out var move);
                var current = stationary.Any(c => c.Same(cell)) && move == null && !Busy;
                var color = move != null ? CellColor(move) : current && Safety.TryGetValue("stationary", out var safety) ? SafetyColor(safety) : Data.Config.colors.safe;
                var previewColor = preview == null ? Data.Config.colors.safe : Pending != null ? ChoiceColor(CurrentChoice) : CellColor(preview);
                var active = target.Any(c => c.Same(cell));
                var additional = extra.Any(c => c.Same(cell)) && !active;
                var state = new GuideState
                {
                    inspectingEnemy = inspecting,
                    active = active,
                    additional = additional,
                    reachable = reachable.Contains(index) || current,
                    last = last != null && last.footprint.Any(c => c.Same(cell)),
                    legal = move != null && !Busy,
                    stationary = current,
                    stationaryAnchor = current && Stationary != null && cell.x == Stationary.x + grab.x && cell.y == Stationary.y + grab.y,
                    unsafeCell = color == Data.Config.colors.danger || color == Data.Config.colors.kingDanger || color == Data.Config.colors.kingCaptureTrap,
                    kingDanger = color == Data.Config.colors.kingDanger,
                    kingCaptureTrap = color == Data.Config.colors.kingCaptureTrap,
                    transformationSafe = color == Data.Config.colors.transformation,
                    previewUnsafe = HoverPreview != null && (previewColor == Data.Config.colors.danger || previewColor == Data.Config.colors.kingDanger || previewColor == Data.Config.colors.kingCaptureTrap),
                    previewKingDanger = HoverPreview != null && previewColor == Data.Config.colors.kingDanger,
                    previewKingCaptureTrap = HoverPreview != null && previewColor == Data.Config.colors.kingCaptureTrap
                };
                guideStates[index] = state;
                Board.CellGuide(cell, NativeGuides.Style(state, Data.Config.colors), inspecting);
            }
            var wanted = preview?.action.type == "place" && !Busy ? preview.piece : null;
            if (wanted != null)
            {
                if (ghost == null)
                    ghostPosition = Data.Center(wanted);
                ghost = wanted;
            }
            var blend = 1 - Mathf.Exp(-Time.unscaledDeltaTime * 22);
            ghostAmount = Mathf.Lerp(ghostAmount, wanted != null ? 1 : 0, blend);
            if (ghost != null && ghostAmount > .005f)
            {
                ghostPosition = Vector3.Lerp(ghostPosition, Data.Center(ghost), blend);
                ghostPosition.y = (1 - ghostAmount) * .35f;
                var modelScale = ghost.kind == "walrus" ? 1 : ghost.kind == "orca" ? .9f : .86f;
                var copy = new PieceState { id = "ghost", kind = ghost.kind, owner = ghost.owner, promoted = false, at = ghost.at };
                Board.Piece(copy, ghostPosition, NativeGameData.Facing(ghost), ghostAmount * .82f / modelScale);
            }
            if (Dialog == "catalog")
            {
                var variant = Data.Config.variants[Hud.CatalogIndex];
                var piece = new PieceState { id = "catalog", kind = variant.kind, promoted = variant.promoted, owner = "catalog", at = new Cell() };
                var born = Hud.CatalogBirth;
                var ease = 1 - Mathf.Pow(1 - Mathf.Clamp01((Time.unscaledTime - born) / .42f), 3);
                Board.Piece(piece, new Vector3(50, (1 - ease) * .16f, 0), (piece.kind == "orca" && piece.promoted ? 90 : -.35f * Mathf.Rad2Deg), .88f + .12f * ease);
                Board.CatalogFloor();
            }
            NativeEffects.Draw(Board, Motion, Data);
            Board.End();
        }
        public void TogglePause()
        {
            Paused = !Paused;
            if (Paused)
                CancelThinking();
            Hud.Rebuild();
        }
        private void SaveRecord()
        {
            if (Record == null)
                return;
            try
            {
                NativeStorage.Write("match", NativeJson.Encode(Record));
                if (Record.actions.Count > 0)
                {
                    Replays.RemoveAll(r => r.id == Record.id);
                    Replays.Insert(0, Record);
                    SaveLibrary();
                }
                NativeStorage.Flush();
            }
            catch (Exception error) { Debug.LogException(error); Hud.Notify("棋譜を保存できませんでした。ファイルに保存してください。"); }
        }
        private void SaveLibrary() => NativeStorage.Write("replays", NativeJson.Encode(new ReplayList { items = Replays }));
        private void LoadLibrary()
        {
            try
            {
                var text = NativeStorage.Read("replays", "azarashi.unity.replays.v1");
                if (text.Length > 0)
                {
                    var list = NativeJson.Library(text);
                    if (list?.items != null)
                        Replays.AddRange(list.items.Where(r => r?.settings != null && r.actions != null));
                }
            }
            catch (Exception error) { Debug.LogWarning("Native replay library could not be loaded: " + error.Message); }
        }
        private List<Position> Validate(MatchRecord record)
        {
            if (record == null || record.rulesVersion != Data.Config.initial.rulesVersion || record.version != 1 || record.actions == null || record.settings == null || string.IsNullOrEmpty(record.id))
                throw new InvalidOperationException("棋譜の形式が違います。");
            var settings = record.settings;
            if (!new[] { "human-vs-ai", "ai-vs-ai", "local-pvp" }.Contains(settings.mode) || !new[] { "south", "north" }.Contains(settings.human) || Data.Level(settings.difficulty) == null)
                throw new InvalidOperationException("棋譜の対局設定が不正です。");
            if (settings.aiLevels != null && (Data.Level(settings.aiLevels.south) == null || Data.Level(settings.aiLevels.north) == null))
                throw new InvalidOperationException("棋譜のAI設定が不正です。");
            var states = new List<Position> { Data.Config.initial.Copy() };
            foreach (var action in record.actions)
            {
                var move = Find(Engine.Inspect(states.Last()), action);
                if (move == null)
                    throw new InvalidOperationException("棋譜に不正な手があります。");
                states.Add(move.after);
            }
            var result = states.Last().result;
            replayCaptions[record.id + ":" + record.actions.Count] = result == null ? "対局の途中まで" : result.winner == null ? "引き分け" : (result.winner == "south" ? "先手" : "後手") + "の勝ち";
            return states;
        }
        private readonly Dictionary<string, string> replayCaptions = new Dictionary<string, string>();
        public string ReplayCaption(MatchRecord record)
        {
            if (record.id == Record?.id)
                return "いまの対局";
            var key = record.id + ":" + record.actions.Count;
            if (!replayCaptions.TryGetValue(key, out var caption))
            {
                try { Validate(record); }
                catch (Exception error) { replayCaptions[key] = error.Message; }
                caption = replayCaptions[key];
            }
            return caption;
        }
        public void ImportReplay(string text)
        {
            try
            {
                var record = NativeJson.Record(text);
                Validate(record);
                Replays.RemoveAll(r => r.id == record.id);
                Replays.Insert(0, record);
                SaveLibrary();
                NativeStorage.Flush();
                Hud.ClearReplayWarning();
                Hud.Rebuild();
            }
            catch (Exception error) { Hud.Notify(error.Message); }
        }
        public void Watch(MatchRecord record)
        {
            CancelThinking();
            try
            {
                var states = Validate(record);
                replayStates = states;
                replayRecord = record;
                Settings = SettingsOf(record);
                ReplayCursor = 0;
                ReplayPlaying = true;
                State = replayStates[0];
                Motion = null;
                Pending = null;
                Dialog = null;
                last = null;
                ClearSelection();
                Refresh();
                nextReplay = Time.unscaledTime + .34f / ReplaySpeed;
            }
            catch (Exception error) { Hud.Notify(error.Message); }
        }
        public void StepReplay(int direction)
        {
            if (Replaying && direction < 0)
            {
                SeekReplay(ReplayCursor - 1);
                return;
            }
            if (!Replaying || Motion != null)
                return;
            var next = Mathf.Clamp(ReplayCursor + direction, 0, ReplayTotal);
            if (next == ReplayCursor)
                return;
            var before = State;
            var preview = next == ReplayCursor + 1 ? Find(Engine.Inspect(before), replayRecord.actions[ReplayCursor]) : null;
            ReplayCursor = next;
            if (next == ReplayTotal)
                ReplayPlaying = false;
            State = replayStates[next];
            last = preview;
            Motion = preview == null ? null : new NativeMotion(Data, before, preview);
            if (Motion != null) Motion.Duration /= ReplaySpeed;
            Marks.Clear();
            Hud.Rebuild();
        }
        public void ToggleReplay()
        {
            if (!Replaying) return;
            if (ReplayPlaying) ReplayPlaying = false;
            else
            {
                if (ReplayCursor == ReplayTotal) SeekReplay(0);
                ReplayPlaying = true;
            }
            Hud.Rebuild();
        }
        public void SeekReplay(int cursor)
        {
            if (!Replaying)
                return;
            ReplayPlaying = false;
            Motion = null;
            ReplayCursor = Mathf.Clamp(cursor, 0, ReplayTotal);
            State = replayStates[ReplayCursor];
            last = null;
            Refresh();
        }
        public void EndReplay()
        {
            replayRecord = null;
            ReplayPlaying = false;
            Motion = null;
            last = null;
            Settings = SettingsOf(Record);
            State = Validate(Record).Last();
            Refresh();
        }
        public void Export(MatchRecord record, bool text)
        {
            NativeEngine.AzarashiDownload("azarashi-" + record.id + (text ? ".txt" : ".json"), text ? Commentary(record) : NativeJson.Encode(record, true));
        }
        private string Commentary(MatchRecord record)
        {
            var states = Validate(record);
            var lines = new List<string> { "アザラシ将棋 対局記録", "ルールバージョン: " + record.rulesVersion, "先手は南（前方y減少）、後手は北（前方y増加）。座標はx=0〜9、y=0〜9。王の捕食で決着。" };
            for (var i = 0; i < record.actions.Count; i++)
            {
                var preview = Find(Engine.Inspect(states[i]), record.actions[i]);
                lines.Add((i + 1) + "手目 " + states[i].turn + " " + Data.Name(preview.piece) + " " + NativeJson.Encode(preview.action) + " 捕食: " + string.Join(",", preview.captured.Select(p => p.owner + " " + Data.Name(p))) + "\n局面: " + NativeJson.Encode(states[i + 1]));
            }
            return string.Join("\n", lines);
        }
        public void StorageError(string _) => Hud.Notify("棋譜を端末に保存できませんでした。ファイルに保存してください。");
        private void OnDestroy()
        {
            Engine?.Cancel();
        }
    }
}
