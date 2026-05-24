import { useState, useRef, useCallback, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────
const STORAGE_KEY = "saidan-v4";
const PLAN_FREE    = "free";
const PLAN_PRO     = "pro";
const PLAN_PREMIUM = "premium";
const FREE_ALTAR_LIMIT = 1;

// ── Materials catalog ─────────────────────────────────────────
// tier:"free"  = 静止・無料で誰でも使える
// tier:"paid"  = アニメあり・個別購入 or プレミアムで使える
// tier:"collab"= コラボ限定・個別購入のみ（プレミアムでも別課金）
// animated:true のものが有料の基準
const MATERIALS = [
  // ── 背景 ──────────────────────────────────────────────────
  // 静止（無料）
  { id:"bg_static_night",  type:"bg", name:"星空",       emoji:"🌌", price:0,   tier:"free", animated:false, desc:"静かな夜空",         animation:null      },
  { id:"bg_static_pastel", type:"bg", name:"パステル",   emoji:"🌸", price:0,   tier:"free", animated:false, desc:"やわらかいグラデ",   animation:null      },
  { id:"bg_static_dark",   type:"bg", name:"ダーク",     emoji:"🖤", price:0,   tier:"free", animated:false, desc:"シックな暗闇",       animation:null      },
  { id:"bg_static_gold",   type:"bg", name:"ゴールド",   emoji:"✨", price:0,   tier:"free", animated:false, desc:"豪華な金色",         animation:null      },
  // アニメあり（有料）
  { id:"bg_sakura",        type:"bg", name:"桜吹雪",     emoji:"🌸", price:120, tier:"paid", animated:true,  desc:"ふわふわ舞う桜",     animation:"sakura"  },
  { id:"bg_snow",          type:"bg", name:"雪景色",     emoji:"❄️", price:120, tier:"paid", animated:true,  desc:"しんしんと降る雪",   animation:"snow"    },
  { id:"bg_stars",         type:"bg", name:"流れ星",     emoji:"🌠", price:150, tier:"paid", animated:true,  desc:"夜空を流れる星",     animation:"stars"   },
  { id:"bg_aurora",        type:"bg", name:"オーロラ",   emoji:"🌌", price:150, tier:"paid", animated:true,  desc:"幻想的な光のカーテン",animation:"aurora" },
  { id:"bg_fire",          type:"bg", name:"炎",         emoji:"🔥", price:120, tier:"paid", animated:true,  desc:"揺れる炎エフェクト", animation:"fire"    },
  { id:"bg_sparkle",       type:"bg", name:"キラキラ",   emoji:"✨", price:120, tier:"paid", animated:true,  desc:"オーラが輝く",       animation:"sparkle" },
  { id:"bg_rain",          type:"bg", name:"雨",         emoji:"🌧️", price:120, tier:"paid", animated:true,  desc:"静かな雨粒",         animation:"rain"    },
  { id:"bg_hearts",        type:"bg", name:"ハート雨",   emoji:"💕", price:120, tier:"paid", animated:true,  desc:"ハートが降り注ぐ",   animation:"hearts"  },
  // ── フレーム ──────────────────────────────────────────────
  // 静止（無料）
  { id:"fr_simple",  type:"frame", name:"シンプル",   emoji:"⬜", price:0,   tier:"free", animated:false, desc:"細いシンプルな枠"   },
  { id:"fr_gold",    type:"frame", name:"ゴールド",   emoji:"🪙", price:0,   tier:"free", animated:false, desc:"クラシックな金縁"   },
  { id:"fr_torii",   type:"frame", name:"鳥居",       emoji:"⛩",  price:0,   tier:"free", animated:false, desc:"和風の鳥居フレーム" },
  { id:"fr_star",    type:"frame", name:"スター",     emoji:"⭐", price:0,   tier:"free", animated:false, desc:"星で飾られた枠"     },
  // アニメあり（有料）
  { id:"fr_flower",  type:"frame", name:"フラワー",   emoji:"💐", price:150, tier:"paid", animated:true,  desc:"花びらが舞う額縁"   },
  { id:"fr_ribbon",  type:"frame", name:"リボン",     emoji:"🎀", price:150, tier:"paid", animated:true,  desc:"リボンが揺れる枠"   },
  { id:"fr_neon",    type:"frame", name:"ネオン",     emoji:"💡", price:180, tier:"paid", animated:true,  desc:"光るネオンフレーム" },
  { id:"fr_sparkle", type:"frame", name:"スパークル", emoji:"💫", price:150, tier:"paid", animated:true,  desc:"枠がキラキラ光る"   },
  // ── デコ ──────────────────────────────────────────────────
  // 静止（無料）
  { id:"dc_rose",   type:"deco", name:"バラ",       emoji:"🌹", price:0,   tier:"free", animated:false, desc:"赤いバラを添える"   },
  { id:"dc_crown",  type:"deco", name:"王冠",       emoji:"👑", price:0,   tier:"free", animated:false, desc:"推しに王冠を"       },
  { id:"dc_heart",  type:"deco", name:"ハート",     emoji:"💖", price:0,   tier:"free", animated:false, desc:"愛を込めて"         },
  { id:"dc_star2",  type:"deco", name:"星",         emoji:"⭐", price:0,   tier:"free", animated:false, desc:"きらりと輝く星"     },
  // アニメあり（有料）
  { id:"dc_ribbon", type:"deco", name:"リボンデコ", emoji:"🎀", price:120, tier:"paid", animated:true,  desc:"ひらひら揺れるリボン" },
  { id:"dc_light",  type:"deco", name:"ライト",     emoji:"💫", price:120, tier:"paid", animated:true,  desc:"光が揺れるスポット" },
  { id:"dc_music",  type:"deco", name:"音符",       emoji:"🎵", price:120, tier:"paid", animated:true,  desc:"音符が踊る装飾"     },
  { id:"dc_fire2",  type:"deco", name:"炎デコ",     emoji:"🔥", price:120, tier:"paid", animated:true,  desc:"燃え上がる炎デコ"   },
  // ── ライト ────────────────────────────────────────────────
  // 静止（無料）
  { id:"lt_spot",   type:"light", name:"スポット",   emoji:"🔦", price:0,   tier:"free", animated:false, desc:"中央を照らす"       },
  { id:"lt_warm",   type:"light", name:"ウォーム",   emoji:"🌟", price:0,   tier:"free", animated:false, desc:"温かい光"           },
  // アニメあり（有料）
  { id:"lt_rainbow",type:"light", name:"レインボー", emoji:"🌈", price:150, tier:"paid", animated:true,  desc:"虹色に変化する光"   },
  { id:"lt_candle", type:"light", name:"キャンドル", emoji:"🕯️", price:120, tier:"paid", animated:true,  desc:"ゆらめくろうそく"   },
  { id:"lt_disco",  type:"light", name:"ディスコ",   emoji:"🪩", price:180, tier:"paid", animated:true,  desc:"カラフルに光る"     },
  { id:"lt_aurora2",type:"light", name:"オーロラ光", emoji:"🌌", price:150, tier:"paid", animated:true,  desc:"幻想的な光の揺らぎ" },
];

// グッズ種類マスタ（無料プランでも絞り込み可能）
const GOOD_TYPES = [
  { id:"acrylic",  label:"アクスタ",   emoji:"🖼️" },
  { id:"plushie",  label:"ぬいぐるみ", emoji:"🧸" },
  { id:"badge",    label:"缶バッジ",   emoji:"🔵" },
  { id:"tapestry", label:"タペストリー",emoji:"🎪" },
  { id:"cd",       label:"CD/BD",      emoji:"💿" },
  { id:"book",     label:"写真集/本",  emoji:"📚" },
  { id:"apparel",  label:"アパレル",   emoji:"👕" },
  { id:"figure",   label:"フィギュア", emoji:"🪆" },
  { id:"other",    label:"その他",     emoji:"📦" },
];

const STATUS = {
  owned:    { label: "持ってる", color: "#22c55e", bg: "rgba(34,197,94,0.15)",  icon: "✓" },
  wanted:   { label: "欲しい",   color: "#f59e0b", bg: "rgba(245,158,11,0.15)", icon: "♡" },
  reserved: { label: "予約済み", color: "#60a5fa", bg: "rgba(96,165,250,0.15)", icon: "🔖" },
};

const TEMPLATES = [
  { id:"shrine", name:"神社",     emoji:"⛩",  desc:"厳かな赤と金",     bg:"linear-gradient(180deg,#1a0505,#2d0a0a)", accent:"#dc2626", gold:"#f59e0b", floor:"rgba(220,38,38,0.12)",   border:"rgba(220,38,38,0.4)",   plank:"linear-gradient(180deg,#7c1a1a,#4a0d0d)", star:false },
  { id:"night",  name:"星夜",     emoji:"🌌", desc:"満天の星空",        bg:"linear-gradient(180deg,#020817,#0f172a)", accent:"#818cf8", gold:"#e879f9", floor:"rgba(129,140,248,0.08)", border:"rgba(129,140,248,0.3)", plank:"linear-gradient(180deg,#1e1b4b,#0f0a2a)", star:true  },
  { id:"pastel", name:"パステル", emoji:"🌸", desc:"やわらかいピンク",  bg:"linear-gradient(180deg,#fdf2f8,#fce7f3)", accent:"#ec4899", gold:"#f472b6", floor:"rgba(236,72,153,0.07)",  border:"rgba(236,72,153,0.25)", plank:"linear-gradient(180deg,#fbcfe8,#f9a8d4)", star:false, dark:false },
  { id:"ocean",  name:"オーシャン",emoji:"🌊", desc:"深海ブルー",       bg:"linear-gradient(180deg,#020f1f,#051c3a)", accent:"#38bdf8", gold:"#7dd3fc", floor:"rgba(56,189,248,0.08)",  border:"rgba(56,189,248,0.3)",  plank:"linear-gradient(180deg,#0c4a6e,#082f49)", star:false },
  { id:"forest", name:"フォレスト",emoji:"🌿", desc:"癒しの森",         bg:"linear-gradient(180deg,#052e16,#14532d)", accent:"#4ade80", gold:"#86efac", floor:"rgba(74,222,128,0.08)",  border:"rgba(74,222,128,0.25)", plank:"linear-gradient(180deg,#166534,#14532d)", star:false },
  { id:"gold",   name:"ゴールド", emoji:"👑", desc:"豪華絢爛",          bg:"linear-gradient(180deg,#1c1000,#2d1d00)", accent:"#f59e0b", gold:"#fcd34d", floor:"rgba(245,158,11,0.1)",   border:"rgba(245,158,11,0.4)",  plank:"linear-gradient(180deg,#78350f,#451a03)", star:false },
];

const SHELF_ROWS = 3;
const SHELF_COLS = 6;
let uidCounter = Date.now();
const newUid = () => String(++uidCounter);
const readFileAsDataURL = (file) => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); });

function encodeAltarToURL(altar, goods) {
  const slim = goods.map(g=>({id:g.id,name:g.name,emoji:g.emoji||"📦",series:g.series||"",status:g.status}));
  try { return `${window.location.href.split("?")[0]}?saidan=${btoa(unescape(encodeURIComponent(JSON.stringify({v:2,altar,goods:slim}))))}`; } catch { return null; }
}
function decodeAltarFromURL() {
  try { const raw=new URLSearchParams(window.location.search).get("saidan"); if(!raw) return null; return JSON.parse(decodeURIComponent(escape(atob(raw)))); } catch { return null; }
}

function makeAltar(name="私の推し祭壇") {
  return { id:newUid(), name, templateId:"shrine", customColors:null, altarMode:"shelf", shelf:Array.from({length:SHELF_ROWS},()=>Array(SHELF_COLS).fill(null)), freeItems:[], bgMaterialId:null, bgCustomColor:null, frameMaterialId:null, decoIds:[], lightId:null };
}

