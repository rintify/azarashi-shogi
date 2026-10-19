using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.UIElements;

namespace Azarashi.UnityView
{
    /// <summary>Native Unity UI Toolkit HUD. No React DOM, browser buttons or CSS are used at runtime.</summary>
    public sealed class NativeHud:MonoBehaviour
    {
        private NativeMatch match;
        private UIDocument document;
        private VisualElement root,hud,markers,choice,clock,result;
        private Label status,opponentLabel;
        private NativeSymbol clockIcon;
        private readonly Dictionary<string,Label> counts=new Dictionary<string,Label>();
        private readonly Dictionary<string,VisualElement> stockTargets=new Dictionary<string,VisualElement>();
        private readonly Dictionary<string,VisualElement> markNodes=new Dictionary<string,VisualElement>();
        private readonly Dictionary<string,Texture2D> icons=new Dictionary<string,Texture2D>();
        private readonly List<VisualElement> orbs=new List<VisualElement>();
        private float uiScale=1,width=1280,height=720,clockAmount;
        private bool expanded,gridOpen,dirty=true;
        private int choiceCount=-1,choiceIndex;
        private string resultKey,message;
        private Settings draft;
        private float messageUntil,resultStarted;
        private readonly List<VisualElement> celebration=new List<VisualElement>();
        public int CatalogIndex;
        public bool CatalogSpins=true;
        public float CatalogAngle;
        private Camera catalogCamera;
        private RenderTexture catalogTexture;
        public Rect PlayArea=>new Rect(14*uiScale,132*uiScale,(width-28)*uiScale,Mathf.Max(80,height-(match?.Replaying==true?270:210))*uiScale);
        #if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern float AzarashiPixelRatio();
        #endif
        private static Color C(string hex){ColorUtility.TryParseHtmlString(hex,out var c);return c;}
        public void Initialize(NativeMatch owner)
        {
            match=owner;document=gameObject.AddComponent<UIDocument>();document.panelSettings=Resources.Load<PanelSettings>("Native/PanelSettings");
            root=document.rootVisualElement;root.pickingMode=PickingMode.Ignore;root.style.position=UnityEngine.UIElements.Position.Absolute;root.style.left=0;root.style.top=0;root.style.right=0;root.style.bottom=0;
            root.style.unityFontDefinition=FontDefinition.FromFont(Resources.Load<Font>("Native/NotoSansJP"));root.style.color=C("#375775");root.style.fontSize=14;
            foreach(var variant in match.Data.Config.variants){var key=variant.kind+"-"+(variant.promoted?1:0);icons[key]=Resources.Load<Texture2D>("Native/Icons/"+key);}
            catalogTexture=new RenderTexture(512,640,16,RenderTextureFormat.ARGB32);catalogTexture.Create();
            catalogCamera=new GameObject("Native catalog camera").AddComponent<Camera>();catalogCamera.targetTexture=catalogTexture;catalogCamera.cullingMask=1<<1;catalogCamera.fieldOfView=32;catalogCamera.backgroundColor=C("#d9edf3");catalogCamera.clearFlags=CameraClearFlags.SolidColor;catalogCamera.transform.position=new Vector3(52,1.95f,-3.2f);catalogCamera.transform.LookAt(new Vector3(50,.5f,0));catalogCamera.enabled=false;
            Rebuild();
        }
        public void Notify(string text){message=text;messageUntil=Time.unscaledTime+6;dirty=true;}
        public void Rebuild(){dirty=true;}
        private VisualElement Box(VisualElement parent,string name,float x,float y,float w,float h,string fill=null,float radius=0,bool block=false)
        {
            var v=new VisualElement{name=name,pickingMode=block?PickingMode.Position:PickingMode.Ignore,userData=block?"native-ui":null};v.style.position=UnityEngine.UIElements.Position.Absolute;v.style.left=x;v.style.top=y;v.style.width=w;v.style.height=h;if(fill!=null)v.style.backgroundColor=C(fill);Round(v,radius);parent.Add(v);return v;
        }
        private static void Round(VisualElement v,float radius){v.style.borderTopLeftRadius=radius;v.style.borderTopRightRadius=radius;v.style.borderBottomLeftRadius=radius;v.style.borderBottomRightRadius=radius;}
        private static void Border(VisualElement v,float width,string color){v.style.borderLeftWidth=width;v.style.borderRightWidth=width;v.style.borderTopWidth=width;v.style.borderBottomWidth=width;var c=C(color);v.style.borderLeftColor=c;v.style.borderRightColor=c;v.style.borderTopColor=c;v.style.borderBottomColor=c;}
        private Label Text(VisualElement parent,string text,float x,float y,float w,float h,int size=14,string color="#375775",bool bold=false,TextAnchor anchor=TextAnchor.MiddleLeft)
        {var v=new Label(text){pickingMode=PickingMode.Ignore};v.enableRichText=false;v.style.position=UnityEngine.UIElements.Position.Absolute;v.style.left=x;v.style.top=y;v.style.width=w;v.style.height=h;v.style.fontSize=size;v.style.color=C(color);v.style.unityTextAlign=anchor;v.style.unityFontStyleAndWeight=bold?FontStyle.Bold:FontStyle.Normal;v.style.paddingLeft=0;v.style.paddingRight=0;v.style.paddingTop=0;v.style.paddingBottom=0;parent.Add(v);return v;}
        private void Icon(VisualElement parent,string kind,bool promoted,float x,float y,float size)
        {if(!icons.TryGetValue(kind+"-"+(promoted?1:0),out var texture)||texture==null)return;var v=Box(parent,"animal-icon",x,y,size,size);v.style.backgroundImage=new StyleBackground(texture);v.style.unityBackgroundScaleMode=ScaleMode.ScaleToFit;}
        private Button Button(VisualElement parent,string label,float x,float y,float w,float h,Action action,string fill="#fff8e9",int size=14)
        {
            var b=new Button(action){text=label,userData="native-ui"};b.style.position=UnityEngine.UIElements.Position.Absolute;b.style.left=x;b.style.top=y;b.style.width=w;b.style.height=h;b.style.marginLeft=0;b.style.marginRight=0;b.style.marginTop=0;b.style.marginBottom=0;b.style.paddingLeft=4;b.style.paddingRight=4;b.style.fontSize=size;b.style.color=C("#375775");b.style.backgroundColor=C(fill);b.style.unityFontStyleAndWeight=FontStyle.Bold;Round(b,Mathf.Min(h*.5f,22));Border(b,3,"#ffffff");b.style.borderBottomWidth=5;b.style.borderBottomColor=C("#b1ceda");
            b.style.transitionProperty=new List<StylePropertyName>{new StylePropertyName("scale"),new StylePropertyName("opacity")};b.style.transitionDuration=new List<TimeValue>{new TimeValue(.14f)};
            b.RegisterCallback<PointerDownEvent>(_=>b.style.scale=new Scale(new Vector3(.94f,.94f,1)));b.RegisterCallback<PointerUpEvent>(_=>b.style.scale=new Scale(Vector3.one));b.RegisterCallback<PointerLeaveEvent>(_=>b.style.scale=new Scale(Vector3.one));parent.Add(b);return b;
        }
        private void Enter(VisualElement v){v.style.opacity=0;v.style.scale=new Scale(new Vector3(.96f,.96f,1));v.style.transitionProperty=new List<StylePropertyName>{new StylePropertyName("scale"),new StylePropertyName("opacity")};v.style.transitionDuration=new List<TimeValue>{new TimeValue(.18f)};v.schedule.Execute(()=>{v.style.opacity=1;v.style.scale=new Scale(Vector3.one);});}
        private void Build()
        {
            dirty=false;root.Clear();counts.Clear();stockTargets.Clear();markNodes.Clear();orbs.Clear();celebration.Clear();choiceCount=-1;resultKey=null;
            hud=Box(root,"native-hud",0,0,width,height);markers=Box(root,"native-markers",0,0,width,height);
            var mobile=width<600;var margin=mobile?12:24;var size=mobile?35:44;var gap=mobile?5:8;
            var brand=Button(hud,"",margin,18,mobile?35:48,mobile?35:48,()=>match.Open("catalog"),"#e6f8ff");Icon(brand,"seal",false,2,1,mobile?26:36);
            if(!mobile)Text(hud,"アザラシ将棋",82,20,220,40,22,"#ffffff",true);
            var labels=new[]{match.Muted?"mute":"sound","book","replay","reset",match.TopView?"cube":"view","grid"};
            Action[] actions={ ()=>{match.Muted=!match.Muted;Rebuild();},()=>match.Open("rules"),()=>match.Open("replays"),()=>match.Open("settings"),()=>{match.TopView=!match.TopView;Rebuild();},()=>{gridOpen=!gridOpen;Rebuild();} };
            for(var i=0;i<labels.Length;i++){var index=i;var b=Button(hud,"",width-margin-(labels.Length-i)*(size+gap)+gap,18,size,size,actions[i],i==0?"#ffdf81":i==1?"#e5dfff":i==2?"#ffe1e8":"#fff8e9");var symbol=new NativeSymbol(labels[index]){pickingMode=PickingMode.Ignore};symbol.style.position=UnityEngine.UIElements.Position.Absolute;symbol.style.left=7;symbol.style.top=7;symbol.style.width=size-18;symbol.style.height=size-18;b.Add(symbol);}
            var opponent=NativeGameData.Other(match.Viewer);StockBar(hud,opponent,80,Mathf.Min(420,width-28),false);
            status=Text(hud,"",14,126,width-28,28,12,"#ffffff",true,TextAnchor.MiddleCenter);
            if(match.Replaying)BuildReplayDock();else if(match.Settings.mode=="ai-vs-ai")BuildSpectatorDock();else BuildStockDock();
            clock=Box(root,"native-thinking-clock",width+80,mobile?132:85,64,65);clockIcon=new NativeSymbol("clock"){pickingMode=PickingMode.Ignore};clockIcon.style.position=UnityEngine.UIElements.Position.Absolute;clockIcon.style.left=20;clockIcon.style.top=0;clockIcon.style.width=24;clockIcon.style.height=24;clock.Add(clockIcon);Text(clock,"AI 思考中",0,26,64,20,9,"#e0f3ff",false,TextAnchor.MiddleCenter);
            if(gridOpen)BuildGrid();
            choice=Box(root,"native-promotion",0,0,width,height);result=Box(root,"native-result",0,0,width,height);
            if(match.Dialog!=null)BuildDialog(match.Dialog);
            if(message!=null&&Time.unscaledTime<messageUntil){var n=Box(root,"notice",14,height-142,width-28,48,"#fff6e9",18);Text(n,message,12,4,width-52,40,12);}
        }
        private void BuildGrid()
        {
            var size=Mathf.Min(width-28,height-242);var cellSize=size/10;var panel=Box(root,"native-coordinate-board",(width-size)*.5f,156+(height-242-size)*.5f,size,size,null,0,true);panel.SendToBack();var buttons=new List<Button>();
            var moves=match.SelectedMoves.ToArray();var enemy=match.SelectedId!=null&&match.State.pieces.Any(p=>p.id==match.SelectedId&&p.owner!=match.Viewer);
            for(var index=0;index<100;index++)
            {
                var display=index;var n=match.Viewer=="south"?index:99-index;var cell=new Cell(n%10,n/10);var piece=match.State.pieces.FirstOrDefault(p=>match.Data.Body(p).Any(c=>c.Same(cell)));var move=moves.FirstOrDefault(m=>m.footprint.Any(c=>c.Same(cell)));
                var color=move==null?(cell.x+cell.y)%2==0?"#e3f0f5":"#b9d4e0":enemy?match.Data.Config.colors.enemy:match.CellColor(move);
                var button=Button(panel,"",index%10*cellSize,index/10*cellSize,cellSize-1,cellSize-1,()=>match.Click(cell),color,10);Round(button,4);Border(button,1,"#eefaff");button.style.borderBottomWidth=1;buttons.Add(button);button.tooltip=(cell.x+1)+","+(cell.y+1)+(piece==null?"":" "+match.Data.Name(piece));
                if(piece!=null){var iconSize=Mathf.Min(28,cellSize-7);Icon(button,piece.kind,piece.promoted,(cellSize-iconSize)*.5f,(cellSize-iconSize)*.5f,iconSize);if(piece.owner!=match.Viewer)Border(button,1,"#e89d72");}
                button.RegisterCallback<KeyDownEvent>(evt=>{var offset=evt.keyCode==KeyCode.LeftArrow?-1:evt.keyCode==KeyCode.RightArrow?1:evt.keyCode==KeyCode.UpArrow?-10:evt.keyCode==KeyCode.DownArrow?10:0;if(offset!=0){buttons[Mathf.Clamp(display+offset,0,99)].Focus();evt.StopPropagation();}});
            }
        }
        private void StockBar(VisualElement parent,string owner,float y,float w,bool own)
        {
            var x=(width-w)*.5f;var p=Box(parent,"stock-"+owner,x,y,w,44,own?"#f1fcff":"#fff8ee",24,true);Border(p,3,"#ffffff");
            var label=own?"持ち駒":match.Actor(owner)+(match.Settings.mode=="local-pvp"?"":" Lv."+(owner=="south"?match.Settings.southLevel:match.Settings.difficulty));
            opponentLabel=Text(p,label,12,7,w*.35f,28,12,bold:own);
            var kinds=new[]{"seal","penguin","bear","orca"};var left=w*.39f;var step=(w-left-(own?42:10))/4;
            for(var i=0;i<4;i++){var kind=kinds[i];var target=Box(p,"stock-target",left+i*step,5,step,30);stockTargets[owner+":"+kind]=target;Icon(target,kind,false,0,2,25);var number=Text(target,"0",27,1,22,28,13);counts[owner+":"+kind]=number;}
        }
        private void BuildStockDock()
        {
            var w=Mathf.Min(420,width-28);StockBar(hud,match.Viewer,height-60,w,true);
            var toggle=Button(hud,"",(width-w)*.5f+w-36,height-57,32,36,()=>{expanded=!expanded;Rebuild();},"#eefbff",16);toggle.style.backgroundColor=Color.clear;Border(toggle,0,"#ffffff");var arrow=new NativeSymbol(expanded?"chevron-down":"chevron-up"){pickingMode=PickingMode.Ignore};arrow.style.width=18;arrow.style.height=18;toggle.Add(arrow);
            var click=Box(hud,"stock-open",(width-w)*.5f,height-60,w-40,44,null,0,true);click.RegisterCallback<ClickEvent>(_=>{expanded=!expanded;Rebuild();});
            if(expanded)
            {
                var tray=Box(hud,"placement-tray",(width-w)*.5f,height-184,w,112,"#f4fcff",24,true);Border(tray,3,"#ffffff");Enter(tray);
                var kinds=new[]{"seal","penguin","bear","orca"};for(var i=0;i<4;i++){var kind=kinds[i];var bw=(w-20)/4;var b=Button(tray,"",10+i*bw,10,bw-6,88,()=>{match.SelectStock(kind);expanded=false;Rebuild();},match.SelectedStock==kind?"#c0edf7":"#fffaf0");Icon(b,kind,false,(bw-44)*.5f,4,38);Text(b,match.Data.Config.pieces.First(p=>p.kind==kind).name,0,44,bw-10,18,11,bold:true,anchor:TextAnchor.MiddleCenter);Text(b,"×"+match.State.stocks.Of(match.State.turn).Count(kind),0,62,bw-10,16,11,anchor:TextAnchor.MiddleCenter);}
            }
            if(match.Pending==null&&(match.SelectedId!=null||match.SelectedStock!=null))Button(hud,"×",width-50,height-108,36,36,match.ClearSelection,"#fff5e4",20);
            Text(hud,"あなたは"+(match.Settings.mode=="local-pvp"?match.Actor(match.State.turn):match.Settings.human=="south"?"先手・青":"後手・橙"),0,height-15,width,14,9,"#e4f4fa",false,TextAnchor.MiddleCenter);
        }
        private void BuildSpectatorDock(){var w=Mathf.Min(420,width-28);StockBar(hud,match.Viewer,height-112,w,true);Button(hud,match.Paused?"再生":"一時停止",width*.5f-76,height-58,96,42,match.TogglePause,"#ffe08a",12);Button(hud,"1手進む",width*.5f+28,height-58,84,42,match.StepAi,"#fff8e9",12);}
        private void BuildReplayDock()
        {
            var w=Mathf.Min(450,width-20);var p=Box(hud,"replay-dock",(width-w)*.5f,height-118,w,104,"#ecfaff",24,true);Border(p,3,"#ffffff");
            Text(p,match.ReplayCursor+" / "+match.ReplayTotal+" 手",12,7,w-24,20,12,anchor:TextAnchor.MiddleCenter);
            Slider(p,match.ReplayCursor,0,Mathf.Max(1,match.ReplayTotal),12,32,w-24,v=>match.SeekReplay(Mathf.RoundToInt(v)),true);
            Button(p,"|◀",10,57,42,36,()=>match.SeekReplay(0),"#eefaff",12);Button(p,"◀",57,57,42,36,()=>match.StepReplay(-1),"#eefaff",12);
            Button(p,match.ReplayPlaying?"Ⅱ":"▶",w*.5f-24,51,48,46,()=>{match.ReplayPlaying=!match.ReplayPlaying;Rebuild();},"#ffe08a",18);
            Button(p,"▶",w-147,57,42,36,()=>match.StepReplay(1),"#eefaff",12);Button(p,match.ReplaySpeed+"×",w-100,57,42,36,()=>{match.ReplaySpeed=match.ReplaySpeed==1?2:match.ReplaySpeed==2?.5f:1;Rebuild();},"#eefaff",11);Button(p,"×",w-53,57,42,36,match.EndReplay,"#eefaff",20);
        }
        private void Slider(VisualElement parent,float value,float min,float max,float x,float y,float w,Action<float> changed,bool onRelease=false)
        {
            var track=Box(parent,"native-slider",x,y,w,20,null,0,true);Box(track,"track",0,8,w,5,"#bbdae7",3);var fill=Box(track,"fill",0,8,w*(value-min)/(max-min),5,"#5ba3bd",3);var thumb=Box(track,"thumb",(w-14)*(value-min)/(max-min),3,14,14,"#5ba3bd",8);
            Action<Vector2> set=point=>{var t=Mathf.Clamp01((point.x-track.worldBound.x)/Mathf.Max(1,w));fill.style.width=w*t;thumb.style.left=(w-14)*t;if(!onRelease)changed(Mathf.Lerp(min,max,t));};
            track.RegisterCallback<PointerDownEvent>(evt=>{track.CapturePointer(evt.pointerId);set(evt.position);evt.StopPropagation();});track.RegisterCallback<PointerMoveEvent>(evt=>{if(track.HasPointerCapture(evt.pointerId))set(evt.position);});track.RegisterCallback<PointerUpEvent>(evt=>{if(onRelease){var t=Mathf.Clamp01((evt.position.x-track.worldBound.x)/Mathf.Max(1,w));changed(Mathf.Lerp(min,max,t));}track.ReleasePointer(evt.pointerId);});
        }
        private VisualElement Modal(string title,float desiredHeight,float maxWidth=540)
        {
            var shade=Box(root,"dialog-shade",0,0,width,height,"#173e5260",0,true);var w=Mathf.Min(maxWidth,width-28);var h=Mathf.Min(desiredHeight,height-50);var card=Box(shade,"native-dialog",(width-w)*.5f,(height-h)*.5f,w,h,"#fffaf0",28,true);Border(card,3,"#ffffff");Text(card,title,20,14,w-80,35,18,bold:true);Button(card,"×",w-54,12,36,36,match.Close,"#fffaf0",22);Enter(card);return card;
        }
        private void BuildDialog(string dialog)
        {
            if(dialog=="settings")SettingsDialog();else if(dialog=="replays")ReplayDialog();else if(dialog=="catalog")CatalogDialog();else RulesDialog();
        }
        private void SettingsDialog()
        {
            if(draft==null)draft=JsonUtility.FromJson<Settings>(JsonUtility.ToJson(match.Settings));var current=draft;var desired=current.mode=="local-pvp"?300:current.mode=="human-vs-ai"?440:500;var card=Modal("新しい対局",desired);var w=Mathf.Min(540,width-28);var h=Mathf.Min(desired,height-50);
            Text(card,"遊び方を選んではじめよう",20,57,w-40,25,12);
            var modes=new[]{"human-vs-ai","ai-vs-ai","local-pvp"};var names=new[]{"あなた vs AI","AI vs AI","ローカルPvP"};
            for(var i=0;i<3;i++){var mode=modes[i];var b=Button(card,names[i],20+i*(w-40)/3,94,(w-52)/3,58,()=>{current.mode=mode;Rebuild();},current.mode==mode?"#c9edf7":"#f2eee6",11);}
            if(current.mode=="human-vs-ai"){Text(card,"あなたの手番",20,170,w-40,22,13,bold:true);Button(card,"先手",20,200,(w-50)/2,45,()=>{current.human="south";Rebuild();},current.human=="south"?"#c9edf7":"#f5f0e8");Button(card,"後手",30+(w-50)/2,200,(w-50)/2,45,()=>{current.human="north";Rebuild();},current.human=="north"?"#c9edf7":"#f5f0e8");}
            if(current.mode!="local-pvp")
            {
                var y=current.mode=="ai-vs-ai"?175:267;
                var levelText=Text(card,(current.mode=="ai-vs-ai"?"後手AI":"AI")+" · Lv."+current.difficulty+" "+match.Data.Level(current.difficulty).name,20,y,w-40,24,13,bold:true);
                Slider(card,current.difficulty,1,match.Data.Config.levels.Length,24,y+33,w-48,v=>{current.difficulty=Mathf.RoundToInt(v);levelText.text=(current.mode=="ai-vs-ai"?"後手AI":"AI")+" · Lv."+current.difficulty+" "+match.Data.Level(current.difficulty).name;});
                if(current.mode=="ai-vs-ai"){var southText=Text(card,"先手AI · Lv."+current.southLevel+" "+match.Data.Level(current.southLevel).name,20,y+82,w-40,24,13,bold:true);Slider(card,current.southLevel,1,match.Data.Config.levels.Length,24,y+115,w-48,v=>{current.southLevel=Mathf.RoundToInt(v);southText.text="先手AI · Lv."+current.southLevel+" "+match.Data.Level(current.southLevel).name;});}
            }
            Button(card,"対局をはじめる",20,h-72,w-40,48,()=>{expanded=false;match.NewGame(new Settings{mode=current.mode,human=current.human,difficulty=current.difficulty,southLevel=current.southLevel});},"#a7deea",16);
        }
        private void ReplayDialog()
        {
            var card=Modal("対局のリプレイ",Mathf.Min(600,height-50),600);var w=Mathf.Min(600,width-28);var h=Mathf.Min(600,height-50);
            Text(card,"対局はこの端末に自動保存されます",20,56,w-40,24,12);
            var scroll=new ScrollView(ScrollViewMode.Vertical);scroll.style.position=UnityEngine.UIElements.Position.Absolute;scroll.style.left=15;scroll.style.right=15;scroll.style.top=91;scroll.style.bottom=76;card.Add(scroll);
            if(match.Replays.Count==0){var empty=new Label("まだ棋譜がありません");empty.style.paddingTop=24;scroll.Add(empty);}
            foreach(var record in match.Replays)
            {
                var row=new VisualElement();row.style.height=92;row.style.flexShrink=0;row.style.marginBottom=12;row.style.backgroundColor=C("#ecf7fa");Round(row,18);scroll.Add(row);
                Text(row,(record.settings.mode=="ai-vs-ai"?"AI vs AI":record.settings.mode=="local-pvp"?"ふたり対戦":"あなた vs AI")+" · "+record.actions.Count+"手",12,9,w-70,23,13,bold:true);
                Text(row,DateTime.TryParse(record.createdAt,out var date)?date.ToLocalTime().ToString("MM/dd HH:mm"):"",12,35,120,18,10);
                Button(row,"再生",w-242,40,62,36,()=>match.Watch(record),"#aee0eb",12);Button(row,"保存",w-174,40,62,36,()=>match.Export(record,false),"#fff8e9",11);Button(row,"解説用",w-106,40,62,36,()=>match.Export(record,true),"#fff8e9",11);
            }
            Button(card,"棋譜ファイルを読み込む",20,h-63,w-40,43,NativeEngine.AzarashiChooseReplay,"#e7e2ff",12);
        }
        private void RulesDialog()
        {
            var card=Modal("あそびかた",Mathf.Min(630,height-50),600);var scroll=new ScrollView(ScrollViewMode.Vertical);scroll.style.position=UnityEngine.UIElements.Position.Absolute;scroll.style.left=20;scroll.style.right=20;scroll.style.top=65;scroll.style.bottom=22;card.Add(scroll);
            var intro=new Label("持ち駒を選んで、自分の駒の隣に配置。盤上の駒を選ぶと動ける範囲が表示されます。敵の王を捕食したら勝ち！\n\n敵・味方どちらも、重なった駒を丸ごと捕食します。捕食すると変身を選べます。王手で手を禁止するルールはありません。\n");intro.style.whiteSpace=WhiteSpace.Normal;intro.style.fontSize=13;scroll.Add(intro);
            foreach(var p in match.Data.Config.pieces){var label=new Label(p.name+"\n"+p.description+"\n");label.style.whiteSpace=WhiteSpace.Normal;label.style.fontSize=13;scroll.Add(label);}
            var colors=new Label("青：安全　赤：危険　暗い赤：王が危険\n紫：変身すれば安全　黄：王だけが取れて、確実に取り返せるマス\n王冠：王を捕食できる　＋：王を救える助っ人\n×：現在位置と全移動先が危険");colors.style.whiteSpace=WhiteSpace.Normal;colors.style.fontSize=12;scroll.Add(colors);
        }
        private void CatalogDialog()
        {
            var card=Modal("氷のなかま図鑑",Mathf.Min(720,height-45),620);var w=Mathf.Min(620,width-28);var h=Mathf.Min(720,height-45);var variant=match.Data.Config.variants[CatalogIndex];
            var stage=Box(card,"native-catalog-stage",16,65,w-32,h-232,"#d9edf3",24,true);stage.style.backgroundImage=new StyleBackground(Background.FromRenderTexture(catalogTexture));stage.style.unityBackgroundScaleMode=ScaleMode.ScaleToFit;
            var drag=false;var previous=Vector2.zero;stage.RegisterCallback<PointerDownEvent>(e=>{drag=true;previous=e.position;stage.CapturePointer(e.pointerId);});stage.RegisterCallback<PointerMoveEvent>(e=>{if(drag){CatalogAngle+=(e.position.x-previous.x)*.5f;previous=e.position;}});stage.RegisterCallback<PointerUpEvent>(e=>{drag=false;stage.ReleasePointer(e.pointerId);});
            Button(card,"◀",20,65+(h-232)*.48f,40,44,()=>{CatalogIndex=(CatalogIndex+match.Data.Config.variants.Length-1)%match.Data.Config.variants.Length;Rebuild();},"#f6fcff",18);Button(card,"▶",w-60,65+(h-232)*.48f,40,44,()=>{CatalogIndex=(CatalogIndex+1)%match.Data.Config.variants.Length;Rebuild();},"#f6fcff",18);
            Text(card,variant.name,20,h-154,w-40,33,20,bold:true,anchor:TextAnchor.MiddleCenter);Text(card,variant.width+" × "+variant.height+" マス",20,h-122,w-40,23,12,anchor:TextAnchor.MiddleCenter);
            var description=Text(card,match.Data.Config.pieces.First(p=>p.kind==variant.kind).description,24,h-96,w-48,50,12,anchor:TextAnchor.UpperCenter);description.style.whiteSpace=WhiteSpace.Normal;
            Button(card,CatalogSpins?"Ⅱ 回転中":"▶ 回転",24,h-42,94,30,()=>{CatalogSpins=!CatalogSpins;Rebuild();},"#e9f7fb",11);Text(card,(CatalogIndex+1)+" / "+match.Data.Config.variants.Length,w-88,h-42,60,28,11,anchor:TextAnchor.MiddleCenter);
        }
        private void UpdateChoices()
        {
            var pending=match.Pending;var show=pending!=null&&match.Motion!=null&&(match.Motion.Stage=="choice-preview"||match.Motion.Progress>=1);
            var count=show?pending.Length:0;if(count==choiceCount)return;choiceCount=count;choiceIndex=match.CurrentChoice;choice.Clear();if(count==0)return;
            var y=height*.64f;Button evolve=null;
            var rotations=pending.Skip(1).Any(p=>p.action.transformation?.type=="rotate");
            if(rotations)
            {
                var cells=pending.SelectMany(p=>p.captureCells).ToArray();var minX=cells.Min(c=>c.x);var maxX=cells.Max(c=>c.x);var minY=cells.Min(c=>c.y);var maxY=cells.Max(c=>c.y);
                var buttons=new List<Button>();var w=64f;var total=(count-1)*(w+6)-6;
                for(var i=1;i<count;i++)
                {
                    var index=i;var candidate=pending[i];
                    var button=Button(choice,"",(width-total)*.5f+(i-1)*(w+6),y-66,w,52,()=>{choiceIndex=index;match.PreviewChoice(index);for(var n=0;n<buttons.Count;n++)Border(buttons[n],3,n+1==index?"#5aaac8":"#ffffff");if(evolve!=null)evolve.style.backgroundColor=ChoiceTint(index,"#b8e6ef");},"#ecf9fc");button.style.backgroundColor=ChoiceTint(index,"#ecf9fc");if(choiceIndex==index)Border(button,3,"#5aaac8");buttons.Add(button);
                    var cellSize=Mathf.Min(12,Mathf.Min(48f/(maxX-minX+1),34f/(maxY-minY+1)));var offset=new Vector2((w-(maxX-minX+1)*cellSize)*.5f,(46-(maxY-minY+1)*cellSize)*.5f);
                    Func<Cell,Vector2> point=c=>offset+new Vector2((match.Viewer=="north"?maxX-c.x:c.x-minX)*cellSize,(match.Viewer=="north"?maxY-c.y:c.y-minY)*cellSize);
                    foreach(var cell in pending[0].footprint){var q=point(cell);var tile=Box(button,"old-footprint",q.x,q.y,cellSize-1,cellSize-1,null,3);Border(tile,1,"#9db9c7");}
                    foreach(var cell in candidate.footprint){var q=point(cell);Box(button,"new-footprint",q.x,q.y,cellSize-1,cellSize-1,match.ChoiceColor(index)==match.Data.Config.colors.safe?"#5aaac8":match.ChoiceColor(index),3);}
                    var pivot=pending[0].footprint[candidate.action.transformation.pivot];var center=point(pivot)+Vector2.one*(cellSize*.5f);Box(button,"pivot",center.x-2.5f,center.y-2.5f,5,5,"#ffe28a",3);Enter(button);
                }
            }
            var keep=Button(choice,"そのまま",width*.5f-119,y,110,50,()=>match.ResolveChoice(0),"#fffaf0",14);keep.style.backgroundColor=ChoiceTint(0,"#fffaf0");Enter(keep);
            evolve=Button(choice,"成る",width*.5f+1,y,110,50,()=>match.ResolveChoice(choiceIndex>0?choiceIndex:1),"#b8e6ef",14);evolve.style.backgroundColor=ChoiceTint(choiceIndex>0?choiceIndex:1,"#b8e6ef");Enter(evolve);
            Button(choice,"×",width*.5f+121,y+8,32,32,match.CancelChoice,"#fffaf0",18);
        }
        private Color ChoiceTint(int index,string normal){var color=match.ChoiceColor(index);return color==match.Data.Config.colors.safe?C(normal):Color.Lerp(C(normal),C(color),.28f);}
        private void UpdateMarkers()
        {
            foreach(var node in markNodes.Values)node.style.display=DisplayStyle.None;
            if(gridOpen||match.Busy||match.Thinking||match.Dialog!=null||!match.HumanTurn)return;
            foreach(var entry in match.Marks)
            {
                var piece=match.State.pieces.FirstOrDefault(p=>p.id==entry.Key);if(piece==null)continue;
                if(!markNodes.TryGetValue(piece.id,out var mark)){mark=Box(markers,"native-piece-mark",0,0,25,25,null,13);Border(mark,2,"#fff3e7");markNodes[piece.id]=mark;}
                mark.style.display=DisplayStyle.Flex;if(mark.userData as string!=entry.Value){mark.userData=entry.Value;mark.Clear();var color=entry.Value=="king"?"#f7cc61":entry.Value=="helper"?"#bce7ce":entry.Value=="trapped"?"#8f2038":"#d56b37";mark.style.backgroundColor=C(color);
                if(entry.Value=="danger"||entry.Value=="trapped")Text(mark,entry.Value=="trapped"?"×":"!",0,-1,21,22,19,"#ffffff",true,TextAnchor.MiddleCenter);
                else{var icon=new NativeSymbol(entry.Value=="king"?"crown":"helper"){pickingMode=PickingMode.Ignore};icon.style.position=UnityEngine.UIElements.Position.Absolute;icon.style.left=3;icon.style.top=3;icon.style.width=15;icon.style.height=15;mark.Add(icon);}}
                var anchor=match.Board.Marker(piece.id);mark.style.left=anchor.x/uiScale-12.5f;mark.style.top=(Screen.height-anchor.y)/uiScale-12.5f;
            }
        }
        private void UpdateOrbs()
        {
            for(var i=orbs.Count;i<12;i++){var orb=Box(root,"native-capture-orb",0,0,16,16,"#ffffff",9);orb.style.display=DisplayStyle.None;Border(orb,3,"#9ce8f9");orbs.Add(orb);}
            foreach(var orb in orbs)orb.style.display=DisplayStyle.None;
            var motion=match.Motion;if(motion==null||motion.Stage=="choice"||motion.Stage=="choice-preview"||motion.Stage=="return")return;
            var index=0;foreach(var victim in motion.Action.captured.Where(p=>p.kind!="walrus"))
            {
                var t=(Time.unscaledTime-motion.Landing-.08f-index*.035f)/.6f;if(t>=0&&t<1&&stockTargets.TryGetValue(motion.Action.piece.owner+":"+victim.kind,out var target))
                {var from=match.Data.Center(victim);from.z=-from.z;from.y=.6f;var projected=match.Board.Camera.WorldToScreenPoint(from);var a=new Vector2(projected.x/uiScale,(Screen.height-projected.y)/uiScale);var b=target.worldBound.center;var ease=Mathf.SmoothStep(0,1,t);var point=Vector2.Lerp(a,b,ease)+new Vector2(.3f,-1)*Mathf.Sin(t*Mathf.PI)*Mathf.Min(100,Vector2.Distance(a,b)*.23f);var orb=orbs[index%orbs.Count];orb.style.display=DisplayStyle.Flex;orb.style.left=point.x-8;orb.style.top=point.y-8;orb.style.opacity=Mathf.Min(1,t*9)*(1-Mathf.Max(0,(t-.88f)/.12f));}index++;
            }
        }
        private void UpdateResult()
        {
            var key=match.State.phase=="finished"&&!match.Busy&&!match.Replaying&&!match.ResultDismissed?match.State.result?.winner??"draw":null;if(key==resultKey)return;resultKey=key;result.Clear();celebration.Clear();if(key==null)return;resultStarted=Time.unscaledTime;
            for(var i=0;i<36;i++){var bit=Box(result,"celebration",0,0,5+i%4,9+i%6,new[]{"#a6edff","#ffde7f","#ffacc5","#ffffff"}[i%4],1);celebration.Add(bit);}
            var text=key=="draw"?"引き分け！":match.Settings.mode=="human-vs-ai"?(key==match.Settings.human?"あなたの勝ち！":"また挑戦しよう！"):match.Actor(key)+"の勝ち！";
            Text(result,text,12,height*.18f,width-24,60,width<600?30:46,"#ffffff",true,TextAnchor.MiddleCenter);Button(result,"もう一局",width*.5f-111,height-156,108,46,()=>match.Open("settings"),"#ffe08a",14);Button(result,"盤面を見る",width*.5f+5,height-156,108,46,()=>{match.ResultDismissed=true;Rebuild();},"#f5fbff",13);Enter(result);
        }
        public bool Blocks(Vector2 screen)
        {
            if(match.Dialog!=null)return true;if(root?.panel==null)return true;var point=RuntimePanelUtils.ScreenToPanel(root.panel,new Vector2(screen.x,Screen.height-screen.y));var element=root.panel.Pick(point);
            while(element!=null){if(element.userData as string=="native-ui")return true;element=element.parent;}return false;
        }
        public void Tick()
        {
            #if UNITY_WEBGL && !UNITY_EDITOR
            uiScale=Mathf.Max(1,AzarashiPixelRatio());
            #else
            uiScale=1;
            #endif
            var w=Screen.width/uiScale;var h=Screen.height/uiScale;if(Mathf.Abs(w-width)>.5f||Mathf.Abs(h-height)>.5f){width=w;height=h;dirty=true;}document.panelSettings.scale=uiScale;
            if(match.Dialog!="settings")draft=null;if(dirty)Build();
            if(match.State==null)return;
            foreach(var item in counts)
            {
                var parts=item.Key.Split(':');var motion=match.Motion;var count=motion!=null?motion.BeforeState.stocks.Of(parts[0]).Count(parts[1]):match.State.stocks.Of(parts[0]).Count(parts[1]);
                if(motion!=null&&Time.unscaledTime>=motion.Landing)
                {
                    var action=motion.Action;if(action.action.type=="place"&&action.piece.owner==parts[0]&&action.piece.kind==parts[1])count--;
                    var victims=action.captured.Where(p=>p.kind!="walrus").ToArray();for(var i=0;i<victims.Length;i++)if(action.piece.owner==parts[0]&&victims[i].kind==parts[1]&&Time.unscaledTime>=motion.Landing+.68f+i*.035f)count++;
                }
                var text=count.ToString();if(item.Value.text!=text){item.Value.text=text;item.Value.style.scale=new Scale(new Vector3(1.3f,1.3f,1));item.Value.style.transitionProperty=new List<StylePropertyName>{new StylePropertyName("scale")};item.Value.style.transitionDuration=new List<TimeValue>{new TimeValue(.2f)};var label=item.Value;label.schedule.Execute(()=>label.style.scale=new Scale(Vector3.one)).StartingIn(30);}
            }
            status.text=!match.Engine.Ready?"氷原を準備しています":match.Replaying?"リプレイ  "+match.ReplayCursor+" / "+match.ReplayTotal+"手":match.SelectedStock!=null?"置く場所を選んでね":match.SelectedId!=null?match.Data.Name(match.State.pieces.First(p=>p.id==match.SelectedId)):match.Actor(match.State.turn)+"の手番  "+(match.State.revision+1)+"手目";
            var showClock=match.Thinking&&Time.unscaledTime-match.ThinkingStarted>3.5f;clockAmount=Mathf.Lerp(clockAmount,showClock?1:0,1-Mathf.Exp(-Time.unscaledDeltaTime*9));clock.style.left=width-68+(1-clockAmount)*88;clock.style.opacity=clockAmount;clockIcon.Progress=match.Thinking?Mathf.Clamp01((Time.unscaledTime-match.ThinkingStarted)/Mathf.Max(1,match.ThinkingBudget)):0;clockIcon.MarkDirtyRepaint();
            UpdateChoices();UpdateMarkers();UpdateOrbs();UpdateResult();
            for(var i=0;i<celebration.Count;i++){var time=Time.unscaledTime-resultStarted;var t=time*(.55f+(i%5)*.055f);var a=i*2.39996f;var node=celebration[i];node.style.left=width*.5f+Mathf.Cos(a)*width*.6f*Mathf.Min(1,t)+Mathf.Sin(t*2+i)*12;node.style.top=height*.24f+Mathf.Sin(a)*height*.25f*t+t*t*height*.3f;node.style.rotate=new Rotate(i*31+t*160);node.style.opacity=Mathf.Clamp01(1-(time-1.5f)/2);}

            catalogCamera.enabled=match.Dialog=="catalog";if(catalogCamera.enabled&&CatalogSpins)CatalogAngle+=Time.unscaledDeltaTime*10;
        }
        private void OnDestroy(){if(catalogTexture!=null){catalogTexture.Release();Destroy(catalogTexture);}if(catalogCamera!=null)Destroy(catalogCamera.gameObject);}
    }

