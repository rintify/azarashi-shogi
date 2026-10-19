using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Azarashi.UnityView
{
    public sealed class CellSafety
    { public bool unsafeCell,kingDanger,trap; public bool Red=>unsafeCell&&!trap; }

    /// <summary>Unity application owner. Legal actions and successor positions come from the unchanged Rust rules.</summary>
    public sealed class NativeMatch : MonoBehaviour
    {
        public NativeGameData Data {get;private set;}
        public Position State {get;private set;}
        public Settings Settings {get;private set;}=new Settings();
        public NativeMotion Motion {get;private set;}
        public NativeBoard Board {get;private set;}
        public NativeHud Hud {get;private set;}
        public NativeEngine Engine {get;private set;}
        public Preview[] Pending {get;private set;}
        public Preview HoverPreview {get;private set;}
        public string SelectedId {get;private set;}
        public string SelectedStock {get;private set;}
        public bool TopView,Muted,Paused,ReplayPlaying,ResultDismissed;
        public bool Replaying=>replayRecord!=null;
        public int ReplayCursor {get;private set;}
        public int ReplayTotal=>replayRecord?.actions.Count??0;
        public float ReplaySpeed=1;
        public string Dialog {get;private set;}
        public bool Thinking {get;private set;}
        public float ThinkingStarted {get;private set;}
        public float ThinkingBudget {get;private set;}
        public readonly Dictionary<string,string> Marks=new Dictionary<string,string>();
        public readonly Dictionary<string,CellSafety> Safety=new Dictionary<string,CellSafety>();
        private readonly Dictionary<string,string> cellColors=new Dictionary<string,string>();
        public readonly List<MatchRecord> Replays=new List<MatchRecord>();
        public MatchRecord Record {get;private set;}
        private MatchRecord replayRecord;
        private List<Position> replayStates;
        private Inspection legal;
        private Preview[] selected=Array.Empty<Preview>();
        private Cell grab=new Cell(),hover;
        private NativeCamera orbit;
        private Vector2 down;
        private bool pointerDown,wasReady,stepRequested,capturePlayed;
        private float nextReplay,turnStarted;
        private readonly List<string> history=new List<string>();
        private NativeAudio audio;
        public bool Busy=>Motion!=null||orbit!=null&&orbit.Rotating;
        public string Viewer=>Settings.mode=="local-pvp"&&!Replaying?(Motion?.BeforeState.turn??State.turn):Settings.human;
        public bool HumanTurn=>Settings.mode=="local-pvp"||Settings.mode=="human-vs-ai"&&State.turn==Settings.human;
        public string Actor(string side)=>Settings.mode=="local-pvp"?(side=="south"?"先手":"後手"):Settings.mode=="ai-vs-ai"?(side=="south"?"先手AI":"後手AI"):side==Settings.human?"あなた":"NPC";
        public IEnumerable<Preview> SelectedMoves=>selected;
        public Cell Grab=>grab;
        public Cell Stationary=>SelectedId==null?null:Array.Find(State.pieces,p=>p.id==SelectedId)?.at;

        private void Awake()
        {
            name="NativeMatch";
            Data=new NativeGameData();Engine=new GameObject("NativeEngine").AddComponent<NativeEngine>();Engine.Initialize(Data);Engine.Completed+=OnAi;
            var renderer=new GameObject("AzarashiRenderer").AddComponent<SceneRenderer>();Board=new NativeBoard(renderer,Data);orbit=new NativeCamera(Board.Camera);
            State=Data.Config.initial.Copy();Hud=gameObject.AddComponent<NativeHud>();Hud.Initialize(this);audio=gameObject.AddComponent<NativeAudio>();LoadLibrary();
        }
        private void Update()
        {
            if(!Engine.Ready){Hud.Tick();return;}
            if(!wasReady){wasReady=true;Restore();}
            if(Motion!=null)
            {
                if(!capturePlayed&&Time.unscaledTime>=Motion.Landing&&Motion.Action.captured.Length>0){capturePlayed=true;if(!Muted)audio.Bite();}
                if(Motion.Done){Motion=null;capturePlayed=false;turnStarted=Time.unscaledTime;nextReplay=Time.unscaledTime+.34f/ReplaySpeed;Refresh();}
            }
            if(!Busy&&Dialog==null&&Pending==null&&State.phase=="playing")
            {
                if(Replaying){if(ReplayPlaying&&Time.unscaledTime>=nextReplay){if(ReplayCursor<ReplayTotal)StepReplay(1);else ReplayPlaying=false;}}
                else if(!HumanTurn&&!Thinking&&(!Paused||Settings.mode!="ai-vs-ai"||stepRequested))StartThinking();
            }
            var focus=!Replaying&&State.phase=="finished"&&!ResultDismissed?last?.piece:null;
            orbit.Frame(Hud.PlayArea,Viewer,TopView,focus,Data,false,Motion?.Aerial==true?3.25f:1.7f);orbit.Tick(false);
            HandleInput();Draw();Hud.Tick();
        }
        private Preview last;
        private void Restore()
        {
            var json=NativeStorage.Read("match", "azarashi.unity.match.v1");
            if(!string.IsNullOrEmpty(json))try{var record=NativeJson.Record(json);var timeline=Validate(record);Record=record;Settings=SettingsOf(record);State=timeline.Last();history.Clear();foreach(var p in timeline)history.Add(Engine.Inspect(p).positionIdentity);Refresh();return;}catch(Exception error){Debug.LogWarning("Saved Unity match could not be restored: "+error.Message);}
            NewGame(Settings);
        }
        public void NewGame(Settings settings)
        {
            if(!Engine.Ready){Settings=settings;Dialog=null;Hud.Rebuild();return;}
            Engine.Cancel();Thinking=false;SaveRecord();Settings=settings;replayRecord=null;ReplayPlaying=false;Motion=null;Pending=null;Dialog=null;ResultDismissed=false;State=Data.Config.initial.Copy();
            Record=new MatchRecord{rulesVersion=Data.Config.initial.rulesVersion,id=Guid.NewGuid().ToString(),createdAt=DateTime.UtcNow.ToString("o"),seed=(uint)UnityEngine.Random.Range(1,int.MaxValue),settings=new RecordSettings{mode=settings.mode,human=settings.human,difficulty=settings.difficulty,aiLevels=new RecordLevels{south=settings.southLevel,north=settings.difficulty}}};
            Paused=false;history.Clear();Engine.ClearCache();history.Add(Engine.Inspect(State).positionIdentity);ClearSelection();Refresh();SaveRecord();
        }
        private static Settings SettingsOf(MatchRecord record)
        {
            var s=record.settings;var north=s.aiLevels!=null&&s.aiLevels.north>0?s.aiLevels.north:s.difficulty;var south=s.aiLevels!=null&&s.aiLevels.south>0?s.aiLevels.south:s.difficulty;
            return new Settings{mode=string.IsNullOrEmpty(s.mode)?"human-vs-ai":s.mode,human=s.human,difficulty=s.mode=="ai-vs-ai"?north:s.human=="north"?south:north,southLevel=south};
        }
        public void Open(string dialog){CancelThinking();Dialog=dialog;ReplayPlaying=false;ClearSelection();Hud.Rebuild();}
        public void Close(){Dialog=null;Hud.Rebuild();}
        public void ClearSelection(){SelectedId=null;SelectedStock=null;selected=Array.Empty<Preview>();Safety.Clear();cellColors.Clear();HoverPreview=null;hover=null;Hud?.Rebuild();}
        public void SelectStock(string kind){if(!CanInput||State.stocks.Of(State.turn).Count(kind)<=0)return;SelectedStock=kind;SelectedId=null;grab=new Cell();selected=legal.moves.Where(m=>m.action.type=="place"&&m.action.kind==kind).ToArray();ComputeSafety();Hud.Rebuild();}
        private bool CanInput=>Engine.Ready&&!Busy&&Dialog==null&&Pending==null&&!Replaying&&HumanTurn&&State.phase=="playing";
        public void Click(Cell cell)
        {
            if(!CanInput)return;
            var at=new Cell(cell.x-grab.x,cell.y-grab.y);
            var choices=selected.Where(m=>m.action.Destination.Same(at)).ToArray();
            if(choices.Length>0&&(SelectedStock!=null||State.pieces.Any(p=>p.id==SelectedId&&p.owner==State.turn))){ChooseDestination(choices);return;}
            var piece=State.pieces.FirstOrDefault(p=>Data.Body(p).Any(c=>c.Same(cell)));
            if(piece==null){ClearSelection();return;}
            SelectedId=piece.id;SelectedStock=null;grab=new Cell(cell.x-piece.at.x,cell.y-piece.at.y);
            var inspected=State;if(piece.owner!=State.turn){inspected=State.Copy();inspected.turn=piece.owner;}
            selected=Engine.Inspect(inspected,false).moves.Where(m=>m.action.pieceId==piece.id).ToArray();
            if(piece.owner==Viewer)ComputeSafety();else Safety.Clear();Hud.Rebuild();
        }
        private void ChooseDestination(Preview[] choices)
        {
            var decisive=choices.FirstOrDefault(p=>p.captured.Any(c=>c.kind=="walrus"));
            if(decisive!=null||choices.Length==1){Commit(decisive??choices[0]);return;}
            if(choices[0].piece.kind=="seal"){Commit(choices.Last());return;}
            Pending=choices;Motion=new NativeMotion(Data,State,choices[0],true);capturePlayed=false;Hud.Rebuild();
        }
        public void PreviewChoice(int index){if(Pending==null||index<0||index>=Pending.Length)return;Motion.Preview(Pending[index]);HoverPreview=Pending[index];}
        public void ResolveChoice(int index){if(Pending==null)return;var choice=Pending[index];Motion.Resolve(choice);Pending=null;Apply(choice);Hud.Rebuild();}
        public void CancelChoice(){if(Pending==null)return;Motion.Return();Pending=null;HoverPreview=null;Hud.Rebuild();}
        private void Commit(Preview preview){Motion=new NativeMotion(Data,State,preview);capturePlayed=false;Apply(preview);}
        private void Apply(Preview preview)
        {
            State=preview.after;last=preview;Record.actions.Add(preview.action);history.Add(Engine.Inspect(State).positionIdentity);Engine.ClearCache();ClearSelection();Marks.Clear();SaveRecord();Hud.Rebuild();
        }
        private void Refresh()
        {
            Engine.ClearCache();legal=Engine.Inspect(State);Marks.Clear();Safety.Clear();
            if(State.phase=="playing")
            {
                var enemy=State.Copy();enemy.turn=NativeGameData.Other(Viewer);var enemyMoves=Engine.Inspect(enemy,false).moves;
                foreach(var piece in State.pieces.Where(p=>p.owner==Viewer))
                    if(enemyMoves.Any(m=>m.captured.Any(c=>c.id==piece.id)))Marks[piece.id]="danger";
                var mine=State.Copy();mine.turn=Viewer;var myMoves=Engine.Inspect(mine,false).moves;
                foreach(var move in myMoves)if(move.captured.Any(p=>p.owner!=Viewer&&p.kind=="walrus"))Marks[move.piece.id]="king";
                var king=State.pieces.FirstOrDefault(p=>p.owner==Viewer&&p.kind=="walrus");
                if(king!=null&&enemyMoves.Any(m=>m.captured.Any(p=>p.id==king.id))&&myMoves.Where(m=>m.piece.id==king.id).All(m=>Assess(m.after,m.piece).unsafeCell))
                    foreach(var group in myMoves.Where(m=>m.piece.id!=king.id).GroupBy(m=>m.piece.id))if(group.Any(m=>!Assess(m.after,m.piece).kingDanger)&&(!Marks.TryGetValue(group.Key,out var mark)||mark!="king"))Marks[group.Key]="helper";
                foreach(var piece in State.pieces.Where(p=>Marks.TryGetValue(p.id,out var mark)&&mark=="danger"))if(Assess(State,piece).Red&&myMoves.Where(m=>m.piece.id==piece.id).All(m=>Assess(m.after,m.piece).Red))Marks[piece.id]="trapped";
            }
            Hud.Rebuild();
        }
        public CellSafety Assess(Position next,PieceState piece)
        {
            var owner=piece.owner;if(next.phase=="finished")return new CellSafety{unsafeCell=next.result?.winner==NativeGameData.Other(owner)};
            var inspected=next;if(next.turn==owner){inspected=next.Copy();inspected.turn=NativeGameData.Other(owner);}
            var replies=Engine.Inspect(inspected,false).moves;var captures=replies.Where(m=>m.captured.Any(c=>c.id==piece.id)).ToArray();var kingDanger=replies.Any(m=>m.captured.Any(c=>c.kind=="walrus"&&c.owner==owner));
            var trap=!kingDanger&&piece.kind!="walrus"&&captures.Length>0&&captures.All(m=>m.piece.kind=="walrus"&&m.after.phase=="playing"&&Engine.Inspect(m.after,false).moves.Any(counter=>counter.captured.Any(c=>c.id==m.piece.id)&&counter.after.result?.winner==owner));
            return new CellSafety{unsafeCell=kingDanger||captures.Length>0,kingDanger=kingDanger,trap=trap};
        }
        private void ComputeSafety()
        {
            Safety.Clear();cellColors.Clear();foreach(var group in selected.GroupBy(m=>m.action.Destination.x+","+m.action.Destination.y))
            {
                var safety=Assess(group.First().after,group.First().piece);var alternatives=group.Select(m=>Assess(m.after,m.piece)).ToArray();
                var transformationSafe=safety.unsafeCell&&alternatives.Any(s=>!s.unsafeCell);Safety[group.Key]=safety;
                cellColors[group.Key]=transformationSafe?Data.Config.colors.transformation:safety.kingDanger?Data.Config.colors.kingDanger:safety.trap?Data.Config.colors.kingCaptureTrap:safety.unsafeCell?Data.Config.colors.danger:Data.Config.colors.safe;
            }
            if(SelectedId!=null){var piece=State.pieces.First(p=>p.id==SelectedId);var stationary=Assess(State,piece);Safety["stationary"]=stationary;if(stationary.Red&&selected.All(m=>Assess(m.after,m.piece).Red)&&Marks.TryGetValue(piece.id,out var mark)&&mark=="danger")Marks[piece.id]="trapped";}
        }
        public string CellColor(Preview preview)
        {
            var key=preview.action.Destination.x+","+preview.action.Destination.y;return cellColors.TryGetValue(key,out var color)?color:Data.Config.colors.safe;
        }
        private void StartThinking(){Thinking=true;ThinkingStarted=Time.unscaledTime;var level=Settings.mode=="ai-vs-ai"&&State.turn=="south"?Settings.southLevel:Settings.difficulty;ThinkingBudget=Data.Level(level).thinkingMs/1000;Engine.Search(new EngineRequest{state=State,profile=Data.Profile(level),seed=Record.seed,positionHistory=history.ToArray()});Hud.Rebuild();}
        private void OnAi(AiResult result){if(!Thinking||result.revision!=State.revision||Replaying)return;Thinking=false;stepRequested=false;if(!string.IsNullOrEmpty(result.error)){Hud.Notify(result.error);return;}var move=Find(legal,result.action);if(move!=null)Commit(move);else Hud.Notify("AIの手を適用できませんでした。再試行してください。");}
        public void CancelThinking(){if(Thinking){Engine.Cancel();Thinking=false;}}
        public void StepAi(){Paused=true;stepRequested=true;}
        private static Preview Find(Inspection inspected,GameAction action)=>NativeActions.Find(inspected,action);
        private void HandleInput()
        {
            if(Input.GetKeyDown(KeyCode.Escape)){if(Pending!=null)CancelChoice();else if(Dialog!=null)Close();else ClearSelection();}
            var mouse=(Vector2)Input.mousePosition;
            if(Input.GetMouseButtonDown(0)&&!Hud.Blocks(mouse)){pointerDown=true;down=mouse;}
            if(CanInput&&ResolveCell(mouse,out var cell))
            {
                if(hover==null||!hover.Same(cell)){hover=cell;var at=new Cell(cell.x-grab.x,cell.y-grab.y);HoverPreview=selected.FirstOrDefault(m=>m.action.Destination.Same(at));}
            }else if(Pending==null){hover=null;HoverPreview=null;}
            if(Input.GetMouseButtonUp(0))
            {
                if(pointerDown&&(down-mouse).magnitude<8&&!Hud.Blocks(mouse))
                {
                    if(ResolveCell(mouse,out var clicked))Click(clicked);
                }
                pointerDown=false;
            }
        }
        private bool ResolveCell(Vector2 screen,out Cell cell)
        {
            if(Board.PieceAt(screen,out var id,out var point)){var piece=State.pieces.FirstOrDefault(p=>p.id==id);if(piece!=null){var size=Data.Variant(piece);cell=new Cell(Mathf.Clamp(Mathf.FloorToInt(point.x+5),piece.at.x,piece.at.x+size.width-1),Mathf.Clamp(Mathf.FloorToInt(-point.z+5),piece.at.y,piece.at.y+size.height-1));return true;}}
            return Board.CellAt(screen,out cell);
        }
        private void Draw()
        {
            Board.OceanTime(Time.unscaledTime);
            Board.Begin();var shown=new List<PieceState>(State.pieces);if(Motion!=null)foreach(var victim in Motion.Action.captured)if(!shown.Any(p=>p.id==victim.id))shown.Add(victim);
            foreach(var piece in shown)
            {
                if(Motion!=null&&piece.id==Motion.Action.piece.id){var pose=Motion.Sample();var p=new PieceState{id=piece.id,kind=piece.kind,owner=piece.owner,at=piece.at,promoted=pose.promoted};var morph=piece.kind=="penguin"?Mathf.Abs(pose.morph-(Motion.Before?.promoted==true?1:0)):-1;Board.Piece(p,pose.position,pose.yaw,pose.scale,morph,Motion.Before?.promoted??false);}
                else{var eaten=Motion!=null&&Motion.Action.captured.Any(p=>p.id==piece.id)?Motion.CaptureProgress(piece):0;Board.Piece(piece,Data.Center(piece)+Vector3.up*eaten*.7f,NativeGameData.Facing(piece),1-eaten);}
            }
            var inspecting=SelectedId!=null&&State.pieces.Any(p=>p.id==SelectedId&&p.owner!=Viewer);
            if(!Busy)
            {
                foreach(var move in selected.GroupBy(m=>m.action.Destination.x+","+m.action.Destination.y).Select(g=>g.First()))
                {
                    var color=inspecting?Data.Config.colors.enemy:CellColor(move);foreach(var c in move.footprint)Board.Guide(c,color==Data.Config.colors.safe?Data.Config.colors.fill:color,inspecting?.24f+.08f*Mathf.Sin(Time.unscaledTime*2.24f):.2f);
                    if(!inspecting)Board.Guide(new Cell(move.action.Destination.x+grab.x,move.action.Destination.y+grab.y),color,1,true);
                }
                if(Stationary!=null){var p=State.pieces.First(v=>v.id==SelectedId);var s=Safety.TryGetValue("stationary",out var value)?value:new CellSafety();var color=inspecting?Data.Config.colors.enemy:s.kingDanger?Data.Config.colors.kingDanger:s.trap?Data.Config.colors.kingCaptureTrap:s.unsafeCell?Data.Config.colors.danger:Data.Config.colors.safe;foreach(var c in Data.Body(p))Board.Guide(c,color==Data.Config.colors.safe?Data.Config.colors.fill:color,.2f,layer:1);if(!inspecting)Board.Guide(new Cell(p.at.x+grab.x,p.at.y+grab.y),color,1,true,1);}
            }
            var preview=HoverPreview??(Motion?.Stage=="return"?null:Motion?.Action);
            if(preview!=null){var color=inspecting?Data.Config.colors.enemy:CellColor(preview);foreach(var c in preview.captureCells.Concat(preview.footprint).GroupBy(c=>c.x+","+c.y).Select(g=>g.First())){Board.Guide(c,color==Data.Config.colors.safe?Data.Config.colors.fill:color,.34f,layer:2);if(Motion==null)Board.Outline(c,color);}if(preview.action.type=="place"&&Motion==null)Board.Piece(preview.piece,Data.Center(preview.piece),NativeGameData.Facing(preview.piece),.82f);}
            if(last!=null&&SelectedId==null&&SelectedStock==null)foreach(var c in last.footprint)Board.Guide(c,"#ffffff",.1f);
            if(Dialog=="catalog"){var variant=Data.Config.variants[Hud.CatalogIndex];var piece=new PieceState{id="catalog",kind=variant.kind,promoted=variant.promoted,owner="south",at=new Cell()};Board.Piece(piece,new Vector3(50,0,0),Hud.CatalogAngle);}
            NativeEffects.Draw(Board,Motion,Data);
            Board.End();
        }
        public void TogglePause(){Paused=!Paused;if(Paused)CancelThinking();Hud.Rebuild();}
        private void SaveRecord()
        {
            if(Record==null)return;
            try
            {
                NativeStorage.Write("match",NativeJson.Encode(Record));
                if(Record.actions.Count>0){Replays.RemoveAll(r=>r.id==Record.id);Replays.Insert(0,Record);SaveLibrary();}
                NativeStorage.Flush();
            }
            catch(Exception error){Debug.LogException(error);Hud.Notify("棋譜を保存できませんでした。ファイルに保存してください。");}
        }
        private void SaveLibrary()=>NativeStorage.Write("replays",NativeJson.Encode(new ReplayList{items=Replays}));
        private void LoadLibrary()
        {
            try{var text=NativeStorage.Read("replays","azarashi.unity.replays.v1");if(text.Length>0){var list=JsonUtility.FromJson<ReplayList>(text);if(list?.items!=null)Replays.AddRange(list.items.Where(r=>r?.settings!=null&&r.actions!=null));}}
            catch(Exception error){Debug.LogWarning("Native replay library could not be loaded: "+error.Message);}
        }
        private List<Position> Validate(MatchRecord record)
        {
            if(record==null||record.rulesVersion!=Data.Config.initial.rulesVersion||record.version!=1||record.actions==null||record.settings==null||string.IsNullOrEmpty(record.id))throw new InvalidOperationException("棋譜の形式が違います。");
            var settings=record.settings;
            if(!new[]{"human-vs-ai","ai-vs-ai","local-pvp"}.Contains(settings.mode)||!new[]{"south","north"}.Contains(settings.human)||Data.Level(settings.difficulty)==null)throw new InvalidOperationException("棋譜の対局設定が不正です。");
            if(settings.aiLevels!=null&&(Data.Level(settings.aiLevels.south)==null||Data.Level(settings.aiLevels.north)==null))throw new InvalidOperationException("棋譜のAI設定が不正です。");
            var states=new List<Position>{Data.Config.initial.Copy()};
            foreach(var action in record.actions){var move=Find(Engine.Inspect(states.Last()),action);if(move==null)throw new InvalidOperationException("棋譜に不正な手があります。");states.Add(move.after);}
            return states;
        }
        public void ImportReplay(string text)
        {
            try{var record=NativeJson.Record(text);Validate(record);Replays.RemoveAll(r=>r.id==record.id);Replays.Insert(0,record);SaveLibrary();NativeStorage.Flush();Hud.Rebuild();}
            catch(Exception error){Hud.Notify(error.Message);}
        }
        public void Watch(MatchRecord record){CancelThinking();replayStates=Validate(record);replayRecord=record;ReplayCursor=0;ReplayPlaying=true;State=replayStates[0];Motion=null;Pending=null;Dialog=null;last=null;ClearSelection();Refresh();nextReplay=Time.unscaledTime+.3f;}
        public void StepReplay(int direction){if(!Replaying||Motion!=null)return;var next=Mathf.Clamp(ReplayCursor+direction,0,ReplayTotal);if(next==ReplayCursor)return;var before=State;var preview=next==ReplayCursor+1?Find(Engine.Inspect(before),replayRecord.actions[ReplayCursor]):null;ReplayCursor=next;State=replayStates[next];last=preview;Motion=preview==null?null:new NativeMotion(Data,before,preview);Marks.Clear();Hud.Rebuild();}
        public void SeekReplay(int cursor){if(!Replaying)return;ReplayPlaying=false;Motion=null;ReplayCursor=Mathf.Clamp(cursor,0,ReplayTotal);State=replayStates[ReplayCursor];last=null;Refresh();}
        public void EndReplay(){replayRecord=null;ReplayPlaying=false;Motion=null;State=Validate(Record).Last();Refresh();}
        public void Export(MatchRecord record,bool text){NativeEngine.AzarashiDownload("azarashi-"+record.id+(text?".txt":".json"),text?Commentary(record):NativeJson.Encode(record,true));}
        private string Commentary(MatchRecord record){var states=Validate(record);var lines=new List<string>{"アザラシ将棋 対局記録","ルールバージョン: "+record.rulesVersion,"先手は南（前方y減少）、後手は北（前方y増加）。座標はx=0〜9、y=0〜9。王の捕食で決着。"};for(var i=0;i<record.actions.Count;i++){var preview=Find(Engine.Inspect(states[i]),record.actions[i]);lines.Add((i+1)+"手目 "+states[i].turn+" "+Data.Name(preview.piece)+" "+NativeJson.Encode(preview.action)+" 捕食: "+string.Join(",",preview.captured.Select(p=>p.owner+" "+Data.Name(p)))+"\n局面: "+NativeJson.Encode(states[i+1]));}return string.Join("\n",lines);}
        public void StorageError(string _)=>Hud.Notify("棋譜を端末に保存できませんでした。ファイルに保存してください。");
        private void OnDestroy(){Engine?.Cancel();}
    }
}