// ─── Root ─────────────────────────────────────────────────────
export default function App() {
  const [plan, setPlan]           = useState(PLAN_FREE);
  const [purchasedMaterials, setPurchasedMaterials] = useState([]); // array of material ids
  const [altars, setAltars]       = useState([makeAltar()]);
  const [activeAltarId, setActiveAltarId] = useState(null);
  const [goods, setGoods]         = useState([]);
  const [characters, setCharacters] = useState([]); // [{id,name,color,emoji}]
  const [page, setPage]           = useState("collection");
  const [showAdd, setShowAdd]     = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showAltarManager, setShowAltarManager] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [loaded, setLoaded]       = useState(false);
  const [toast, setToast]         = useState(null);
  const [viewingShared, setViewingShared] = useState(null); // shared altar object | null
  const saveTimer = useRef(null);

  const activeAltar = altars.find(a=>a.id===activeAltarId) || altars[0];

  // ── Load ──────────────────────────────────────────────────
  useEffect(()=>{
    (async()=>{
      const shared = decodeAltarFromURL();
      if (shared?.altar) { setViewingShared(shared.altar); setGoods(shared.goods||[]); setPage("altar"); setLoaded(true); return; }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d.plan)       setPlan(d.plan);
          if (d.altars?.length) { setAltars(d.altars); setActiveAltarId(d.activeAltarId||d.altars[0].id); }
          if (d.goods)      setGoods(d.goods);
          if (d.characters) setCharacters(d.characters);
          if (d.purchasedMaterials) setPurchasedMaterials(d.purchasedMaterials);
        } else {
          const a = makeAltar(); setAltars([a]); setActiveAltarId(a.id);
        }
      } catch { const a=makeAltar(); setAltars([a]); setActiveAltarId(a.id); }
      setLoaded(true);
    })();
  },[]);

  // ── Auto-save ─────────────────────────────────────────────
  const triggerSave = useCallback((plan,altars,activeAltarId,goods,characters,purchasedMaterials)=>{
    if (!loaded) return;
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async()=>{
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({plan,altars,activeAltarId,goods,characters,purchasedMaterials}));
        setSaveStatus("saved"); setTimeout(()=>setSaveStatus(null),2000);
      } catch { setSaveStatus("error"); setTimeout(()=>setSaveStatus(null),3000); }
    },700);
  },[loaded]);

  useEffect(()=>{ if(loaded) triggerSave(plan,altars,activeAltarId,goods,characters,purchasedMaterials); },[plan,altars,activeAltarId,goods,characters,purchasedMaterials,loaded]);

  const showToast = (msg)=>{ setToast(msg); setTimeout(()=>setToast(null),2200); };

  // ── Plan ──────────────────────────────────────────────────
  const upgradeToPro     = ()=>{ setPlan(PLAN_PRO);     setShowUpgrade(false); showToast("🎉 PROプランにアップグレードしました！"); };
  const upgradeToPremium = ()=>{ setPlan(PLAN_PREMIUM); setShowUpgrade(false); showToast("🌟 プレミアムプランへようこそ！"); };
  const purchaseMaterial = (materialId)=>{ if(!purchasedMaterials.includes(materialId)) { setPurchasedMaterials(prev=>[...prev,materialId]); showToast("✓ 素材を購入しました！"); } };
  const canUseMaterial   = (mat)=> !mat.animated || isPremium || purchasedMaterials.includes(mat.id);
  const downgradeToFree = ()=>{ setPlan(PLAN_FREE); showToast("フリープランに戻りました"); };
  const isPro     = plan===PLAN_PRO || plan===PLAN_PREMIUM;
  const isPremium  = plan===PLAN_PREMIUM;

  // ── Altars CRUD ────────────────────────────────────────────
  const updateAltar = useCallback((id,patch)=>setAltars(prev=>prev.map(a=>a.id===id?{...a,...patch}:a)),[]);
  const addAltar = ()=>{
    if (!isPro && altars.length>=FREE_ALTAR_LIMIT) { setShowUpgrade(true); return; }
    const a=makeAltar(`推し祭壇 ${altars.length+1}`);
    setAltars(prev=>[...prev,a]); setActiveAltarId(a.id); setShowAltarManager(false);
    showToast("新しい祭壇を作りました ✓");
  };
  const deleteAltar = (id)=>{
    if (altars.length<=1) { showToast("最後の祭壇は削除できません"); return; }
    setAltars(prev=>{ const n=prev.filter(a=>a.id!==id); setActiveAltarId(n[0].id); return n; });
    showToast("祭壇を削除しました");
  };
  const renameAltar = (id,name)=>updateAltar(id,{name});

  // ── Goods CRUD ────────────────────────────────────────────
  const addGood    = (g)=>{ setGoods(prev=>[g,...prev]); showToast("グッズを追加しました ✓"); };
  const updateGoodStatus = (id,status)=>setGoods(prev=>prev.map(g=>g.id===id?{...g,status}:g));
  const deleteGood = (id)=>{
    setGoods(prev=>prev.filter(g=>g.id!==id));
    setAltars(prev=>prev.map(a=>({...a, shelf:a.shelf.map(row=>row.map(c=>c===id?null:c)), freeItems:a.freeItems.filter(i=>i.goodId!==id)})));
    showToast("削除しました");
  };
  const updateGoodChar = (id, characterId)=>setGoods(prev=>prev.map(g=>g.id===id?{...g,characterId}:g));

  // ── Characters CRUD (PRO) ──────────────────────────────────
  const addCharacter    = (c)=>{ setCharacters(prev=>[...prev,c]); showToast("キャラクターを追加しました ✓"); };
  const deleteCharacter = (id)=>{ setCharacters(prev=>prev.filter(c=>c.id!==id)); setGoods(prev=>prev.map(g=>g.characterId===id?{...g,characterId:null}:g)); };

  const goodById = (id)=>goods.find(g=>g.id===id);
  const getTemplate = (a)=>{ const base=TEMPLATES.find(t=>t.id===(a?.templateId||"shrine"))||TEMPLATES[0]; return a?.customColors?{...base,...a.customColors}:base; };

  const counts = {
    total:goods.length, owned:goods.filter(g=>g.status==="owned").length,
    wanted:goods.filter(g=>g.status==="wanted").length, reserved:goods.filter(g=>g.status==="reserved").length,
    onAltar:[...new Set([...altars.flatMap(a=>a.shelf.flat().filter(Boolean)),...altars.flatMap(a=>a.freeItems.map(i=>i.goodId))])].length,
  };

  const saveLabel = {saving:"💾 保存中…",saved:"✓ 保存済み",error:"⚠ 失敗"}[saveStatus]||"";
  const saveColor = {saving:"#facc15",saved:"#4ade80",error:"#f87171"}[saveStatus];

  const currentAltar = viewingShared || activeAltar;
  const currentTemplate = getTemplate(currentAltar);

  return (
    <div style={S.root}>
      {toast && <div style={S.toast}>{toast}</div>}

      {/* Shared banner */}
      {viewingShared && (
        <div style={{ background:"linear-gradient(90deg,rgba(232,121,249,0.15),rgba(129,140,248,0.15))", borderBottom:"1px solid rgba(232,121,249,0.2)", padding:"8px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:12 }}>
          <span style={{ color:"#e879f9", fontWeight:700 }}>👁 シェアされた祭壇を閲覧中</span>
          <button onClick={()=>{ window.history.replaceState({},"",window.location.pathname); setViewingShared(null); setGoods([]); setPage("collection"); }} style={{ fontSize:11, color:"#9ca3af", background:"rgba(255,255,255,0.08)", border:"none", borderRadius:10, padding:"3px 10px", cursor:"pointer" }}>自分の祭壇に戻る →</button>
        </div>
      )}

      <header style={S.header}>
        <div style={S.logo}>
          <span style={{ fontSize:24 }}>⛩</span>
          <div>
            <div style={S.logoText}>SAIDAN</div>
            <div style={S.logoSub}>推しグッズ管理 & 祭壇メーカー</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {saveLabel && !viewingShared && <span style={{ fontSize:11, fontWeight:700, color:saveColor }}>{saveLabel}</span>}
          {/* Plan badge */}
          <button onClick={()=>isPro?downgradeToFree():setShowUpgrade(true)} style={{ padding:"4px 10px", borderRadius:20, border:`1px solid ${isPro?"#f59e0b":"rgba(255,255,255,0.15)"}`, background:isPro?"rgba(245,158,11,0.15)":"transparent", color:isPro?"#f59e0b":"#6b7280", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            {isPro?"👑 PRO":"FREE"}
          </button>
          <nav style={{ display:"flex", gap:6 }}>
            {[["collection","📦"],["altar","⛩"]].map(([p,l])=>(
              <button key={p} onClick={()=>setPage(p)} style={{ ...S.navBtn, ...(page===p?S.navBtnOn:{}) }}>{l} {p==="collection"?"コレクション":"祭壇"}</button>
            ))}
          </nav>
        </div>
      </header>

      {page==="collection"
        ? <CollectionPage goods={goods} counts={counts} characters={characters} isPro={isPro}
            onAdd={()=>setShowAdd(true)} onUpdateStatus={updateGoodStatus} onDelete={deleteGood}
            onUpdateChar={updateGoodChar} onAddCharacter={addCharacter} onDeleteCharacter={deleteCharacter}
            onUpgrade={()=>setShowUpgrade(true)} loaded={loaded} />
        : <AltarPage altar={currentAltar} template={currentTemplate} goods={goods}
            altars={altars} isPro={isPro} isPremium={isPremium} viewingShared={!!viewingShared}
            onUpdateAltar={(patch)=>!viewingShared&&updateAltar(currentAltar.id,patch)}
            goodById={goodById} showToast={showToast}
            onOpenTemplates={()=>setShowTemplates(true)}
            onOpenShare={()=>setShowShare(true)}
            onOpenAltarManager={()=>setShowAltarManager(true)}
            onOpenMaterials={()=>setShowMaterials(true)}
            onSwitchAltar={(id)=>setActiveAltarId(id)}
            onUpgrade={()=>setShowUpgrade(true)}
            onAutoArrange={()=>{
              const owned=goods.filter(g=>g.status==="owned"||g.status==="reserved");
              if(!owned.length){showToast("持ってるグッズを登録してください");return;}
              if(currentAltar.altarMode==="shelf"){
                const ns=Array.from({length:SHELF_ROWS},()=>Array(SHELF_COLS).fill(null));
                owned.slice(0,SHELF_ROWS*SHELF_COLS).forEach((g,i)=>{ns[Math.floor(i/SHELF_COLS)][i%SHELF_COLS]=g.id;});
                updateAltar(currentAltar.id,{shelf:ns});
              } else {
                const cols=Math.ceil(Math.sqrt(Math.min(owned.length,18)));
                const ni=owned.slice(0,18).map((g,i)=>({id:newUid(),goodId:g.id,x:80+(i%cols)*110+Math.random()*20,y:90+Math.floor(i/cols)*130+Math.random()*20,scale:0.9+Math.random()*0.4,zIndex:i+1}));
                updateAltar(currentAltar.id,{freeItems:ni});
              }
              showToast("✨ 自動配置しました！");
            }}
          />
      }

      {showAdd && <AddModal onClose={()=>setShowAdd(false)} onAdd={addGood} characters={characters} isPro={isPro} />}
      {showTemplates && <TemplateModal current={currentAltar.templateId} customColors={currentAltar.customColors}
        onSelect={(tid,cc)=>{ updateAltar(currentAltar.id,{templateId:tid,...(cc!==undefined?{customColors:cc}:{})}); setShowTemplates(false); showToast("テンプレートを更新しました ✓"); }}
        onClose={()=>setShowTemplates(false)} />}
      {showShare && <ShareModal altar={currentAltar} template={currentTemplate} goodById={goodById} goods={goods} onClose={()=>setShowShare(false)} />}
      {showUpgrade && <UpgradeModal onUpgrade={upgradeToPro} onUpgradePremium={upgradeToPremium} onClose={()=>setShowUpgrade(false)} plan={plan} />}
      {showMaterials && <MaterialsModal altar={currentAltar} onUpdateAltar={(patch)=>updateAltar(currentAltar.id,patch)} isPremium={isPremium} purchasedMaterials={purchasedMaterials} onPurchase={purchaseMaterial} canUseMaterial={canUseMaterial} onClose={()=>setShowMaterials(false)} onUpgrade={()=>{setShowMaterials(false);setShowUpgrade(true);}} />}
      {showAltarManager && <AltarManagerModal altars={altars} activeId={activeAltar?.id} isPro={isPro}
        onAdd={addAltar} onDelete={deleteAltar} onRename={renameAltar} onSwitch={(id)=>{setActiveAltarId(id);setShowAltarManager(false);}}
        onUpgrade={()=>{ setShowAltarManager(false); setShowUpgrade(true); }} onClose={()=>setShowAltarManager(false)} />}
    </div>
  );
}

// ─── Collection Page ──────────────────────────────────────────
function CollectionPage({ goods, counts, characters, isPro, onAdd, onUpdateStatus, onDelete, onUpdateChar, onAddCharacter, onDeleteCharacter, onUpgrade, loaded }) {
  const [filter, setFilter]         = useState("all");
  const [typeFilter, setTypeFilter]   = useState("all");
  const [charFilter, setCharFilter]   = useState(null);
  const [showCharManager, setShowCharManager] = useState(false);
  const [confirmId, setConfirmId]     = useState(null);

  let visible = goods.filter(g=>filter==="all"||g.status===filter);
  if (typeFilter!=="all") visible = visible.filter(g=>(g.goodType||"other")===typeFilter);
  if (charFilter) visible = visible.filter(g=>g.characterId===charFilter);

  return (
    <main style={S.main}>
      <div style={S.statsRow}>
        {[{label:"総グッズ数",val:counts.total,color:"#e879f9"},{label:"持ってる",val:counts.owned,color:"#22c55e"},{label:"予約済み",val:counts.reserved,color:"#60a5fa"},{label:"欲しい",val:counts.wanted,color:"#f59e0b"},{label:"祭壇に飾中",val:counts.onAltar,color:"#a78bfa"}].map(s=>(
          <div key={s.label} style={S.statCard}><div style={{ fontSize:22,fontWeight:900,color:s.color }}>{s.val}</div><div style={{ fontSize:10,color:"#7c6a9a",marginTop:2 }}>{s.label}</div></div>
        ))}
      </div>

      {/* Character filter bar (PRO) */}
      {isPro && (
        <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
          <button onClick={()=>setCharFilter(null)} style={{ ...S.filterBtn, ...(charFilter===null?S.filterBtnOn:{}) }}>🎭 全員</button>
          {characters.map(c=>(
            <button key={c.id} onClick={()=>setCharFilter(charFilter===c.id?null:c.id)}
              style={{ ...S.filterBtn, ...(charFilter===c.id?{ background:`${c.color}22`, color:c.color, border:`1px solid ${c.color}66` }:{}) }}>
              {c.emoji} {c.name}
            </button>
          ))}
          <button onClick={()=>setShowCharManager(true)} style={{ ...S.filterBtn, border:"1px dashed rgba(232,121,249,0.3)", color:"#7c6a9a" }}>＋ キャラ追加</button>
        </div>
      )}
      {!isPro && (
        <div style={{ marginBottom:12, padding:"10px 14px", background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:12, color:"#fbbf24" }}>👑 PROプランでキャラ別フォルダ管理が使えます</span>
          <button onClick={onUpgrade} style={{ fontSize:11, fontWeight:700, color:"#f59e0b", background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:10, padding:"3px 10px", cursor:"pointer" }}>アップグレード</button>
        </div>
      )}

      <div style={S.toolbar}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[["all","すべて"],["owned","持ってる"],["reserved","予約済み"],["wanted","欲しい"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)} style={{ ...S.filterBtn, ...(filter===v?S.filterBtnOn:{}) }}>{l}</button>
          ))}
        </div>
        <button onClick={onAdd} style={S.addBtn}>＋ グッズ追加</button>
      </div>

      {!loaded?<div style={S.emptyMsg}>読み込み中…</div>
      :visible.length===0?(
        <div style={S.emptyState}>
          <div style={{ fontSize:52,marginBottom:10 }}>📦</div>
          <div style={{ fontSize:15,fontWeight:700,marginBottom:6 }}>{goods.length===0?"まだグッズが登録されていません":"該当グッズなし"}</div>
          {goods.length===0&&<div style={{ fontSize:12,opacity:0.5 }}>「＋ グッズ追加」から登録しよう</div>}
        </div>
      ):(
        <div style={S.grid}>
          {visible.map(g=><GoodCard key={g.id} good={g} characters={characters} isPro={isPro}
            onStatusChange={s=>onUpdateStatus(g.id,s)} onDelete={()=>setConfirmId(g.id)}
            onCharChange={cid=>onUpdateChar(g.id,cid)} />)}
        </div>
      )}

      {confirmId&&(
        <div style={S.overlay} onClick={()=>setConfirmId(null)}>
          <div style={S.confirmBox} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:17,fontWeight:800,marginBottom:6 }}>グッズを削除しますか？</div>
            <div style={{ fontSize:12,opacity:0.5,marginBottom:20 }}>祭壇からも取り除かれます</div>
            <div style={{ display:"flex",gap:10,justifyContent:"center" }}>
              <button onClick={()=>setConfirmId(null)} style={S.btnGhost}>キャンセル</button>
              <button onClick={()=>{onDelete(confirmId);setConfirmId(null);}} style={S.btnDanger}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {showCharManager&&<CharManagerModal characters={characters} onAdd={onAddCharacter} onDelete={onDeleteCharacter} onClose={()=>setShowCharManager(false)} />}
    </main>
  );
}