    public sealed class NativeSymbol:VisualElement
    {
        private readonly string symbol;
        public float Progress;
        public NativeSymbol(string symbol){this.symbol=symbol;generateVisualContent+=Paint;}
        private void Paint(MeshGenerationContext context)
        {
            var p=context.painter2D;p.strokeColor=new Color(.25f,.39f,.49f);p.lineWidth=2;p.lineCap=LineCap.Round;p.lineJoin=LineJoin.Round;var s=contentRect.width/24f;
            Action<float,float> move=(x,y)=>p.MoveTo(new Vector2(x*s,y*s));Action<float,float> line=(x,y)=>p.LineTo(new Vector2(x*s,y*s));
            p.BeginPath();
            if(symbol=="crown"){move(3,7);line(7,12);line(12,4);line(17,12);line(21,7);line(18,19);line(6,19);p.ClosePath();p.Stroke();p.BeginPath();move(6,22);line(18,22);}
            else if(symbol=="helper"){move(12,2);line(21,6);line(19,16);line(12,22);line(5,16);line(3,6);p.ClosePath();p.Stroke();p.BeginPath();move(8,12);line(16,12);move(12,8);line(12,16);}
            else if(symbol=="clock"){p.strokeColor=new Color(.85f,.96f,1,.3f);p.Arc(new Vector2(12*s,12*s),10*s,0,360);p.Stroke();p.BeginPath();p.strokeColor=new Color(.85f,.96f,1,.85f);p.Arc(new Vector2(12*s,12*s),10*s,-90,-90+360*Mathf.Max(.002f,Progress));p.Stroke();p.BeginPath();move(12,5);line(12,12);line(17,15);}
            else if(symbol=="grid"){move(3,3);line(21,3);line(21,21);line(3,21);p.ClosePath();move(12,3);line(12,21);move(3,12);line(21,12);}
            else if(symbol=="book"){move(12,21);line(12,5);line(4,3);line(3,18);line(12,20);line(21,18);line(20,3);line(12,5);}
            else if(symbol=="chevron-up"||symbol=="chevron-down"){move(5,symbol=="chevron-up"?15:9);line(12,symbol=="chevron-up"?8:16);line(19,symbol=="chevron-up"?15:9);}
            else if(symbol=="replay"){move(4,3);line(20,3);line(20,21);line(4,21);p.ClosePath();move(9,7);line(16,12);line(9,17);p.ClosePath();}
            else if(symbol=="reset"){p.Arc(new Vector2(12*s,12*s),9*s,215,540);p.Stroke();p.BeginPath();move(3,3);line(3,10);line(10,10);}
            else if(symbol=="view"||symbol=="full"){move(4,10);line(4,4);line(10,4);move(14,20);line(20,20);line(20,14);move(4,20);line(20,4);}
            else if(symbol=="cube"){move(3,7);line(12,2);line(21,7);line(21,18);line(12,23);line(3,18);p.ClosePath();move(3,7);line(12,12);line(21,7);move(12,12);line(12,23);}
            else{move(3,9);line(7,9);line(12,4);line(12,20);line(7,15);line(3,15);p.ClosePath();if(symbol=="mute"){move(16,8);line(23,16);move(23,8);line(16,16);}else{move(16,7);line(19,11);line(19,13);line(16,17);}}
            p.Stroke();
        }
    }
}