function GoodCard({ good, characters, isPro, onStatusChange, onDelete, onCharChange }) {
  const st=STATUS[good.status];
  const [open,setOpen]=useState(false);
  const char=characters.find(c=>c.id===good.characterId);
  return (
    <div style={S.card}>
      <div style={S.cardImgWrap}>
        {good.image?<img src={good.image} alt={good.name} style={S.cardImg}/>:<div style={S.cardEmoji}>{good.emoji||"📦"}</div>}
        <div style={{ ...S.badge,background:st.bg,color:st.color }}>{st.icon} {st.label}</div>
        {char&&<div style={{ position:"absolute",bottom:6,right:6,fontSize:9,background:`${char.color}33`,color:char.color,borderRadius:10,padding:"1px 6px",fontWeight:700,border:`1px solid ${char.color}44` }}>{char.emoji} {char.name}</div>}
      </div>
      <div style={S.cardBody}>
        <div style={S.cardName}>{good.name}</div>
        {good.goodType&&good.goodType!=="other"&&(()=>{ const t=GOOD_TYPES.find(t=>t.id===good.goodType); return t?<div style={{ fontSize:10,color:"#a78bfa",marginBottom:2 }}>{t.emoji} {t.label}</div>:null; })()}
        {good.series&&<div style={S.cardSeries}>{good.series}</div>}
        {good.purchaseDate&&<div style={S.cardMeta}>📅 {good.purchaseDate}</div>}
        {good.releaseDate&&<div style={S.cardMeta}>🔖 発売: {good.releaseDate}</div>}
      </div>
      <div style={S.cardActions}>
        {isPro&&characters.length>0&&(
          <select value={good.characterId||""} onChange={e=>onCharChange(e.target.value||null)}
            style={{ fontSize:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,color:"#9ca3af",padding:"2px 4px",flex:1,cursor:"pointer" }}>
            <option value="">— キャラ未設定</option>
            {characters.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
        )}
        <div style={{ position:"relative" }}>
          <button onClick={()=>setOpen(o=>!o)} style={{ ...S.iconBtn,color:st.color }}>⇄</button>
          {open&&(
            <div style={S.statusMenu} onMouseLeave={()=>setOpen(false)}>
              {Object.entries(STATUS).map(([k,v])=>(
                <button key={k} onClick={()=>{onStatusChange(k);setOpen(false);}} style={{ ...S.statusMenuItem,color:v.color,background:good.status===k?v.bg:"transparent" }}>{v.icon} {v.label}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onDelete} style={{ ...S.iconBtn,color:"#ef4444" }}>🗑</button>
      </div>
    </div>
  );
}

// ─── Character Manager Modal (PRO) ───────────────────────────
function CharManagerModal({ characters, onAdd, onDelete, onClose }) {
  const [name,setName]=useState("");
  const [emoji,setEmoji]=useState("⭐");
  const [color,setColor]=useState("#e879f9");
  const EMOJIS=["⭐","🌸","🎀","💎","🌙","🔥","🌈","🐱","🦋","🎵","👑","🌺"];
  const submit=()=>{
    if(!name.trim()) return;
    onAdd({id:newUid(),name:name.trim(),emoji,color}); setName(""); setEmoji("⭐");
  };
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:400 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:17,fontWeight:800,color:"#e879f9" }}>🎭 キャラクター管理</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
        {/* Add form */}
        <div style={{ background:"rgba(255,255,255,0.03)",borderRadius:12,padding:14,marginBottom:14,border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:12,color:"#7c6a9a",fontWeight:700,marginBottom:10 }}>新しいキャラクターを追加</div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:10 }}>
            {EMOJIS.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{ fontSize:20,width:36,height:36,borderRadius:8,border:`2px solid ${emoji===e?"#e879f9":"transparent"}`,background:"rgba(255,255,255,0.05)",cursor:"pointer" }}>{e}</button>)}
          </div>
          <div style={{ display:"flex",gap:8,marginBottom:10,alignItems:"center" }}>
            <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{ width:36,height:36,border:"none",borderRadius:8,padding:2,background:"transparent",cursor:"pointer" }}/>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="キャラクター名 (例: 月ノ美兎)" style={{ ...S.input,flex:1 }} maxLength={20} onKeyDown={e=>e.key==="Enter"&&submit()} />
          </div>
          <button onClick={submit} style={{ width:"100%",padding:"9px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer" }}>追加する</button>
        </div>
        {/* List */}
        {characters.length===0?<div style={{ textAlign:"center",opacity:0.4,fontSize:13,padding:20 }}>まだキャラクターがいません</div>:(
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {characters.map(c=>(
              <div key={c.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,0.03)",borderRadius:10,border:`1px solid ${c.color}33` }}>
                <span style={{ fontSize:20 }}>{c.emoji}</span>
                <span style={{ flex:1,fontSize:13,fontWeight:700,color:c.color }}>{c.name}</span>
                <div style={{ width:12,height:12,borderRadius:"50%",background:c.color }}/>
                <button onClick={()=>onDelete(c.id)} style={{ background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:14 }}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Altar Page ───────────────────────────────────────────────
function AltarPage({ altar, template, goods, altars, isPro, isPremium, viewingShared, onUpdateAltar, goodById, showToast, onOpenTemplates, onOpenShare, onOpenAltarManager, onOpenMaterials, onSwitchAltar, onUpgrade, onAutoArrange }) {
  const ownedGoods = goods.filter(g=>g.status==="owned"||g.status==="reserved");
  const shelf   = altar.shelf;
  const freeItems = altar.freeItems;
  const altarMode = altar.altarMode;
  const onShelf = new Set(shelf.flat().filter(Boolean));
  const onFree  = new Set(freeItems.map(i=>i.goodId));
  const isDark  = template.dark!==false;
  const [editingName,setEditingName]=useState(false);
  const [nameInput,setNameInput]=useState(altar.name);
  const nameRef=useRef(null);

  // sync nameInput when altar changes
  useEffect(()=>setNameInput(altar.name),[altar.id]);

  const commitName=()=>{ const t=nameInput.trim(); if(t) onUpdateAltar({name:t}); else setNameInput(altar.name); setEditingName(false); };

  // shelf drag
  const [dragSrcGood,setDragSrcGood]=useState(null);
  const [dragSrcCell,setDragSrcCell]=useState(null);
  const [hoverCell,setHoverCell]=useState(null);

  const placeOnShelf=(goodId,r,c)=>onUpdateAltar({shelf:shelf.map((row,ri)=>row.map((cell,ci)=>{ if(cell===goodId) return null; if(ri===r&&ci===c) return goodId; return cell; }))});
  const swapShelf=(r1,c1,r2,c2)=>onUpdateAltar({shelf:shelf.map((row,ri)=>row.map((cell,ci)=>{ if(ri===r1&&ci===c1) return shelf[r2][c2]; if(ri===r2&&ci===c2) return shelf[r1][c1]; return cell; }))});
  const removeShelf=(r,c)=>onUpdateAltar({shelf:shelf.map((row,ri)=>row.map((cell,ci)=>ri===r&&ci===c?null:cell))});

  const handleShelfDrop=(r,c)=>{
    if(dragSrcGood){placeOnShelf(dragSrcGood,r,c);showToast("棚に配置しました ✓");setDragSrcGood(null);}
    else if(dragSrcCell){const[sr,sc]=dragSrcCell;if(sr!==r||sc!==c)swapShelf(sr,sc,r,c);setDragSrcCell(null);}
    setHoverCell(null);
  };

  // free drag
  const [draggingFree,setDraggingFree]=useState(null);
  const [dragOffsetFree,setDragOffsetFree]=useState({x:0,y:0});
  const [selectedFree,setSelectedFree]=useState(null);
  const freeRef=useRef(null);
  const maxZFree=useRef(10);

  const addFreeItem=(goodId)=>{ if(onFree.has(goodId)) return; maxZFree.current++; onUpdateAltar({freeItems:[...freeItems,{id:newUid(),goodId,x:80+Math.random()*320,y:80+Math.random()*160,scale:1,zIndex:maxZFree.current}]}); showToast("自由配置に追加しました ✓"); };
  const removeFreeItem=(id)=>onUpdateAltar({freeItems:freeItems.filter(i=>i.id!==id)});
  const scaleFreeItem=(id,d)=>onUpdateAltar({freeItems:freeItems.map(i=>i.id===id?{...i,scale:Math.max(0.5,Math.min(2.5,i.scale+d))}:i)});

  const startFreeDrag=useCallback((e,id)=>{ e.preventDefault(); e.stopPropagation(); const rect=freeRef.current.getBoundingClientRect(); const cx=e.touches?e.touches[0].clientX:e.clientX; const cy=e.touches?e.touches[0].clientY:e.clientY; const item=freeItems.find(i=>i.id===id); maxZFree.current++; onUpdateAltar({freeItems:freeItems.map(i=>i.id===id?{...i,zIndex:maxZFree.current}:i)}); setDraggingFree(id); setDragOffsetFree({x:cx-rect.left-item.x,y:cy-rect.top-item.y}); },[freeItems,onUpdateAltar]);
  const onFreeMove=useCallback((e)=>{ if(!draggingFree) return; const rect=freeRef.current?.getBoundingClientRect(); if(!rect) return; const cx=e.touches?e.touches[0].clientX:e.clientX; const cy=e.touches?e.touches[0].clientY:e.clientY; onUpdateAltar({freeItems:freeItems.map(i=>i.id===draggingFree?{...i,x:cx-rect.left-dragOffsetFree.x,y:cy-rect.top-dragOffsetFree.y}:i)}); },[draggingFree,dragOffsetFree,freeItems,onUpdateAltar]);
  const endFreeDrag=useCallback(()=>setDraggingFree(null),[]);

  useEffect(()=>{ window.addEventListener("mousemove",onFreeMove); window.addEventListener("mouseup",endFreeDrag); window.addEventListener("touchmove",onFreeMove,{passive:false}); window.addEventListener("touchend",endFreeDrag); return()=>{ window.removeEventListener("mousemove",onFreeMove); window.removeEventListener("mouseup",endFreeDrag); window.removeEventListener("touchmove",onFreeMove); window.removeEventListener("touchend",endFreeDrag); }; },[onFreeMove,endFreeDrag]);

  return (
    <main style={S.main}>
      {/* Altar switcher tabs */}
      {!viewingShared && (
        <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
          {altars.map(a=>(
            <button key={a.id} onClick={()=>{ if(a.id!==altar.id) { setEditingName(false); onUpdateAltar&&true; /* parent handles */ } onSwitchAltar&&require===undefined&&(()=>{})()||true; }}
              style={{ padding:"5px 14px", borderRadius:20, border:`1px solid ${a.id===altar.id?"rgba(232,121,249,0.5)":"rgba(255,255,255,0.1)"}`, background:a.id===altar.id?"rgba(232,121,249,0.15)":"transparent", color:a.id===altar.id?"#e879f9":"#9ca3af", fontSize:12, fontWeight:600, cursor:"pointer" }}
              onClick={()=>onSwitchAltar(a.id)}
            >{a.name}</button>
          ))}
          <button onClick={onOpenAltarManager} style={{ padding:"5px 12px", borderRadius:20, border:"1px dashed rgba(232,121,249,0.25)", background:"transparent", color:"#7c6a9a", fontSize:12, cursor:"pointer" }}>
            {isPro ? "＋ 祭壇を追加" : `＋ 祭壇を追加 (${altars.length}/${FREE_ALTAR_LIMIT} 無料)`}
          </button>
        </div>
      )}

      {/* Altar name */}
      <div style={{ marginBottom:12 }}>
        {editingName?(
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <input ref={nameRef} value={nameInput} onChange={e=>setNameInput(e.target.value)} onBlur={commitName} onKeyDown={e=>{if(e.key==="Enter")commitName();if(e.key==="Escape"){setNameInput(altar.name);setEditingName(false);}}} maxLength={30}
              style={{ flex:1,fontSize:20,fontWeight:800,background:"transparent",border:"none",borderBottom:"2px solid #e879f9",color:isDark?"#f0e8ff":"#1a0030",outline:"none",padding:"2px 4px" }}/>
            <button onClick={commitName} style={S.nameSaveBtn}>完了</button>
          </div>
        ):(
          <div style={{ display:"flex",alignItems:"center",gap:8,cursor:viewingShared?"default":"pointer" }} onClick={()=>!viewingShared&&(setNameInput(altar.name),setEditingName(true),setTimeout(()=>nameRef.current?.focus(),30))}>
            <span style={{ fontSize:20,fontWeight:900,color:isDark?"#f0e8ff":"#1a0030",borderBottom:viewingShared?"none":"2px dashed rgba(232,121,249,0.3)",paddingBottom:2 }}>{altar.name}</span>
            {!viewingShared&&<span style={{ fontSize:11,color:"#7c6a9a",background:"rgba(232,121,249,0.1)",padding:"2px 8px",borderRadius:10,border:"1px solid rgba(232,121,249,0.2)" }}>✏ 編集</span>}
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center" }}>
        {[["shelf","🗄 棚"],["free","✦ 自由配置"]].map(([m,l])=>(
          <button key={m} onClick={()=>!viewingShared&&onUpdateAltar({altarMode:m})} style={{ ...S.modeBtn,...(altarMode===m?S.modeBtnOn:{}) }}>{l}</button>
        ))}
        {!viewingShared&&<button onClick={onOpenTemplates} style={{ ...S.modeBtn,border:`1px solid ${template.border}`,color:template.accent }}>{template.emoji} テンプレ</button>}
        {!viewingShared&&<button onClick={onAutoArrange} style={{ ...S.modeBtn,border:"1px solid rgba(255,200,100,0.3)",color:"#fcd34d" }}>✨ 自動配置</button>}
        {!viewingShared&&<button onClick={onOpenMaterials} style={{ ...S.modeBtn,border:"1px solid rgba(192,132,252,0.4)",color:"#c084fc",background:altar.bgMaterialId||altar.frameMaterialId||altar.decoIds?.length?"rgba(192,132,252,0.1)":"transparent" }}>🎨 素材{(altar.bgMaterialId||altar.frameMaterialId||altar.decoIds?.length||altar.lightId)?` ✓`:""}</button>}
        <button onClick={onOpenShare} style={S.shareBtn}>📸 シェア</button>
      </div>

      {/* Shelf mode */}
      {altarMode==="shelf"&&(
        <div style={{ ...S.altarBg,background:altar.bgCustomColor||template.bg,border:`1px solid ${template.border}`,marginBottom:16,overflow:"hidden",position:"relative" }}>
          {template.star&&<StarField/>}
          <AnimatedBG materialId={altar.bgMaterialId}/>
          <LightOverlay materialId={altar.lightId}/>
          <FrameOverlay materialId={altar.frameMaterialId}/>
          <AltarTopBar template={template} altarName={altar.name}/>
          {shelf.map((row,rIdx)=>(
            <div key={rIdx} style={{ ...S.shelfRow }}>
              <div style={{ ...S.shelfPlank,background:template.plank }}/>
              <div style={{ display:"grid",gridTemplateColumns:`repeat(${SHELF_COLS},1fr)`,gap:6,paddingBottom:14 }}>
                {row.map((cellId,cIdx)=>{
                  const good=cellId?goodById(cellId):null;
                  const isHov=hoverCell?.[0]===rIdx&&hoverCell?.[1]===cIdx;
                  const isDragSrc=dragSrcCell?.[0]===rIdx&&dragSrcCell?.[1]===cIdx;
                  return (
                    <div key={cIdx} style={{ ...S.shelfCell,background:isHov?`${template.accent}28`:"transparent",outline:isHov?`2px dashed ${template.accent}`:isDragSrc?"2px dashed rgba(255,255,255,0.2)":"none",opacity:isDragSrc?0.4:1 }}
                      onDragOver={e=>{e.preventDefault();setHoverCell([rIdx,cIdx]);}} onDragLeave={()=>setHoverCell(null)} onDrop={()=>!viewingShared&&handleShelfDrop(rIdx,cIdx)}>
                      {good?(
                        <div style={S.shelfItem} draggable={!viewingShared} onDragStart={()=>setDragSrcCell([rIdx,cIdx])} onDragEnd={()=>setDragSrcCell(null)}>
                          {good.image?<img src={good.image} alt={good.name} style={S.shelfItemImg}/>:<div style={S.shelfItemEmoji}>{good.emoji||"📦"}</div>}
                          <div style={{ ...S.shelfItemLabel,color:isDark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)" }}>{good.name}</div>
                          {!viewingShared&&<button style={S.removeCellBtn} onClick={()=>removeShelf(rIdx,cIdx)}>×</button>}
                        </div>
                      ):(
                        !viewingShared&&<div style={{ ...S.emptyCellHint,color:`${template.accent}33` }}>{isHov?"ここへ":"+"}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Free mode */}
      {altarMode==="free"&&(
        <div ref={freeRef} onClick={()=>setSelectedFree(null)} style={{ ...S.altarBg,background:altar.bgCustomColor||template.bg,border:`1px solid ${template.border}`,height:380,position:"relative",overflow:"hidden",cursor:draggingFree?"grabbing":"default",marginBottom:16 }}>
          <AltarTopBar template={template} altarName={altar.name}/>
          {template.star&&<StarField/>}
          <AnimatedBG materialId={altar.bgMaterialId}/>
          <LightOverlay materialId={altar.lightId}/>
          <FrameOverlay materialId={altar.frameMaterialId}/>
          <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"30%",background:template.floor,borderTop:`1px solid ${template.border}` }}/>
          {freeItems.length===0&&<div style={{ position:"absolute",top:"55%",left:"50%",transform:"translate(-50%,-50%)",textAlign:"center",color:`${template.accent}44`,pointerEvents:"none" }}><div style={{ fontSize:32,marginBottom:6 }}>✦</div><div style={{ fontSize:12 }}>下のグッズをクリックして配置しよう</div></div>}
          {freeItems.map(item=>{ const good=goodById(item.goodId); if(!good) return null; const isSel=selectedFree===item.id; return (
            <div key={item.id} onMouseDown={e=>{e.stopPropagation();setSelectedFree(item.id);startFreeDrag(e,item.id);}} onTouchStart={e=>{e.stopPropagation();setSelectedFree(item.id);startFreeDrag(e,item.id);}} onClick={e=>{e.stopPropagation();setSelectedFree(item.id);}}
              style={{ position:"absolute",left:item.x,top:item.y,transform:`translate(-50%,-50%) scale(${item.scale})`,zIndex:item.zIndex,cursor:draggingFree===item.id?"grabbing":"grab",filter:isSel?`drop-shadow(0 0 10px ${template.accent})`:"drop-shadow(0 3px 8px rgba(0,0,0,0.5))",transition:draggingFree===item.id?"none":"filter 0.2s" }}>
              {good.image?<img src={good.image} alt={good.name} style={{ width:56,height:72,objectFit:"contain" }}/>:<div style={{ fontSize:46,lineHeight:1 }}>{good.emoji||"📦"}</div>}
              <div style={{ fontSize:8,textAlign:"center",color:isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.35)",whiteSpace:"nowrap",marginTop:1 }}>{good.name}</div>
              {isSel&&!viewingShared&&(
                <div style={{ position:"absolute",top:-34,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4,background:isDark?"rgba(10,5,20,0.95)":"rgba(255,255,255,0.95)",borderRadius:20,padding:"4px 8px",border:`1px solid ${template.border}`,boxShadow:"0 4px 16px rgba(0,0,0,0.4)" }}>
                  {[{l:"−",a:()=>scaleFreeItem(item.id,-0.15)},{l:"+",a:()=>scaleFreeItem(item.id,+0.15)},{l:"🗑",a:()=>{removeFreeItem(item.id);setSelectedFree(null);}}].map(b=>(
                    <button key={b.l} onMouseDown={e=>{e.stopPropagation();b.a();}} style={{ width:22,height:22,border:"none",borderRadius:"50%",background:b.l==="🗑"?"rgba(239,68,68,0.2)":`${template.accent}22`,color:b.l==="🗑"?"#ef4444":template.accent,fontSize:11,cursor:"pointer",fontWeight:900,padding:0,display:"flex",alignItems:"center",justifyContent:"center" }}>{b.l}</button>
                  ))}
                </div>
              )}
            </div>
          );})}
        </div>
      )}

      {/* Tray */}
      {!viewingShared&&(
        <div style={S.trayWrap}>
          <div style={S.trayTitle}>📦 持ってる・予約済みグッズ <span style={{ fontSize:11,opacity:0.4,marginLeft:6 }}>{altarMode==="shelf"?"ドラッグして棚へ":"クリックで配置"}</span></div>
          {ownedGoods.length===0?<div style={{ padding:"18px",textAlign:"center",opacity:0.4,fontSize:13 }}>「持ってる」か「予約済み」のグッズを登録すると表示されます</div>:(
            <div style={S.tray}>
              {ownedGoods.map(g=>{ const placed=altarMode==="shelf"?onShelf.has(g.id):onFree.has(g.id); return (
                <div key={g.id} draggable={altarMode==="shelf"&&!placed} onDragStart={()=>altarMode==="shelf"&&!placed&&setDragSrcGood(g.id)} onDragEnd={()=>setDragSrcGood(null)} onClick={()=>altarMode==="free"&&!placed&&addFreeItem(g.id)}
                  style={{ ...S.trayItem,opacity:placed?0.3:1,cursor:placed?"default":altarMode==="free"?"pointer":"grab",outline:dragSrcGood===g.id?"2px solid #e879f9":"none" }} title={placed?"配置済み":g.name}>
                  {g.image?<img src={g.image} alt={g.name} style={S.trayItemImg}/>:<div style={S.trayItemEmoji}>{g.emoji||"📦"}</div>}
                  <div style={S.trayItemLabel}>{g.name}</div>
                  <div style={{ ...S.badge,fontSize:8,padding:"1px 5px",background:STATUS[g.status].bg,color:STATUS[g.status].color,position:"static",marginTop:2 }}>{STATUS[g.status].label}</div>
                  {placed&&<div style={S.trayCheckBadge}>✓</div>}
                </div>
              );})}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function AltarTopBar({ template, altarName }) {
  return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"10px 20px",borderBottom:`1px solid ${template.border}`,color:template.accent,background:`${template.accent}08`,fontSize:14 }}><span>{template.emoji}</span><span style={{ fontSize:13,fontWeight:700,letterSpacing:2 }}>{altarName}</span><span>{template.emoji}</span></div>;
}
function StarField() {
  return <>{[...Array(24)].map((_,i)=><div key={i} style={{ position:"absolute",width:i%4===0?3:2,height:i%4===0?3:2,borderRadius:"50%",background:"#fff",opacity:0.15+(i*0.02)%0.4,left:`${5+(i*43)%90}%`,top:`${3+(i*29)%60}%`,animation:`twinkle ${2+i%3}s ease-in-out ${i*0.2}s infinite alternate`,pointerEvents:"none" }}/>)}<style>{`@keyframes twinkle{from{opacity:0.1;}to{opacity:0.6;}}`}</style></>;
}

// ─── Animated BG Layer ───────────────────────────────────────
function AnimatedBG({ materialId }) {
  if (!materialId) return null;
  const mat = MATERIALS.find(m=>m.id===materialId);
  if (!mat) return null;
  const anim = mat.animation;
  const count = anim==="sakura"?20:anim==="snow"?25:anim==="rain"?30:anim==="hearts"?15:anim==="fire"?12:anim==="sparkle"?18:anim==="aurora"?6:anim==="stars"?20:0;
  const items = Array.from({length:count},(_,i)=>i);
  const getStyle = (i) => {
    const base = { position:"absolute", pointerEvents:"none", zIndex:1 };
    const r = (seed,max,min=0)=>min+((seed*137+i*31)%100)*(max-min)/100;
    if (anim==="sakura"||anim==="snow") return { ...base, left:`${r(i,95)}%`, top:`-20px`, fontSize:anim==="sakura"?14:12, animation:`fall${i%3} ${2+r(i,4)}s linear ${r(i,3)}s infinite`, opacity:0.7+r(i,0.3) };
    if (anim==="rain") return { ...base, left:`${r(i,100)}%`, top:`-10px`, width:1, height:12+r(i,20), background:"rgba(180,220,255,0.5)", animation:`rainFall ${0.6+r(i,0.8)}s linear ${r(i,1)}s infinite` };
    if (anim==="hearts") return { ...base, left:`${r(i,90,5)}%`, bottom:`-20px`, fontSize:12+r(i,16), animation:`floatUp ${3+r(i,3)}s ease-in ${r(i,4)}s infinite`, opacity:0.6+r(i,0.4) };
    if (anim==="fire") return { ...base, left:`${r(i,80,10)}%`, bottom:0, fontSize:20+r(i,30), animation:`fireFlicker ${0.8+r(i,1.2)}s ease-in-out ${r(i,1)}s infinite alternate`, opacity:0.5+r(i,0.5), filter:"blur(1px)" };
    if (anim==="sparkle") return { ...base, left:`${r(i,90,5)}%`, top:`${r(i,80,5)}%`, fontSize:8+r(i,12), animation:`sparkleAnim ${1+r(i,2)}s ease-in-out ${r(i,2)}s infinite alternate`, opacity:0 };
    if (anim==="aurora") return { ...base, left:`${i*(100/count)}%`, top:0, width:`${100/count+2}%`, height:"60%", background:`linear-gradient(180deg,${["rgba(100,200,150,0.15)","rgba(150,100,250,0.15)","rgba(80,180,220,0.12)","rgba(200,100,180,0.12)","rgba(100,230,180,0.15)","rgba(180,150,255,0.12)"][i%6]},transparent)`, animation:`aurораWave ${4+i}s ease-in-out ${i*0.5}s infinite alternate`, filter:"blur(8px)" };
    if (anim==="stars") return { ...base, left:`${r(i,95,2)}%`, top:`${r(i,70,2)}%`, fontSize:r(i,4,1)<2?8:r(i,6,2)<3?12:16, animation:`twinkleStar ${1.5+r(i,3)}s ease-in-out ${r(i,2)}s infinite alternate`, opacity:0 };
    return base;
  };
  const getEmoji = (i) => {
    if (anim==="sakura") return "🌸";
    if (anim==="snow") return "❄";
    if (anim==="hearts") return ["💕","💖","💗","💓"][i%4];
    if (anim==="fire") return ["🔥","✨"][i%2];
    if (anim==="sparkle") return ["✨","⭐","💫"][i%3];
    if (anim==="stars") return ["⭐","🌟","✨"][i%3];
    return "";
  };
  const keyframes = `
    @keyframes fall0{from{transform:translateY(0) rotate(0deg);opacity:0.8}to{transform:translateY(420px) rotate(360deg);opacity:0}}
    @keyframes fall1{from{transform:translateY(0) rotate(0deg);opacity:0.7}to{transform:translateY(420px) rotate(-180deg);opacity:0}}
    @keyframes fall2{from{transform:translateY(0) rotate(0deg);opacity:0.9}to{transform:translateY(420px) rotate(270deg);opacity:0}}
    @keyframes rainFall{from{transform:translateY(0);opacity:0.6}to{transform:translateY(420px);opacity:0}}
    @keyframes floatUp{0%{transform:translateY(0) scale(1);opacity:0.8}100%{transform:translateY(-430px) scale(0.3);opacity:0}}
    @keyframes fireFlicker{from{transform:scaleY(1) scaleX(1)}to{transform:scaleY(1.3) scaleX(0.85)}}
    @keyframes sparkleAnim{0%{opacity:0;transform:scale(0.5)}50%{opacity:1;transform:scale(1.2)}100%{opacity:0;transform:scale(0.5)}}
    @keyframes aurораWave{from{opacity:0.4;transform:skewX(-3deg)}to{opacity:0.9;transform:skewX(3deg)}}
    @keyframes twinkleStar{from{opacity:0;transform:scale(0.5)}to{opacity:0.9;transform:scale(1.1)}}
  `;
  return (
    <div style={{ position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:1 }}>
      <style>{keyframes}</style>
      {items.map(i=>(
        <div key={i} style={getStyle(i)}>
          {anim!=="rain"&&anim!=="aurora"&&getEmoji(i)}
        </div>
      ))}
    </div>
  );
}

// ─── Frame Overlay ────────────────────────────────────────────
function FrameOverlay({ materialId }) {
  if (!materialId) return null;
  const mat = MATERIALS.find(m=>m.id===materialId);
  if (!mat) return null;
  const styles = {
    fr_gold:   { border:"4px solid #f59e0b", boxShadow:"inset 0 0 20px rgba(245,158,11,0.3), 0 0 20px rgba(245,158,11,0.2)", borderRadius:18 },
    fr_flower: { border:"4px solid #ec4899", boxShadow:"inset 0 0 20px rgba(236,72,153,0.2)", borderRadius:18, outline:"2px dashed rgba(236,72,153,0.4)", outlineOffset:4 },
    fr_star:   { border:"3px solid #fcd34d", boxShadow:"inset 0 0 30px rgba(252,211,77,0.1), 0 0 15px rgba(252,211,77,0.3)", borderRadius:18 },
    fr_ribbon: { border:"4px solid #f472b6", borderRadius:18, boxShadow:"0 0 0 2px rgba(244,114,182,0.3), inset 0 0 15px rgba(244,114,182,0.1)" },
    fr_neon:   { border:"3px solid #818cf8", borderRadius:18, boxShadow:"0 0 12px #818cf8, 0 0 24px rgba(129,140,248,0.5), inset 0 0 20px rgba(129,140,248,0.1)", animation:"neonPulse 2s ease-in-out infinite alternate" },
    fr_torii:  { border:"4px solid #dc2626", borderRadius:18, boxShadow:"inset 0 0 20px rgba(220,38,38,0.15), 0 0 15px rgba(220,38,38,0.2)" },
  };
  return (
    <>
      <style>{`@keyframes neonPulse{from{box-shadow:0 0 12px #818cf8,0 0 24px rgba(129,140,248,0.5),inset 0 0 20px rgba(129,140,248,0.1)}to{box-shadow:0 0 20px #818cf8,0 0 40px rgba(129,140,248,0.7),inset 0 0 30px rgba(129,140,248,0.2)}}`}</style>
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",zIndex:10,borderRadius:18,...(styles[materialId]||{}) }}/>
      {materialId==="fr_flower"&&<div style={{ position:"absolute",inset:0,pointerEvents:"none",zIndex:11,display:"flex",alignItems:"center",justifyContent:"space-around",flexWrap:"wrap",padding:8,opacity:0.6 }}>{"🌸🌺🌼🌻🌷🌸🌺🌼".split("").map((e,i)=><span key={i} style={{ fontSize:14,position:"absolute",...[{top:4,left:4},{top:4,right:4},{bottom:4,left:4},{bottom:4,right:4},{top:4,left:"48%"},{bottom:4,left:"48%"},{top:"48%",left:4},{top:"48%",right:4}][i]||{} }}>{e}</span>)}</div>}
      {materialId==="fr_torii"&&<div style={{ position:"absolute",top:0,left:0,right:0,height:8,background:"#dc2626",pointerEvents:"none",zIndex:11,borderRadius:"18px 18px 0 0" }}/>}
    </>
  );
}

// ─── Light Overlay ────────────────────────────────────────────
function LightOverlay({ materialId }) {
  if (!materialId) return null;
  const overlays = {
    lt_spot:    <div style={{ position:"absolute",top:0,left:"30%",right:"30%",height:"100%",background:"radial-gradient(ellipse at 50% 30%,rgba(255,255,200,0.15) 0%,transparent 70%)",pointerEvents:"none",zIndex:5 }}/>,
    lt_rainbow: <div style={{ position:"absolute",inset:0,background:"linear-gradient(135deg,rgba(255,0,0,0.04),rgba(255,165,0,0.04),rgba(255,255,0,0.04),rgba(0,255,0,0.04),rgba(0,0,255,0.04),rgba(128,0,128,0.04))",pointerEvents:"none",zIndex:5,animation:"rainbowShift 4s linear infinite" }}/>,
    lt_candle:  <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse at 50% 80%,rgba(255,180,50,0.12) 0%,transparent 60%)",pointerEvents:"none",zIndex:5,animation:"candleFlicker 1.5s ease-in-out infinite alternate" }}/>,
    lt_disco:   <div style={{ position:"absolute",inset:0,background:"conic-gradient(rgba(255,0,128,0.08),rgba(0,255,255,0.08),rgba(128,0,255,0.08),rgba(255,200,0,0.08),rgba(255,0,128,0.08))",pointerEvents:"none",zIndex:5,animation:"discoSpin 3s linear infinite" }}/>,
  };
  return (
    <>
      <style>{`@keyframes rainbowShift{0%{filter:hue-rotate(0deg)}100%{filter:hue-rotate(360deg)}} @keyframes candleFlicker{from{opacity:0.7}to{opacity:1}} @keyframes discoSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      {overlays[materialId]||null}
    </>
  );
}

// ─── Materials Modal ──────────────────────────────────────────
function MaterialsModal({ altar, onUpdateAltar, isPremium, purchasedMaterials, onPurchase, canUseMaterial, onClose, onUpgrade }) {
  const [tab, setTab] = useState("bg");
  const [colorInput, setColorInput] = useState(altar.bgCustomColor||"#1a0a2e");
  const TABS = [["bg","🌌 背景"],["frame","🖼 フレーム"],["deco","🎀 デコ"],["light","💡 ライト"]];
  const items = MATERIALS.filter(m=>m.type===tab);

  const isActive = (mat) => {
    if (mat.type==="bg")    return altar.bgMaterialId===mat.id;
    if (mat.type==="frame") return altar.frameMaterialId===mat.id;
    if (mat.type==="deco")  return altar.decoIds?.includes(mat.id);
    if (mat.type==="light") return altar.lightId===mat.id;
  };
  const toggle = (mat) => {
    if (!canUseMaterial(mat)) return;
    // selecting a material clears custom color
    if (mat.type==="bg")    onUpdateAltar({bgMaterialId:altar.bgMaterialId===mat.id?null:mat.id, bgCustomColor:null});
    if (mat.type==="frame") onUpdateAltar({frameMaterialId: altar.frameMaterialId===mat.id?null:mat.id});
    if (mat.type==="light") onUpdateAltar({lightId:         altar.lightId===mat.id?null:mat.id});
    if (mat.type==="deco")  {
      const cur = altar.decoIds||[];
      onUpdateAltar({decoIds: cur.includes(mat.id)?cur.filter(id=>id!==mat.id):[...cur,mat.id]});
    }
  };
  const applyCustomColor = (hex) => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onUpdateAltar({ bgCustomColor: hex, bgMaterialId: null }); // clear material when custom color applied
    }
  };
  const clearCustomColor = () => { onUpdateAltar({ bgCustomColor: null }); };
  const isCustomColorActive = !!altar.bgCustomColor;

  // Preset solid colors
  const PRESET_COLORS = [
    { hex:"#0c0a14", name:"ディープブラック" },
    { hex:"#1a0a2e", name:"ミッドナイト" },
    { hex:"#0a1628", name:"ネイビー" },
    { hex:"#1a0505", name:"ダークレッド" },
    { hex:"#052e16", name:"フォレスト" },
    { hex:"#1c1000", name:"ディープゴールド" },
    { hex:"#fdf2f8", name:"パステルピンク" },
    { hex:"#f0f4ff", name:"ライトブルー" },
    { hex:"#fffbeb", name:"クリーム" },
    { hex:"#f5f5f5", name:"ホワイト" },
    { hex:"#2d1b69", name:"パープル" },
    { hex:"#134e4a", name:"ティール" },
  ];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:500 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ fontSize:18,fontWeight:800,color:"#c084fc" }}>🎨 素材ショップ</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>

        {!isPremium&&(
          <div style={{ background:"linear-gradient(135deg,rgba(192,132,252,0.1),rgba(232,121,249,0.1))",border:"1px solid rgba(192,132,252,0.3)",borderRadius:12,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:"#c084fc" }}>✨ プレミアムで全素材使い放題</div>
              <div style={{ fontSize:10,color:"#7c6a9a",marginTop:2 }}>静止素材は無料 · アニメ素材 ¥120〜180 / 個別 or プレミアムで使い放題</div>
            </div>
            <button onClick={onUpgrade} style={{ fontSize:11,fontWeight:700,color:"#fff",background:"linear-gradient(135deg,#c084fc,#e879f9)",border:"none",borderRadius:10,padding:"5px 12px",cursor:"pointer",whiteSpace:"nowrap" }}>プランを見る</button>
          </div>
        )}
        {isPremium&&(
          <div style={{ background:"rgba(192,132,252,0.08)",border:"1px solid rgba(192,132,252,0.2)",borderRadius:10,padding:"8px 14px",marginBottom:14,fontSize:11,color:"#c084fc",fontWeight:700,textAlign:"center" }}>
            ✨ プレミアム会員：全素材が使い放題です
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:"flex",gap:6,marginBottom:14,overflowX:"auto" }}>
          {TABS.map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{ flex:1,padding:"6px 4px",borderRadius:10,border:`1px solid ${tab===t?"rgba(192,132,252,0.4)":"rgba(255,255,255,0.08)"}`,background:tab===t?"rgba(192,132,252,0.15)":"transparent",color:tab===t?"#c084fc":"#9ca3af",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>{l}</button>
          ))}
        </div>

        {/* Single color picker (bg tab only, always free) */}
        {tab==="bg"&&(
          <div style={{ background:"rgba(255,255,255,0.03)",border:`2px solid ${isCustomColorActive?"#22c55e":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:"12px 14px",marginBottom:12 }}>
            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
              <span style={{ fontSize:13,fontWeight:700,color:isCustomColorActive?"#22c55e":"#f0e8ff" }}>🎨 単色背景</span>
              <span style={{ fontSize:9,background:"rgba(34,197,94,0.2)",color:"#22c55e",borderRadius:6,padding:"1px 6px",fontWeight:700 }}>無料・静止</span>
              {isCustomColorActive&&<button onClick={clearCustomColor} style={{ marginLeft:"auto",fontSize:10,color:"#9ca3af",background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,padding:"2px 8px",cursor:"pointer" }}>✕ 解除</button>}
            </div>
            {/* Preset swatches */}
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
              {PRESET_COLORS.map(c=>(
                <button key={c.hex} title={c.name} onClick={()=>{ setColorInput(c.hex); applyCustomColor(c.hex); }}
                  style={{ width:28,height:28,borderRadius:8,background:c.hex,border:`2px solid ${altar.bgCustomColor===c.hex?"#22c55e":"rgba(255,255,255,0.15)"}`,cursor:"pointer",transition:"transform 0.1s",flexShrink:0 }}
                  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.15)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
                />
              ))}
            </div>
            {/* Custom hex input */}
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <input type="color" value={colorInput} onChange={e=>{ setColorInput(e.target.value); applyCustomColor(e.target.value); }}
                style={{ width:36,height:36,border:"none",borderRadius:8,cursor:"pointer",padding:2,background:"transparent",flexShrink:0 }}/>
              <input type="text" value={colorInput}
                onChange={e=>{ setColorInput(e.target.value); if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)) applyCustomColor(e.target.value); }}
                placeholder="#000000" maxLength={7}
                style={{ ...S.input,flex:1,padding:"7px 10px",fontSize:13,fontFamily:"monospace" }}/>
              <div style={{ width:36,height:36,borderRadius:8,background:colorInput,border:"1px solid rgba(255,255,255,0.15)",flexShrink:0 }}/>
            </div>
          </div>
        )}

        {/* Items grid */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxHeight:tab==="bg"?260:340,overflowY:"auto" }}>
          {items.map(mat=>{
            const active   = isActive(mat);
            const unlocked = canUseMaterial(mat);
            const owned    = purchasedMaterials.includes(mat.id);
            return (
              <div key={mat.id} onClick={()=>unlocked?toggle(mat):!isPremium&&mat.price>0&&onPurchase(mat.id)}
                style={{ borderRadius:12,padding:"12px 8px",textAlign:"center",cursor:"pointer",transition:"all 0.2s",position:"relative",
                  background:active?"rgba(192,132,252,0.2)":unlocked?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.02)",
                  border:`2px solid ${active?"#c084fc":unlocked?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.04)"}`,
                  opacity:unlocked?1:0.7 }}>
                {active&&<div style={{ position:"absolute",top:5,right:5,width:14,height:14,borderRadius:"50%",background:"#c084fc",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900 }}>✓</div>}
                {mat.tier==="free"&&<div style={{ position:"absolute",top:5,left:5,fontSize:8,background:"rgba(34,197,94,0.2)",color:"#22c55e",borderRadius:6,padding:"1px 4px",fontWeight:700 }}>静止・FREE</div>}
        {mat.tier==="paid"&&mat.animated&&unlocked&&<div style={{ position:"absolute",top:5,left:5,fontSize:8,background:"rgba(192,132,252,0.2)",color:"#c084fc",borderRadius:6,padding:"1px 4px",fontWeight:700 }}>🎬 アニメ</div>}
                {mat.tier==="paid"&&!unlocked&&!isPremium&&<div style={{ position:"absolute",top:5,left:5,fontSize:8,background:"rgba(192,132,252,0.2)",color:"#c084fc",borderRadius:6,padding:"1px 4px",fontWeight:700 }}>¥{mat.price}</div>}
                {owned&&!isPremium&&<div style={{ position:"absolute",top:5,left:5,fontSize:8,background:"rgba(96,165,250,0.2)",color:"#60a5fa",borderRadius:6,padding:"1px 4px",fontWeight:700 }}>購入済</div>}
                <div style={{ fontSize:28,marginBottom:4 }}>{mat.emoji}</div>
                <div style={{ fontSize:11,fontWeight:700,color:active?"#c084fc":"#f0e8ff" }}>{mat.name}</div>
                <div style={{ fontSize:9,color:"#7c6a9a",marginTop:2 }}>{mat.desc}</div>
                {!unlocked&&!isPremium&&mat.price>0&&(
                  <button onClick={e=>{e.stopPropagation();onPurchase(mat.id);}} style={{ marginTop:6,width:"100%",padding:"4px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#c084fc,#e879f9)",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer" }}>
                    ¥{mat.price}で購入
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop:12,fontSize:10,color:"#4b5563",textAlign:"center" }}>
          ※ 個別購入は永久使用可能 · プレミアムは月額で全素材使い放題
        </div>
      </div>
    </div>
  );
}

// ─── Altar Manager Modal ──────────────────────────────────────
function AltarManagerModal({ altars, activeId, isPro, onAdd, onDelete, onRename, onSwitch, onUpgrade, onClose }) {
  const [editingId,setEditingId]=useState(null);
  const [editVal,setEditVal]=useState("");
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:420 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:17,fontWeight:800,color:"#e879f9" }}>⛩ 祭壇を管理</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:8,marginBottom:16 }}>
          {altars.map(a=>(
            <div key={a.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:a.id===activeId?"rgba(232,121,249,0.1)":"rgba(255,255,255,0.03)",borderRadius:12,border:`1px solid ${a.id===activeId?"rgba(232,121,249,0.3)":"rgba(255,255,255,0.07)"}` }}>
              {editingId===a.id?(
                <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={()=>{onRename(a.id,editVal.trim()||a.name);setEditingId(null);}} onKeyDown={e=>{if(e.key==="Enter"){onRename(a.id,editVal.trim()||a.name);setEditingId(null);}if(e.key==="Escape")setEditingId(null);}}
                  style={{ ...S.input,flex:1,padding:"4px 8px",fontSize:13 }} maxLength={30}/>
              ):(
                <span style={{ flex:1,fontSize:13,fontWeight:700,color:a.id===activeId?"#e879f9":"#f0e8ff",cursor:"pointer" }} onClick={()=>onSwitch(a.id)}>{a.name}</span>
              )}
              <button onClick={()=>{setEditingId(a.id);setEditVal(a.name);}} style={{ background:"none",border:"none",color:"#7c6a9a",cursor:"pointer",fontSize:13 }} title="名前を変更">✏</button>
              {altars.length>1&&<button onClick={()=>onDelete(a.id)} style={{ background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:13 }} title="削除">🗑</button>}
              {a.id===activeId&&<span style={{ fontSize:10,color:"#e879f9",background:"rgba(232,121,249,0.15)",padding:"1px 7px",borderRadius:10,fontWeight:700 }}>表示中</span>}
            </div>
          ))}
        </div>
        {!isPro&&altars.length>=FREE_ALTAR_LIMIT?(
          <div style={{ background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,padding:"14px",textAlign:"center" }}>
            <div style={{ fontSize:13,color:"#fbbf24",marginBottom:8 }}>👑 PROプランで祭壇を無制限に作れます</div>
            <button onClick={onUpgrade} style={{ padding:"8px 24px",borderRadius:20,border:"none",background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer" }}>アップグレード</button>
          </div>
        ):(
          <button onClick={onAdd} style={{ width:"100%",padding:"10px",borderRadius:12,border:"1px dashed rgba(232,121,249,0.3)",background:"transparent",color:"#e879f9",fontSize:13,fontWeight:700,cursor:"pointer" }}>＋ 新しい祭壇を作る</button>
        )}
      </div>
    </div>
  );
}

// ─── Upgrade Modal ────────────────────────────────────────────
function UpgradeModal({ onUpgrade, onUpgradePremium, onClose, plan }) {
  const FEATURES = [
    { icon:"⛩", label:"祭壇を無制限に作れる",    free:"1つまで", pro:"無制限",  premium:"無制限" },
    { icon:"🎭", label:"キャラ別フォルダ管理",     free:"✗",       pro:"✓",       premium:"✓" },
    { icon:"🌌", label:"背景アニメーション",        free:"✗",       pro:"✗",       premium:"✓" },
    { icon:"🎨", label:"素材（デコ・フレーム等）", free:"無料のみ", pro:"無料のみ", premium:"全部使い放題" },
    { icon:"📸", label:"シェア画像・URL",          free:"✓",       pro:"✓",       premium:"✓" },
    { icon:"🔖", label:"EC連携・認証バッジ",       free:"✗",       pro:"✓",       premium:"✓" },
  ];
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:460 }} onClick={e=>e.stopPropagation()}>
        <div style={{ textAlign:"center",marginBottom:16 }}>
          <div style={{ fontSize:34,marginBottom:6 }}>👑</div>
          <div style={{ fontSize:20,fontWeight:900,background:"linear-gradient(90deg,#f59e0b,#e879f9,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>SAIDAN プランを選ぶ</div>
          <div style={{ fontSize:12,color:"#7c6a9a",marginTop:3 }}>推し活に、お金の壁を作らない。</div>
        </div>

        {/* 3-column price cards */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16 }}>
          {/* Free */}
          <div style={{ textAlign:"center",padding:"12px 6px",background:"rgba(255,255,255,0.03)",borderRadius:12,border:`2px solid ${plan==="free"?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.08)"}` }}>
            <div style={{ fontSize:10,color:"#9ca3af",marginBottom:3,fontWeight:600 }}>FREE</div>
            <div style={{ fontSize:22,fontWeight:900,color:"#9ca3af" }}>¥0</div>
            <div style={{ fontSize:9,color:"#6b7280",marginTop:2 }}>ずっと無料</div>
          </div>
          {/* PRO */}
          <div style={{ textAlign:"center",padding:"12px 6px",background:"rgba(245,158,11,0.08)",borderRadius:12,border:`2px solid ${plan==="pro"?"#f59e0b":"rgba(245,158,11,0.25)"}`,position:"relative" }}>
            {plan==="pro"&&<div style={{ position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",fontSize:9,background:"#f59e0b",color:"#000",borderRadius:10,padding:"1px 8px",fontWeight:800,whiteSpace:"nowrap" }}>現在のプラン</div>}
            <div style={{ fontSize:10,color:"#f59e0b",marginBottom:3,fontWeight:700 }}>PRO</div>
            <div><span style={{ fontSize:22,fontWeight:900,color:"#f59e0b" }}>¥298</span></div>
            <div style={{ fontSize:9,color:"#6b7280",marginTop:2 }}>学割 ¥198</div>
            <div style={{ fontSize:9,color:"#6b7280" }}>年払 ¥2,980</div>
          </div>
          {/* Premium */}
          <div style={{ textAlign:"center",padding:"12px 6px",background:"linear-gradient(135deg,rgba(192,132,252,0.12),rgba(232,121,249,0.08))",borderRadius:12,border:`2px solid ${plan==="premium"?"#c084fc":"rgba(192,132,252,0.3)"}`,position:"relative" }}>
            {plan==="premium"&&<div style={{ position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",fontSize:9,background:"#c084fc",color:"#fff",borderRadius:10,padding:"1px 8px",fontWeight:800,whiteSpace:"nowrap" }}>現在のプラン</div>}
            <div style={{ fontSize:10,color:"#c084fc",marginBottom:3,fontWeight:700 }}>✨ PREMIUM</div>
            <div><span style={{ fontSize:22,fontWeight:900,color:"#c084fc" }}>¥498</span></div>
            <div style={{ fontSize:9,color:"#6b7280",marginTop:2 }}>学割 ¥348</div>
            <div style={{ fontSize:9,color:"#6b7280" }}>年払 ¥4,980</div>
          </div>
        </div>
        <div style={{ fontSize:10,color:"#4b5563",textAlign:"center",marginBottom:14 }}>学割は大学メールアドレス（ac.jp）で認証予定 · Stripe導入時に実装</div>
        {/* Feature table */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex",padding:"4px 0 8px",borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ flex:1,fontSize:10,color:"#6b7280" }}></span>
            <span style={{ fontSize:10,color:"#9ca3af",width:52,textAlign:"center",fontWeight:600 }}>FREE</span>
            <span style={{ fontSize:10,color:"#f59e0b",width:60,textAlign:"center",fontWeight:700 }}>PRO</span>
            <span style={{ fontSize:10,color:"#c084fc",width:70,textAlign:"center",fontWeight:700 }}>PREMIUM</span>
          </div>
          {FEATURES.map(f=>(
            <div key={f.label} style={{ display:"flex",alignItems:"center",gap:6,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize:14,width:20,textAlign:"center" }}>{f.icon}</span>
              <span style={{ flex:1,fontSize:11,color:"#d1d5db" }}>{f.label}</span>
              <span style={{ fontSize:10,color:"#6b7280",width:52,textAlign:"center" }}>{f.free}</span>
              <span style={{ fontSize:10,color:"#4ade80",fontWeight:700,width:60,textAlign:"center" }}>{f.pro}</span>
              <span style={{ fontSize:10,color:"#c084fc",fontWeight:700,width:70,textAlign:"center" }}>{f.premium}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:10 }}>
          {plan!=="pro"&&plan!=="premium"&&<button onClick={onUpgrade} style={{ flex:1,padding:"11px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer" }}>👑 PRO（¥298）</button>}
          {plan!=="premium"&&<button onClick={onUpgradePremium} style={{ flex:1,padding:"11px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#c084fc,#e879f9)",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer" }}>✨ PREMIUM（¥498）</button>}
          {plan==="premium"&&<div style={{ flex:1,padding:"11px",borderRadius:12,background:"rgba(192,132,252,0.1)",border:"1px solid rgba(192,132,252,0.3)",color:"#c084fc",fontSize:13,fontWeight:700,textAlign:"center" }}>✨ プレミアム会員です</div>}
        </div>
        <div style={{ fontSize:10,color:"#4b5563",textAlign:"center" }}>※ デモです。実際の課金は発生しません。本サービスではStripe等と連携予定。</div>
      </div>
    </div>
  );
}

// ─── Template Modal ───────────────────────────────────────────
function TemplateModal({ current, customColors, onSelect, onClose }) {
  const [tab,setTab]=useState("preset");
  const baseTemplate=TEMPLATES.find(t=>t.id===current)||TEMPLATES[0];
  const merged=customColors?{...baseTemplate,...customColors}:baseTemplate;
  const [bgTop,setBgTop]=useState(merged.bg.match(/#[0-9a-f]{3,6}/gi)?.[0]||"#0c0a14");
  const [bgBot,setBgBot]=useState(merged.bg.match(/#[0-9a-f]{3,6}/gi)?.[1]||"#1a0f2e");
  const [accent,setAccent]=useState(merged.accent);
  const [plankTop,setPlankTop]=useState(merged.plank.match(/#[0-9a-f]{3,6}/gi)?.[0]||"#3d2060");
  const [plankBot,setPlankBot]=useState(merged.plank.match(/#[0-9a-f]{3,6}/gi)?.[1]||"#2a1540");
  const [isDarkMode,setIsDarkMode]=useState(merged.dark!==false);
  const hexInput=(label,val,set)=>(
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:11,color:"#7c6a9a",marginBottom:5,fontWeight:600 }}>{label}</div>
      <div style={{ display:"flex",gap:8,alignItems:"center" }}>
        <input type="color" value={val} onChange={e=>set(e.target.value)} style={{ width:36,height:36,border:"none",borderRadius:8,cursor:"pointer",padding:2,background:"rgba(255,255,255,0.05)" }}/>
        <input type="text" value={val} onChange={e=>{if(/^#[0-9a-fA-F]{0,6}$/.test(e.target.value))set(e.target.value);}} maxLength={7} placeholder="#000000" style={{ ...S.input,flex:1,padding:"7px 10px",fontSize:13,fontFamily:"monospace" }}/>
      </div>
    </div>
  );
  const applyCustom=()=>onSelect(current,{bg:`linear-gradient(180deg,${bgTop},${bgBot})`,accent,gold:accent,floor:`${accent}14`,border:`${accent}55`,plank:`linear-gradient(180deg,${plankTop},${plankBot})`,dark:isDarkMode});
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:540 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ fontSize:18,fontWeight:800,color:"#e879f9" }}>テンプレート & カラー設定</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:16 }}>
          {[["preset","🎨 プリセット"],["custom","✏ カスタムカラー"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{ flex:1,padding:"7px",borderRadius:10,border:`1px solid ${tab===t?"rgba(232,121,249,0.4)":"rgba(255,255,255,0.08)"}`,background:tab===t?"rgba(232,121,249,0.15)":"transparent",color:tab===t?"#e879f9":"#9ca3af",fontSize:12,fontWeight:700,cursor:"pointer" }}>{l}</button>
          ))}
        </div>
        {tab==="preset"&&(
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10 }}>
            {TEMPLATES.map(t=>(
              <button key={t.id} onClick={()=>onSelect(t.id,null)} style={{ background:t.bg,border:`2px solid ${current===t.id&&!customColors?t.accent:"transparent"}`,borderRadius:14,padding:"14px 8px",cursor:"pointer",textAlign:"center",transition:"all 0.2s",position:"relative",overflow:"hidden" }}>
                {current===t.id&&!customColors&&<div style={{ position:"absolute",top:5,right:5,fontSize:9,background:t.accent,color:"#fff",borderRadius:20,padding:"1px 5px",fontWeight:700 }}>✓</div>}
                <div style={{ fontSize:26,marginBottom:5 }}>{t.emoji}</div>
                <div style={{ fontSize:12,fontWeight:800,color:t.dark===false?"#1a0030":"#f0e8ff" }}>{t.name}</div>
                <div style={{ fontSize:9,color:t.accent,marginTop:2 }}>{t.desc}</div>
              </button>
            ))}
          </div>
        )}
        {tab==="custom"&&(<>
          <div style={{ background:`linear-gradient(180deg,${bgTop},${bgBot})`,borderRadius:12,height:70,border:`2px solid ${accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:accent,letterSpacing:1,position:"relative",overflow:"hidden",marginBottom:14 }}>
            <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"35%",background:`${accent}14` }}/>
            <div style={{ position:"absolute",bottom:"33%",left:"10%",right:"10%",height:6,background:`linear-gradient(180deg,${plankTop},${plankBot})`,borderRadius:3 }}/>
            <span style={{ position:"relative",zIndex:1 }}>⛩ プレビュー</span>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px" }}>
            {hexInput("背景（上）",bgTop,setBgTop)}{hexInput("背景（下）",bgBot,setBgBot)}
            {hexInput("アクセントカラー",accent,setAccent)}{hexInput("棚カラー（上）",plankTop,setPlankTop)}
            {hexInput("棚カラー（下）",plankBot,setPlankBot)}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"10px 14px",background:"rgba(255,255,255,0.04)",borderRadius:10 }}>
            <span style={{ fontSize:12,color:"#9ca3af",flex:1 }}>ダークモード（テキストを白にする）</span>
            <button onClick={()=>setIsDarkMode(d=>!d)} style={{ width:42,height:24,borderRadius:12,border:"none",background:isDarkMode?"#e879f9":"rgba(255,255,255,0.1)",cursor:"pointer",position:"relative",transition:"background 0.2s" }}><div style={{ width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:isDarkMode?21:3,transition:"left 0.2s" }}/></button>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            <button onClick={()=>{setBgTop(baseTemplate.bg.match(/#[0-9a-f]{3,6}/gi)?.[0]||"#0c0a14");setBgBot(baseTemplate.bg.match(/#[0-9a-f]{3,6}/gi)?.[1]||"#1a0f2e");setAccent(baseTemplate.accent);setPlankTop(baseTemplate.plank.match(/#[0-9a-f]{3,6}/gi)?.[0]||"#3d2060");setPlankBot(baseTemplate.plank.match(/#[0-9a-f]{3,6}/gi)?.[1]||"#2a1540");setIsDarkMode(baseTemplate.dark!==false);}}
              style={{ flex:1,padding:"10px",borderRadius:12,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#9ca3af",fontSize:12,fontWeight:700,cursor:"pointer" }}>🔄 リセット</button>
            <button onClick={applyCustom} style={{ flex:2,padding:"10px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer" }}>✓ このカラーで適用</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────
function ShareModal({ altar, template, goodById, goods, onClose }) {
  const canvasRef=useRef(null);
  const [generating,setGenerating]=useState(true);
  const [imgSrc,setImgSrc]=useState(null);
  const [shareUrl,setShareUrl]=useState(null);
  const [urlCopied,setUrlCopied]=useState(false);
  const [activeTab,setActiveTab]=useState("image");
  const isDark=template.dark!==false;
  useEffect(()=>{
    setShareUrl(encodeAltarToURL(altar,goods));
    setTimeout(()=>generateImage(),300);
  },[]);
  const generateImage=async()=>{
    setGenerating(true);
    try {
      const canvas=canvasRef.current; const ctx=canvas.getContext("2d"); const W=800,H=500;
      canvas.width=W; canvas.height=H;
      const grd=ctx.createLinearGradient(0,0,0,H); const bgC=template.bg.match(/#[0-9a-f]{3,6}/gi)||["#0c0a14","#1a0f2e"]; grd.addColorStop(0,bgC[0]); grd.addColorStop(1,bgC[bgC.length-1]); ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
      ctx.fillStyle=template.floor; ctx.fillRect(0,H*0.68,W,H*0.32);
      ctx.fillStyle=`${template.accent}18`; ctx.fillRect(0,0,W,52); ctx.strokeStyle=template.border; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,52); ctx.lineTo(W,52); ctx.stroke();
      ctx.fillStyle=template.accent; ctx.font="bold 15px sans-serif"; ctx.textAlign="center"; ctx.fillText(`${template.emoji}  ${altar.name}  ${template.emoji}`,W/2,34);
      if(template.star){ctx.fillStyle="#fff";for(let i=0;i<30;i++){ctx.globalAlpha=0.2+(i*0.02)%0.4;ctx.beginPath();ctx.arc((i*137)%W,60+(i*89)%(H*0.5),i%5===0?2:1,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
      if(altar.altarMode==="shelf"){
        const shelfTop=60,shelfH=(H-140)/SHELF_ROWS,cellW=(W-40)/SHELF_COLS;
        for(let r=0;r<SHELF_ROWS;r++){
          const rowY=shelfTop+r*shelfH; const pC=template.plank.match(/#[0-9a-f]{3,6}/gi)||["#3d2060","#2a1540"];
          const pg=ctx.createLinearGradient(0,rowY+shelfH-12,0,rowY+shelfH); pg.addColorStop(0,pC[0]); pg.addColorStop(1,pC[pC.length-1]); ctx.fillStyle=pg; ctx.beginPath(); ctx.roundRect(20,rowY+shelfH-10,W-40,10,3); ctx.fill();
          for(let c=0;c<SHELF_COLS;c++){
            const gid=altar.shelf[r][c]; if(!gid) continue; const good=goodById(gid); if(!good) continue;
            const cx=20+c*cellW+cellW/2,cy=rowY+shelfH-12,x=cx-32,y=cy-80;
            if(good.image){await new Promise(res=>{const img=new Image();img.crossOrigin="anonymous";img.onload=()=>{ctx.drawImage(img,x,y,64,80);ctx.fillStyle=isDark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)";ctx.font="9px sans-serif";ctx.textAlign="center";ctx.fillText(good.name.substring(0,8),cx,cy+10);res();};img.onerror=res;img.src=good.image;});}
            else{ctx.font="52px serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(good.emoji||"📦",cx,y+40);ctx.textBaseline="alphabetic";ctx.fillStyle=isDark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)";ctx.font="9px sans-serif";ctx.fillText(good.name.substring(0,8),cx,cy+10);}
          }
        }
      } else {
        for(const item of altar.freeItems){const good=goodById(item.goodId);if(!good)continue;const sc=item.scale,iw=56*sc,ih=72*sc,x=item.x-iw/2,y=item.y-ih/2;
          if(good.image){await new Promise(res=>{const img=new Image();img.crossOrigin="anonymous";img.onload=()=>{ctx.drawImage(img,x,y,iw,ih);res();};img.onerror=res;img.src=good.image;});}
          else{ctx.font=`${ih*0.7}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(good.emoji||"📦",x+iw/2,y+ih/2);ctx.textBaseline="alphabetic";}
          ctx.fillStyle=isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.35)";ctx.font="9px sans-serif";ctx.textAlign="center";ctx.fillText(good.name.substring(0,8),item.x,item.y+ih/2+12);
        }
      }
      ctx.fillStyle=isDark?"rgba(232,121,249,0.3)":"rgba(150,0,200,0.25)"; ctx.font="bold 11px sans-serif"; ctx.textAlign="right"; ctx.fillText("⛩ SAIDAN",W-16,H-12);
      setImgSrc(canvas.toDataURL("image/png"));
    } catch(e){console.error(e);}
    setGenerating(false);
  };
  const download=()=>{ const a=document.createElement("a"); a.href=imgSrc; a.download=`${altar.name}.png`; a.click(); };
  const copyImg=async()=>{ try{ const blob=await(await fetch(imgSrc)).blob(); await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]); }catch{alert("コピーに失敗しました");} };
  const copyUrl=async()=>{ try{ await navigator.clipboard.writeText(shareUrl); setUrlCopied(true); setTimeout(()=>setUrlCopied(false),2500); }catch{alert("コピーに失敗しました");} };
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:500 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:18,fontWeight:800,color:"#e879f9" }}>祭壇をシェア</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:16 }}>
          {[["image","📸 画像保存"],["url","🔗 URLシェア"]].map(([t,l])=>(
            <button key={t} onClick={()=>setActiveTab(t)} style={{ flex:1,padding:"8px",borderRadius:10,border:`1px solid ${activeTab===t?"rgba(232,121,249,0.4)":"rgba(255,255,255,0.08)"}`,background:activeTab===t?"rgba(232,121,249,0.15)":"transparent",color:activeTab===t?"#e879f9":"#9ca3af",fontSize:13,fontWeight:700,cursor:"pointer" }}>{l}</button>
          ))}
        </div>
        <canvas ref={canvasRef} style={{ display:"none" }}/>
        {activeTab==="image"&&(<>
          <div style={{ borderRadius:12,overflow:"hidden",border:"1px solid rgba(232,121,249,0.2)",marginBottom:16,minHeight:180,display:"flex",alignItems:"center",justifyContent:"center",background:"#0a0414" }}>
            {generating?<div style={{ textAlign:"center",color:"#7c6a9a",padding:40 }}><div style={{ fontSize:32,marginBottom:8,animation:"spin 1s linear infinite" }}>⛩</div><div style={{ fontSize:13 }}>生成中…</div><style>{`@keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}`}</style></div>
            :imgSrc?<img src={imgSrc} alt="プレビュー" style={{ width:"100%",borderRadius:12 }}/>
            :<div style={{ color:"#f87171",padding:20,fontSize:13 }}>生成に失敗しました</div>}
          </div>
          {!generating&&imgSrc&&<><div style={{ display:"flex",gap:10,marginBottom:10 }}><button onClick={download} style={{ flex:1,padding:"11px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer" }}>⬇ ダウンロード</button><button onClick={copyImg} style={{ flex:1,padding:"11px",borderRadius:12,border:"1px solid rgba(232,121,249,0.3)",background:"rgba(232,121,249,0.1)",color:"#e879f9",fontSize:13,fontWeight:700,cursor:"pointer" }}>📋 コピー</button></div><div style={{ fontSize:11,color:"#5c4d7a",textAlign:"center" }}>XやInstagramにそのまま投稿できます 🎉</div></>}
        </>)}
        {activeTab==="url"&&(<>
          <div style={{ background:"rgba(232,121,249,0.06)",border:"1px solid rgba(232,121,249,0.2)",borderRadius:12,padding:"16px",marginBottom:14 }}>
            <div style={{ fontSize:12,color:"#9ca3af",marginBottom:8,fontWeight:600 }}>シェアURL</div>
            <div style={{ fontSize:10,color:"#e879f9",wordBreak:"break-all",lineHeight:1.6,fontFamily:"monospace",background:"rgba(0,0,0,0.3)",padding:"10px",borderRadius:8,maxHeight:80,overflowY:"auto" }}>{shareUrl||"生成中…"}</div>
          </div>
          <button onClick={copyUrl} style={{ width:"100%",padding:"12px",borderRadius:14,border:urlCopied?"1px solid #22c55e":"none",background:urlCopied?"rgba(34,197,94,0.2)":"linear-gradient(135deg,#e879f9,#818cf8)",color:urlCopied?"#22c55e":"#fff",fontSize:14,fontWeight:800,cursor:"pointer",marginBottom:12 }}>{urlCopied?"✓ コピーしました！":"🔗 URLをコピー"}</button>
          <div style={{ background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:"12px 14px",fontSize:11,color:"#fbbf24",lineHeight:1.7 }}>
            <div style={{ fontWeight:700,marginBottom:4 }}>⚠ 注意</div>
            <div>• 画像アップロードしたグッズはURLに含まれません</div>
            <div>• 受け取った人は閲覧のみ（編集不可）</div>
          </div>
          <button onClick={()=>{navigator.clipboard.writeText(`${altar.name} の推し祭壇を見てね⛩✨ #SAIDAN ${shareUrl}`).then(()=>alert("コピーしました！"));}} style={{ width:"100%",marginTop:10,padding:"9px",borderRadius:12,border:"1px solid rgba(129,140,248,0.3)",background:"rgba(129,140,248,0.1)",color:"#818cf8",fontSize:12,fontWeight:700,cursor:"pointer" }}>𝕏 ポスト用テキストをコピー</button>
        </>)}
      </div>
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────
function AddModal({ onClose, onAdd, characters, isPro }) {
  const [name,setName]=useState(""); const [series,setSeries]=useState(""); const [status,setStatus]=useState("owned"); const [goodType,setGoodType]=useState("other");
  const [image,setImage]=useState(null); const [emoji,setEmoji]=useState("📦"); const [imgMode,setImgMode]=useState("emoji");
  const [purchaseDate,setPurchaseDate]=useState(""); const [releaseDate,setReleaseDate]=useState(""); const [memo,setMemo]=useState("");
  const [characterId,setCharacterId]=useState(null); const [error,setError]=useState("");
  const fileRef=useRef(null);
  const EMOJIS=["📦","🧸","🖼️","🪆","🎀","🎵","📚","🎮","☕","⭐","🌸","💎","🎪","🖊️","🎭","🏆"];
  const handleFile=async(e)=>{ const f=e.target.files[0]; if(!f) return; if(f.size>5*1024*1024){setError("5MB以下にしてください");return;} setImage(await readFileAsDataURL(f)); setError(""); };
  const submit=()=>{ if(!name.trim()){setError("グッズ名を入力してください");return;} onAdd({id:newUid(),name:name.trim(),series:series.trim(),status,goodType,image:imgMode==="upload"?image:null,emoji:imgMode==="emoji"?emoji:"📦",purchaseDate,releaseDate,memo:memo.trim(),characterId,createdAt:new Date().toISOString()}); onClose(); };
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18 }}>
          <div style={{ fontSize:18,fontWeight:800,color:"#e879f9" }}>グッズを追加</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:16 }}>
          {Object.entries(STATUS).map(([k,v])=>(
            <button key={k} onClick={()=>setStatus(k)} style={{ flex:1,padding:"8px 4px",borderRadius:12,fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.2s",background:status===k?v.bg:"transparent",color:status===k?v.color:"#666",border:`2px solid ${status===k?v.color:"transparent"}` }}>{v.icon} {v.label}</button>
          ))}
        </div>
        <div style={{ display:"flex",gap:8,marginBottom:12 }}>
          {[["emoji","絵文字"],["upload","画像アップロード"]].map(([m,l])=>(
            <button key={m} onClick={()=>setImgMode(m)} style={{ flex:1,padding:"7px",borderRadius:10,border:`1px solid ${imgMode===m?"rgba(232,121,249,0.4)":"rgba(255,255,255,0.1)"}`,background:imgMode===m?"rgba(232,121,249,0.15)":"transparent",color:imgMode===m?"#e879f9":"#9ca3af",fontSize:12,fontWeight:600,cursor:"pointer" }}>{l}</button>
          ))}
        </div>
        {imgMode==="emoji"?(
          <div style={{ display:"flex",flexWrap:"wrap",gap:7,marginBottom:16,justifyContent:"center" }}>
            {EMOJIS.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{ fontSize:24,background:"rgba(255,255,255,0.05)",border:`2px solid ${emoji===e?"#e879f9":"transparent"}`,borderRadius:10,width:42,height:42,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>{e}</button>)}
          </div>
        ):(
          <div style={{ border:"2px dashed rgba(232,121,249,0.3)",borderRadius:12,height:120,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",marginBottom:16,color:"#7c6a9a",overflow:"hidden" }} onClick={()=>fileRef.current?.click()}>
            {image?<img src={image} alt="preview" style={{ width:"100%",height:"100%",objectFit:"contain" }}/>:<><div style={{ fontSize:28,marginBottom:6 }}>📷</div><div style={{ fontSize:12 }}>タップして画像を選択（5MB以下）</div></>}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }}/>
          </div>
        )}
        <div style={S.fieldGroup}><label style={S.label}>グッズ名 *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="例: 月ノ美兎 アクリルスタンド" style={S.input} maxLength={60}/></div>
        <div style={S.fieldGroup}><label style={S.label}>シリーズ / タグ</label><input value={series} onChange={e=>setSeries(e.target.value)} placeholder="例: にじさんじ" style={S.input} maxLength={40}/></div>
        <div style={S.fieldGroup}>
          <label style={S.label}>グッズの種類</label>
          <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
            {GOOD_TYPES.map(t=>(
              <button key={t.id} onClick={()=>setGoodType(t.id)} style={{ padding:"5px 10px",borderRadius:20,border:`1px solid ${goodType===t.id?"rgba(232,121,249,0.5)":"rgba(255,255,255,0.1)"}`,background:goodType===t.id?"rgba(232,121,249,0.15)":"transparent",color:goodType===t.id?"#e879f9":"#9ca3af",fontSize:11,fontWeight:600,cursor:"pointer" }}>{t.emoji} {t.label}</button>
            ))}
          </div>
        </div>
        {isPro&&characters.length>0&&(
          <div style={S.fieldGroup}>
            <label style={S.label}>キャラクター（PRO）</label>
            <select value={characterId||""} onChange={e=>setCharacterId(e.target.value||null)} style={{ ...S.input,cursor:"pointer" }}>
              <option value="">— 未設定</option>
              {characters.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
        )}
        {status==="owned"&&<div style={S.fieldGroup}><label style={S.label}>購入日</label><input type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)} style={S.input}/></div>}
        {status==="reserved"&&<div style={S.fieldGroup}><label style={S.label}>発売予定日</label><input type="date" value={releaseDate} onChange={e=>setReleaseDate(e.target.value)} style={S.input}/></div>}
        <div style={S.fieldGroup}><label style={S.label}>メモ</label><textarea value={memo} onChange={e=>setMemo(e.target.value)} placeholder="イベント限定品など" style={{ ...S.input,height:52,resize:"none" }} maxLength={100}/></div>
        <div style={{ background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:10,padding:"10px 14px",fontSize:11,color:"#fbbf24",marginBottom:14,lineHeight:1.6 }}>⚠ 実際に所持・購入・予約したグッズのみ登録してください。将来的にECショップの購入履歴と自動連携予定です。</div>
        {error&&<div style={{ color:"#f87171",fontSize:12,marginBottom:10,fontWeight:600 }}>{error}</div>}
        <button onClick={submit} style={{ width:"100%",padding:"12px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer" }}>追加する</button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const S = {
  root:{ fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif",minHeight:"100vh",background:"#0c0a14",color:"#f0e8ff",display:"flex",flexDirection:"column",userSelect:"none" },
  toast:{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"#1e1535",color:"#e9d5ff",padding:"10px 22px",borderRadius:30,fontSize:13,fontWeight:700,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",zIndex:9999,border:"1px solid rgba(232,121,249,0.3)" },
  header:{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px",background:"rgba(12,10,20,0.97)",borderBottom:"1px solid rgba(232,121,249,0.12)",position:"sticky",top:0,zIndex:100 },
  logo:{ display:"flex",alignItems:"center",gap:10 },
  logoText:{ fontSize:18,fontWeight:900,letterSpacing:3,background:"linear-gradient(90deg,#e879f9,#818cf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" },
  logoSub:{ fontSize:10,color:"#7c6a9a" },
  navBtn:{ padding:"6px 13px",borderRadius:20,border:"1px solid rgba(232,121,249,0.18)",background:"transparent",color:"#9ca3af",fontSize:12,fontWeight:600,cursor:"pointer" },
  navBtnOn:{ background:"rgba(232,121,249,0.15)",color:"#e879f9",border:"1px solid rgba(232,121,249,0.4)" },
  main:{ flex:1,padding:"18px 16px",maxWidth:780,width:"100%",margin:"0 auto" },
  statsRow:{ display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16 },
  statCard:{ background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 8px",textAlign:"center",border:"1px solid rgba(255,255,255,0.06)" },
  toolbar:{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8 },
  filterBtn:{ padding:"5px 12px",borderRadius:20,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"#9ca3af",fontSize:12,fontWeight:600,cursor:"pointer" },
  filterBtnOn:{ background:"rgba(232,121,249,0.15)",color:"#e879f9",border:"1px solid rgba(232,121,249,0.3)" },
  addBtn:{ padding:"8px 18px",borderRadius:20,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 12px rgba(232,121,249,0.3)" },
  grid:{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))",gap:10 },
  card:{ background:"rgba(255,255,255,0.04)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",overflow:"hidden",display:"flex",flexDirection:"column" },
  cardImgWrap:{ position:"relative",aspectRatio:"1",background:"rgba(0,0,0,0.3)" },
  cardImg:{ width:"100%",height:"100%",objectFit:"contain" },
  cardEmoji:{ width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:52 },
  badge:{ position:"absolute",top:8,left:8,padding:"3px 8px",borderRadius:20,fontSize:10,fontWeight:700 },
  cardBody:{ padding:"10px 12px",flex:1 },
  cardName:{ fontSize:13,fontWeight:700,marginBottom:3,lineHeight:1.3 },
  cardSeries:{ fontSize:11,color:"#818cf8",marginBottom:2 },
  cardMeta:{ fontSize:10,color:"#6b7280" },
  cardActions:{ display:"flex",justifyContent:"flex-end",padding:"7px 10px",gap:6,borderTop:"1px solid rgba(255,255,255,0.05)",alignItems:"center" },
  iconBtn:{ background:"none",border:"none",fontSize:15,cursor:"pointer",padding:"2px 6px",borderRadius:6 },
  statusMenu:{ position:"absolute",right:0,top:28,background:"#1a1230",border:"1px solid rgba(232,121,249,0.2)",borderRadius:10,overflow:"hidden",zIndex:50,minWidth:100,boxShadow:"0 8px 24px rgba(0,0,0,0.5)" },
  statusMenuItem:{ display:"block",width:"100%",padding:"8px 12px",border:"none",textAlign:"left",fontSize:12,fontWeight:600,cursor:"pointer" },
  modeBtn:{ padding:"7px 14px",borderRadius:20,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#9ca3af",fontSize:12,fontWeight:600,cursor:"pointer" },
  modeBtnOn:{ background:"rgba(232,121,249,0.15)",color:"#e879f9",border:"1px solid rgba(232,121,249,0.35)" },
  shareBtn:{ padding:"7px 16px",borderRadius:20,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 10px rgba(232,121,249,0.3)" },
  altarBg:{ background:"linear-gradient(180deg,#170d2e,#100820)",borderRadius:18,border:"1px solid rgba(232,121,249,0.18)",boxShadow:"0 8px 40px rgba(0,0,0,0.5)",overflow:"hidden" },
  shelfRow:{ position:"relative",padding:"10px 12px 0" },
  shelfPlank:{ position:"absolute",bottom:0,left:8,right:8,height:8,borderRadius:"0 0 4px 4px",boxShadow:"0 4px 12px rgba(0,0,0,0.4)" },
  shelfCell:{ aspectRatio:"0.7",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",position:"relative",transition:"all 0.15s" },
  shelfItem:{ width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",position:"relative",cursor:"grab",padding:"0 2px 2px" },
  shelfItemImg:{ width:"80%",flex:1,objectFit:"contain",minHeight:0 },
  shelfItemEmoji:{ fontSize:30,flex:1,display:"flex",alignItems:"center",justifyContent:"center" },
  shelfItemLabel:{ fontSize:8,textAlign:"center",width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" },
  removeCellBtn:{ position:"absolute",top:-4,right:-4,width:15,height:15,borderRadius:"50%",border:"none",background:"#ef4444",color:"#fff",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,padding:0 },
  emptyCellHint:{ fontSize:16,pointerEvents:"none" },
  trayWrap:{ background:"rgba(255,255,255,0.03)",borderRadius:14,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden" },
  trayTitle:{ padding:"11px 16px",fontSize:13,fontWeight:700,borderBottom:"1px solid rgba(255,255,255,0.05)",color:"#c084fc" },
  tray:{ display:"flex",gap:10,padding:"12px 16px",overflowX:"auto",flexWrap:"wrap" },
  trayItem:{ width:68,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3,position:"relative",background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"8px 4px",border:"1px solid rgba(255,255,255,0.07)",transition:"all 0.15s" },
  trayItemImg:{ width:48,height:58,objectFit:"contain" },
  trayItemEmoji:{ fontSize:32,height:58,display:"flex",alignItems:"center",justifyContent:"center" },
  trayItemLabel:{ fontSize:9,color:"rgba(255,255,255,0.45)",textAlign:"center",width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" },
  trayCheckBadge:{ position:"absolute",top:4,right:4,width:14,height:14,borderRadius:"50%",background:"#22c55e",color:"#fff",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900 },
  nameSaveBtn:{ background:"#e879f9",color:"#fff",border:"none",borderRadius:12,padding:"4px 14px",fontSize:12,fontWeight:700,cursor:"pointer" },
  overlay:{ position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16 },
  modal:{ background:"#110d20",borderRadius:20,padding:"22px 20px",width:"100%",maxWidth:440,maxHeight:"90vh",overflowY:"auto",border:"1px solid rgba(232,121,249,0.22)",boxShadow:"0 20px 60px rgba(0,0,0,0.8)" },
  confirmBox:{ background:"#110d20",borderRadius:16,padding:"28px 24px",maxWidth:320,width:"100%",border:"1px solid rgba(239,68,68,0.3)",textAlign:"center" },
  btnGhost:{ padding:"8px 20px",borderRadius:12,border:"1px solid rgba(255,255,255,0.15)",background:"transparent",color:"#9ca3af",fontSize:13,fontWeight:700,cursor:"pointer" },
  btnDanger:{ padding:"8px 20px",borderRadius:12,border:"none",background:"#ef4444",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer" },
  fieldGroup:{ marginBottom:11 },
  label:{ display:"block",fontSize:11,color:"#7c6a9a",fontWeight:700,marginBottom:4,letterSpacing:0.5 },
  input:{ width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:10,padding:"9px 12px",color:"#f0e8ff",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit" },
  emptyMsg:{ textAlign:"center",padding:40,color:"#6b7280" },
  emptyState:{ textAlign:"center",padding:"60px 20px",color:"#6b7280" },
};
