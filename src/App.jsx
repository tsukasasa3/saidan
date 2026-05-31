import { useState, useRef, useCallback, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────
const STORAGE_KEY = "saidan-v4";

// ── Supabase config ───────────────────────────────────────────
const SUPABASE_URL  = "https://gwkkyoqgcahyzasngaje.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3a2t5b3FnY2FoeXphc25nYWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzI2NTEsImV4cCI6MjA5NTYwODY1MX0.fJRKEQLEY3IP90AJkWStDUUbrUif7lwA8hH9ztS6IUo";

async function refreshSession() {
  const session = JSON.parse(localStorage.getItem("saidan_session")||"null");
  if (!session?.refresh_token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method:"POST", headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON},
      body: JSON.stringify({refresh_token: session.refresh_token})
    });
    const data = await res.json();
    if (data.error || !data.access_token) return null;
    localStorage.setItem("saidan_session", JSON.stringify(data));
    return data;
  } catch { return null; }
}

async function sbFetch(path, options={}) {
  let session = JSON.parse(localStorage.getItem("saidan_session")||"null");
  let headers = { "Content-Type":"application/json", "apikey":SUPABASE_ANON, "Authorization":`Bearer ${session?.access_token||SUPABASE_ANON}`, ...options.headers };
  let res = await fetch(SUPABASE_URL+path, {...options, headers});
  // トークン切れなら自動更新して再試行
  if (res.status === 401 && session?.refresh_token) {
    const newSession = await refreshSession();
    if (newSession) {
      headers = { ...headers, "Authorization":`Bearer ${newSession.access_token}` };
      res = await fetch(SUPABASE_URL+path, {...options, headers});
    }
  }
  if (!res.ok) { const e=await res.text(); throw new Error(e); }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Auth helpers
async function signUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method:"POST", headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON},
    body: JSON.stringify({email,password})
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message||data.error);
  return data;
}

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:"POST", headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON},
    body: JSON.stringify({email,password})
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message||data.error);
  localStorage.setItem("saidan_session", JSON.stringify(data));
  return data;
}

async function signOut() {
  const session = JSON.parse(localStorage.getItem("saidan_session")||"null");
  if (session?.access_token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method:"POST", headers:{"Content-Type":"application/json","apikey":SUPABASE_ANON,"Authorization":`Bearer ${session.access_token}`}
    });
  }
  localStorage.removeItem("saidan_session");
}

function getSession() {
  return JSON.parse(localStorage.getItem("saidan_session")||"null");
}

// Save user data to Supabase
async function saveToCloud(userId, data) {
  // Upsert: on_conflict=user_id で既存行をUPDATE、なければINSERT
  await sbFetch("/rest/v1/user_data?on_conflict=user_id", {
    method:"POST",
    headers:{"Prefer":"resolution=merge-duplicates,return=minimal"},
    body: JSON.stringify({user_id:userId, data:JSON.stringify(data), updated_at:new Date().toISOString()})
  });
}

// Load user data from Supabase
async function loadFromCloud(userId) {
  const rows = await sbFetch(`/rest/v1/user_data?user_id=eq.${userId}&select=data`);
  if (!rows?.length) return null;
  return JSON.parse(rows[0].data);
}
const PLAN_FREE = "free";
const PLAN_PRO  = "pro";
const FREE_ALTAR_LIMIT = 1;

// ── Materials catalog（すべて無料）────────────────────────────
const MATERIALS = [
  // ── 背景 ──────────────────────────────────────────────────
  { id:"bg_static_night",  type:"bg", name:"星空",     emoji:"🌌", tier:"free", animated:false, desc:"静かな夜空",       animation:null, bg:"linear-gradient(180deg,#08061a,#0d1a4a)" },
  { id:"bg_static_pastel", type:"bg", name:"パステル", emoji:"🌸", tier:"free", animated:false, desc:"やわらかいグラデ", animation:null, bg:"linear-gradient(180deg,#fce4f0,#e0f2fe)" },
  { id:"bg_static_dark",   type:"bg", name:"ダーク",   emoji:"🖤", tier:"free", animated:false, desc:"シックな暗闇",     animation:null, bg:"linear-gradient(180deg,#09090b,#1c1917)" },
  { id:"bg_static_gold",   type:"bg", name:"ゴールド", emoji:"✨", tier:"free", animated:false, desc:"豪華な金色",       animation:null, bg:"linear-gradient(180deg,#1c1000,#3b1f00)" },
  // ── フレーム ──────────────────────────────────────────────
  { id:"fr_simple", type:"frame", name:"シンプル", emoji:"⬜", tier:"free", animated:false, desc:"細いシンプルな枠"   },
  { id:"fr_gold",   type:"frame", name:"ゴールド", emoji:"🪙", tier:"free", animated:false, desc:"クラシックな金縁"   },
  { id:"fr_torii",  type:"frame", name:"鳥居",     emoji:"⛩",  tier:"free", animated:false, desc:"和風の鳥居フレーム" },
  { id:"fr_star",   type:"frame", name:"スター",   emoji:"⭐", tier:"free", animated:false, desc:"星で飾られた枠"     },
  // ── デコ ──────────────────────────────────────────────────
  { id:"dc_rose",  type:"deco", name:"バラ",   emoji:"🌹", tier:"free", animated:false, desc:"赤いバラを添える" },
  { id:"dc_crown", type:"deco", name:"王冠",   emoji:"👑", tier:"free", animated:false, desc:"推しに王冠を"     },
  { id:"dc_heart", type:"deco", name:"ハート", emoji:"💖", tier:"free", animated:false, desc:"愛を込めて"       },
  { id:"dc_star2", type:"deco", name:"星",     emoji:"⭐", tier:"free", animated:false, desc:"きらりと輝く星"   },
  // ── てがき素材（オリジナル） ──────────────────────────────
  { id:"dc_hand_face",  type:"deco", name:"てがき顔",   emoji:"☺️", tier:"free", animated:false, desc:"手描きのにこにこ", image:"/hand-face.svg"  },
  { id:"dc_hand_star",  type:"deco", name:"てがき星",   emoji:"✨", tier:"free", animated:false, desc:"手描きのきらきら", image:"/hand-star.svg"  },
  { id:"dc_hand_heart", type:"deco", name:"てがきハート",emoji:"🩷", tier:"free", animated:false, desc:"手描きのふわはーと",image:"/hand-heart.svg" },
  // ── ライト ────────────────────────────────────────────────
  { id:"lt_spot", type:"light", name:"スポット", emoji:"🔦", tier:"free", animated:false, desc:"中央を照らす" },
  { id:"lt_warm", type:"light", name:"ウォーム", emoji:"🌟", tier:"free", animated:false, desc:"温かい光"     },
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
  { id:"trading_card", label:"トレカ",    emoji:"🃏" },
  { id:"kuji",      label:"くじ",       emoji:"🎰" },
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

// 棚素材（makeAltar の shelfStyle フィールドで指定）
const SHELF_STYLES = [
  { id:"default",    name:"デジタル",   emoji:"💜", free:true,
    plank:"linear-gradient(180deg,#3d2060,#2a1540)",
    plankBorder:"none", shadow:"0 4px 12px rgba(0,0,0,0.4)", height:8, radius:"0 0 4px 4px" },
  { id:"wood_light", name:"明るい木製", emoji:"🪵", free:true,
    plank:"linear-gradient(180deg,#c8a26a,#a0784a)",
    plankBorder:"1px solid #8b6340", shadow:"0 4px 8px rgba(0,0,0,0.35)", height:10, radius:"0 0 3px 3px",
    grain:true },
  { id:"wood_dark",  name:"ダーク木製", emoji:"🌳", free:true,
    plank:"linear-gradient(180deg,#5c3a1e,#3d2010)",
    plankBorder:"1px solid #2d1508", shadow:"0 4px 10px rgba(0,0,0,0.5)", height:10, radius:"0 0 3px 3px",
    grain:true },
  { id:"steel",      name:"スチール",   emoji:"🔩", free:true,
    plank:"linear-gradient(180deg,#7a8693,#4a555f)",
    plankBorder:"1px solid #3a4550", shadow:"0 3px 8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.15)", height:8, radius:"0 0 2px 2px" },
  { id:"glass",      name:"ガラス",     emoji:"🪟", free:false,
    plank:"linear-gradient(180deg,rgba(200,220,255,0.35),rgba(150,180,240,0.2))",
    plankBorder:"1px solid rgba(200,230,255,0.5)", shadow:"0 4px 16px rgba(100,150,255,0.2)", height:8, radius:"0 0 4px 4px",
    blur:true },
  { id:"marble",     name:"大理石",     emoji:"🏛️", free:false,
    plank:"linear-gradient(135deg,#f0ece4 0%,#d8d0c4 30%,#f0ece4 60%,#c8bfb0 100%)",
    plankBorder:"1px solid #b0a898", shadow:"0 4px 12px rgba(0,0,0,0.3)", height:12, radius:"0 0 4px 4px" },
  { id:"iron",       name:"アイアン",   emoji:"⚙️", free:false,
    plank:"linear-gradient(180deg,#2a2a2a,#1a1a1a)",
    plankBorder:"2px solid #444", shadow:"0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)", height:10, radius:"0 0 3px 3px" },
  { id:"gold_shelf", name:"ゴールド棚", emoji:"✨", free:false,
    plank:"linear-gradient(180deg,#f5c842,#c9962a)",
    plankBorder:"1px solid #a07820", shadow:"0 4px 16px rgba(200,150,0,0.4), inset 0 1px 0 rgba(255,255,255,0.3)", height:10, radius:"0 0 4px 4px" },
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
  return { id:newUid(), name, hideEmojiDecor:false, templateId:"shrine", customColors:null, altarMode:"shelf", shelfStyleId:"default", shelf:Array.from({length:SHELF_ROWS},()=>Array(SHELF_COLS).fill(null)), hinaShelf:Array.from({length:5},(_,i)=>Array(i+2).fill(null)).reverse(), showcaseShelf:Array.from({length:3},()=>Array(4).fill(null)), flatShelf:Array(8).fill(null), freeItems:[], decoItems:[], bgMaterialId:null, bgCustomColor:null, bgCustomImage:null, frameMaterialId:null, frameCustomColor:null, frameCustomImage:null, lightId:null };
}

// ─── Root ─────────────────────────────────────────────────────
export default function App() {
  const [session, setSession]       = useState(()=>getSession());
  const [showAuth, setShowAuth]     = useState(false);
  const [plan, setPlan]             = useState(PLAN_FREE);
  const [purchasedMaterials, setPurchasedMaterials] = useState([]); // array of material ids
  const [altars, setAltars]       = useState([makeAltar()]);
  const [activeAltarId, setActiveAltarId] = useState(null);
  const [goods, setGoods]         = useState([]);
  const [characters, setCharacters] = useState([]); // [{id,name,color,emoji}]
  const [randomSets, setRandomSets]   = useState([]); // ランダムセット管理
  const [page, setPage]           = useState("collection");
  const [showAdd, setShowAdd]     = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showMaterials, setShowMaterials]   = useState(false);
  const [showBgPicker,  setShowBgPicker]    = useState(false);
  const [showRandomSets, setShowRandomSets] = useState(false);
  const [showAltarManager, setShowAltarManager] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [loaded, setLoaded]       = useState(false);
  const [toast, setToast]         = useState(null);
  const [viewingShared, setViewingShared] = useState(null); // shared altar object | null
  const [showTerms, setShowTerms]     = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [splashDone, setSplashDone]   = useState(false); // splashを消すタイミング
  const saveTimer = useRef(null);

  const activeAltar = altars.find(a=>a.id===activeAltarId) || altars[0];

  // ── Load ──────────────────────────────────────────────────
  const applyData = (d) => {
    if (d.plan)       setPlan(d.plan);
    if (d.altars?.length) { setAltars(d.altars); setActiveAltarId(d.activeAltarId||d.altars[0].id); }
    if (d.goods)      setGoods(d.goods);
    if (d.characters) setCharacters(d.characters);
    if (d.purchasedMaterials) setPurchasedMaterials(d.purchasedMaterials);
    if (d.randomSets) setRandomSets(d.randomSets);
  };

  useEffect(()=>{
    (async()=>{
      const shared = decodeAltarFromURL();
      if (shared?.altar) { setViewingShared(shared.altar); setGoods(shared.goods||[]); setPage("altar"); setLoaded(true); return; }
      try {
        // Try cloud first if logged in
        const sess = getSession();
        if (sess?.user?.id) {
          const cloudData = await loadFromCloud(sess.user.id);
          // クラウドにグッズや祭壇データがある場合のみ上書き（空データで上書きしない）
          const hasCloudData = cloudData && (cloudData.goods?.length > 0 || cloudData.altars?.some(a => a.shelf?.flat().some(Boolean)));
          if (hasCloudData) { applyData(cloudData); setLoaded(true); return; }
        }
        // Fall back to local storage
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) { applyData(JSON.parse(raw)); }
        else { const a=makeAltar(); setAltars([a]); setActiveAltarId(a.id); }
      } catch { const a=makeAltar(); setAltars([a]); setActiveAltarId(a.id); }
      setLoaded(true);
    })();
  },[]);

  // ── Splash fade-out when loaded ───────────────────────────
  useEffect(()=>{ if(loaded) setTimeout(()=>setSplashDone(true), 400); },[loaded]);

  // ── Auto-save ─────────────────────────────────────────────
  const triggerSave = useCallback((plan,altars,activeAltarId,goods,characters,purchasedMaterials,randomSets)=>{
    if (!loaded) return;
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async()=>{
      try {
        const data = {plan,altars,activeAltarId,goods,characters,purchasedMaterials,randomSets};
        // Always save locally (critical — error here shows failure)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        // Also save to cloud if logged in (non-fatal — failure is silently ignored)
        const sess = getSession();
        if (sess?.user?.id) {
          try { await saveToCloud(sess.user.id, data); } catch(e) { console.error("Auto-save cloud error:", e); }
        }
        setSaveStatus("saved"); setTimeout(()=>setSaveStatus(null),2000);
      } catch { setSaveStatus("error"); setTimeout(()=>setSaveStatus(null),3000); }
    },700);
  },[loaded]);

  useEffect(()=>{ if(loaded) triggerSave(plan,altars,activeAltarId,goods,characters,purchasedMaterials,randomSets); },[plan,altars,activeAltarId,goods,characters,purchasedMaterials,randomSets,loaded]);

  const showToast = (msg)=>{ setToast(msg); setTimeout(()=>setToast(null),2200); };

  // ── Plan ──────────────────────────────────────────────────
  const upgradeToPro  = ()=>{ setPlan(PLAN_PRO); setShowUpgrade(false); showToast("🎉 PROプランにアップグレードしました！"); };
  const canUseMaterial = ()=> true; // すべて無料
  const downgradeToFree = ()=>{ setPlan(PLAN_FREE); showToast("フリープランに戻りました"); };
  const isPro     = plan===PLAN_PRO;
  const isPremium = false; // プレミアムは将来実装

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
  const addCharacter    = (c)=>{ setCharacters(prev=>[...prev,c]); showToast("推しを追加しました ✓"); };
  const deleteCharacter = (id)=>{ setCharacters(prev=>prev.filter(c=>c.id!==id)); setGoods(prev=>prev.map(g=>g.characterId===id?{...g,characterId:null}:g)); };

  // ── RandomSets CRUD ────────────────────────────────────────
  const addRandomSet    = (s)=>{ setRandomSets(prev=>[s,...prev]); showToast("ランダムセットを追加しました ✓"); };
  const updateRandomSet = (id,patch)=>setRandomSets(prev=>prev.map(s=>s.id===id?{...s,...patch}:s));
  const deleteRandomSet = (id)=>{ setRandomSets(prev=>prev.filter(s=>s.id!==id)); showToast("削除しました"); };
  const addDrawLog      = (setId, variants)=>{ // variants: [{variantId, count}]
    const now = new Date().toISOString();
    const logs = variants.map(v=>({ id:newUid(), variantId:v.variantId, count:v.count, drawnAt:now }));
    setRandomSets(prev=>prev.map(s=>{ if(s.id!==setId) return s;
      const newLogs = [...(s.drawLogs||[]), ...logs];
      // update ownedVariants
      const owned = {...(s.ownedVariants||{})};
      variants.forEach(v=>{ owned[v.variantId]=(owned[v.variantId]||0)+v.count; });
      return {...s, drawLogs:newLogs, ownedVariants:owned, totalDraws:(s.totalDraws||0)+variants.reduce((a,v)=>a+v.count,0) };
    }));
    showToast("引いた結果を記録しました 🎰");
  };

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
      {/* ─── Splash Screen ─── */}
      {!splashDone && <SplashScreen fading={loaded}/>}

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
          <span style={{ fontSize:22 }}>⛩</span>
          <div style={S.logoText}>SAIDAN</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {saveLabel && !viewingShared && <span style={{ fontSize:11, fontWeight:700, color:saveColor }}>{saveLabel}</span>}
          <button onClick={()=>isPro?downgradeToFree():setShowUpgrade(true)} style={{ padding:"4px 10px", borderRadius:20, border:`1px solid ${isPro?"#f59e0b":"rgba(255,255,255,0.15)"}`, background:isPro?"rgba(245,158,11,0.15)":"transparent", color:isPro?"#f59e0b":"#6b7280", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            {isPro?"👑":"FREE"}
          </button>
          {/* Cloud sync button (logged in only) */}
          {session && <button onClick={async()=>{
            showToast("☁ 同期中…");
            try {
              const cloudData = await loadFromCloud(session.user.id);
              if (cloudData) { applyData(cloudData); showToast("✓ 同期しました"); }
              else { showToast("クラウドにデータがありません"); }
            } catch(e) { showToast("同期エラー: "+(e?.message||String(e))); }
          }} style={{ padding:"4px 10px",borderRadius:20,border:"1px solid rgba(99,102,241,0.4)",background:"rgba(99,102,241,0.1)",color:"#818cf8",fontSize:11,fontWeight:700,cursor:"pointer" }}>
            ☁ 同期
          </button>}
          {/* Auth button */}
          <button onClick={()=>session?setShowAuth("account"):setShowAuth("login")}
            style={{ padding:"4px 10px",borderRadius:20,border:"1px solid rgba(255,255,255,0.12)",background:"transparent",color:session?"#4ade80":"#6b7280",fontSize:11,fontWeight:700,cursor:"pointer" }}>
            {session?"✓ ログイン中":"ログイン"}
          </button>
        </div>
      </header>

      {/* Bottom nav (mobile-first) */}
      <nav style={S.bottomNav}>
        {[
          ["collection","📦","コレクション"],
          ["random","🎰","ガチャ"],
          ["altar","⛩","祭壇"],
        ].map(([p,icon,label])=>(
          <button key={p} onClick={()=>setPage(p)} style={{ ...S.bottomNavBtn, ...(page===p?S.bottomNavBtnOn:{}) }}>
            <span style={{ fontSize:20 }}>{icon}</span>
            <span style={{ fontSize:10, fontWeight:page===p?700:400 }}>{label}</span>
          </button>
        ))}
      </nav>

      {page==="random"
        ? <RandomSetsPage randomSets={randomSets} isPro={isPro} onAdd={addRandomSet} onUpdate={updateRandomSet} onDelete={deleteRandomSet} onAddDrawLog={addDrawLog} />
        : page==="collection"
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
            onOpenBgPicker={()=>setShowBgPicker(true)}
            onSwitchAltar={(id)=>setActiveAltarId(id)}
            onUpgrade={()=>setShowUpgrade(true)}
            onAutoArrange={()=>{
              const owned=goods.filter(g=>g.status==="owned"||g.status==="reserved");
              if(!owned.length){showToast("持ってるグッズを登録してください");return;}
              if(currentAltar.altarMode==="hina"){
                // hinaShelf is 5 rows: widths [6,5,4,3,2] (top to bottom = wide to narrow)
                const hinaRows=[6,5,4,3,2];
                const hs=hinaRows.map(w=>Array(w).fill(null));
                let idx=0;
                for(let r=0;r<hs.length;r++) for(let c=0;c<hs[r].length;c++) { if(idx<owned.length) hs[r][c]=owned[idx++].id; }
                updateAltar(currentAltar.id,{hinaShelf:hs});
              } else if(currentAltar.altarMode==="showcase"){
                const sc=Array.from({length:3},()=>Array(4).fill(null));
                owned.slice(0,12).forEach((g,i)=>{sc[Math.floor(i/4)][i%4]=g.id;});
                updateAltar(currentAltar.id,{showcaseShelf:sc});
              } else if(currentAltar.altarMode==="flat"){
                const fl=Array(8).fill(null);
                owned.slice(0,8).forEach((g,i)=>{fl[i]=g.id;});
                updateAltar(currentAltar.id,{flatShelf:fl});
              } else if(currentAltar.altarMode==="shelf"){
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
      {showAuth && <AuthModal
        mode={showAuth}
        session={session}
        onLogin={async(sess)=>{
          setSession(sess);
          setShowAuth(false);
          showToast("データを同期中…");
          try {
            const cloudData = await loadFromCloud(sess.user.id);
            if (cloudData) {
              applyData(cloudData);
              showToast("✓ クラウドのデータを読み込みました");
            } else {
              // 初回ログイン：ローカルデータをクラウドに保存
              const data = {plan,altars,activeAltarId:altars[0]?.id,goods,characters,purchasedMaterials,randomSets};
              await saveToCloud(sess.user.id, data);
              showToast("✓ ログインしました");
            }
          } catch(e) {
            console.error("Cloud sync error:", e);
            showToast("同期エラー: " + (e?.message||String(e)));
          }
        }}
        onLogout={async()=>{
          await signOut();
          setSession(null);
          setShowAuth(false);
          // ログアウト後はローカルデータに切り替え
          try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) { applyData(JSON.parse(raw)); }
            else { const a=makeAltar(); setAltars([a]); setActiveAltarId(a.id); setGoods([]); setCharacters([]); }
          } catch { const a=makeAltar(); setAltars([a]); setActiveAltarId(a.id); }
          showToast("ログアウトしました");
        }}
        onClose={()=>setShowAuth(false)}
      />}
      {showUpgrade && <UpgradeModal onUpgrade={upgradeToPro} onClose={()=>setShowUpgrade(false)} plan={plan} />}
      {showMaterials && <MaterialsModal altar={currentAltar} onUpdateAltar={(patch)=>updateAltar(currentAltar.id,patch)} canUseMaterial={canUseMaterial} onClose={()=>setShowMaterials(false)} />}
      {showBgPicker  && <BgModal altar={currentAltar} onUpdateAltar={(patch)=>updateAltar(currentAltar.id,patch)} onClose={()=>setShowBgPicker(false)} />}
      {showAltarManager && <AltarManagerModal altars={altars} activeId={activeAltar?.id} isPro={isPro}
        onAdd={addAltar} onDelete={deleteAltar} onRename={renameAltar} onSwitch={(id)=>{setActiveAltarId(id);setShowAltarManager(false);}}
        onUpgrade={()=>{ setShowAltarManager(false); setShowUpgrade(true); }} onClose={()=>setShowAltarManager(false)} />}

      {/* ─── Footer ─── */}
      <div style={{ textAlign:"center",padding:"32px 20px 100px",fontSize:11,color:"#374151" }}>
        <div style={{ display:"flex",justifyContent:"center",gap:16,marginBottom:8 }}>
          <button onClick={()=>setShowTerms(true)} style={{ background:"none",border:"none",color:"#6b7280",fontSize:11,cursor:"pointer",textDecoration:"underline",padding:0 }}>利用規約</button>
          <button onClick={()=>setShowPrivacy(true)} style={{ background:"none",border:"none",color:"#6b7280",fontSize:11,cursor:"pointer",textDecoration:"underline",padding:0 }}>プライバシーポリシー</button>
          <a href="https://x.com/SAIDANdayo" target="_blank" rel="noreferrer" style={{ color:"#6b7280",fontSize:11,textDecoration:"none" }}>𝕏 @SAIDANdayo</a>
        </div>
        <div style={{ color:"#4b5563",fontSize:10 }}>© 2026 SAIDAN</div>
      </div>

      {showTerms   && <TermsModal   onClose={()=>setShowTerms(false)}/>}
      {showPrivacy && <PrivacyModal onClose={()=>setShowPrivacy(false)}/>}
    </div>
  );
}

// ─── Collection Page ──────────────────────────────────────────
// ─── Random Sets Page ─────────────────────────────────────────
function RandomSetsPage({ randomSets, isPro, onAdd, onUpdate, onDelete, onAddDrawLog }) {
  const [showAddSet, setShowAddSet]     = useState(false);
  const [activeSet, setActiveSet]       = useState(null);
  const [showDrawModal, setShowDrawModal] = useState(null); // setId
  const [confirmDelete, setConfirmDelete] = useState(null);

  const totalDraws  = randomSets.reduce((a,s)=>a+(s.totalDraws||0),0);
  const totalSets   = randomSets.length;
  const completedSets = randomSets.filter(s=>{
    if (!s.variants?.length) return false;
    return s.variants.every(v=>(s.ownedVariants?.[v.id]||0)>=1);
  }).length;

  return (
    <main style={S.main}>
      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:16 }}>
        {[{label:"セット数",val:totalSets,color:"#e879f9"},{label:"総引き回数",val:totalDraws,color:"#f59e0b"},{label:"コンプリート",val:completedSets,color:"#22c55e"}].map(s=>(
          <div key={s.label} style={S.statCard}><div style={{ fontSize:22,fontWeight:900,color:s.color }}>{s.val}</div><div style={{ fontSize:10,color:"#7c6a9a",marginTop:2 }}>{s.label}</div></div>
        ))}
      </div>

      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
        <div style={{ fontSize:13,color:"#7c6a9a" }}>トレカ・缶バッジ・くじなどのランダム系グッズを管理</div>
        <button onClick={()=>setShowAddSet(true)} style={S.addBtn}>＋ セット追加</button>
      </div>

      {randomSets.length===0 ? (
        <div style={S.emptyState}>
          <div style={{ fontSize:52,marginBottom:10 }}>🎰</div>
          <div style={{ fontSize:15,fontWeight:700,marginBottom:6 }}>まだセットがありません</div>
          <div style={{ fontSize:12,opacity:0.5 }}>「＋ セット追加」からトレカやくじを登録しよう</div>
        </div>
      ) : (
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {randomSets.map(s=>(
            <RandomSetCard key={s.id} set={s} isPro={isPro}
              isActive={activeSet===s.id}
              onToggle={()=>setActiveSet(activeSet===s.id?null:s.id)}
              onDraw={()=>setShowDrawModal(s.id)}
              onDelete={()=>setConfirmDelete(s.id)}
              onUpdate={(patch)=>onUpdate(s.id,patch)}
            />
          ))}
        </div>
      )}

      {showAddSet && <AddRandomSetModal onClose={()=>setShowAddSet(false)} onAdd={onAdd} />}
      {showDrawModal && <DrawModal set={randomSets.find(s=>s.id===showDrawModal)} onClose={()=>setShowDrawModal(null)} onRecord={(variants)=>{ onAddDrawLog(showDrawModal,variants); setShowDrawModal(null); }} />}
      {confirmDelete && (
        <div style={S.overlay} onClick={()=>setConfirmDelete(null)}>
          <div style={S.confirmBox} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:17,fontWeight:800,marginBottom:6 }}>セットを削除しますか？</div>
            <div style={{ fontSize:12,opacity:0.5,marginBottom:20 }}>引いた履歴もすべて削除されます</div>
            <div style={{ display:"flex",gap:10,justifyContent:"center" }}>
              <button onClick={()=>setConfirmDelete(null)} style={S.btnGhost}>キャンセル</button>
              <button onClick={()=>{onDelete(confirmDelete);setConfirmDelete(null);}} style={S.btnDanger}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Random Set Card ──────────────────────────────────────────
function RandomSetCard({ set, isPro, isActive, onToggle, onDraw, onDelete, onUpdate }) {
  const variants      = set.variants || [];
  const owned         = set.ownedVariants || {};
  const wantedIds     = set.wantedIds || [];    // 欲しい弾のID配列
  const surplusMap    = set.surplusMap || {};   // {variantId: 交換に出せる枚数}
  const tradeHistory  = set.tradeHistory || []; // [{id,date,givenId,receivedId,partner,memo}]
  const total         = variants.length;
  const gotCount      = variants.filter(v=>(owned[v.id]||0)>=1).length;
  const pct           = total>0 ? Math.round(gotCount/total*100) : 0;
  const isComplete    = total>0 && gotCount===total;
  const logs          = set.drawLogs || [];
  const recentLogs    = [...logs].reverse().slice(0,20);
  const [innerTab, setInnerTab] = useState("variants"); // "variants"|"history"|"trade"
  const [showTradeAdd, setShowTradeAdd] = useState(false);

  const logsByDate = recentLogs.reduce((acc,l)=>{ const d=l.drawnAt?.slice(0,10)||"不明"; if(!acc[d])acc[d]=[]; acc[d].push(l); return acc; },{});
  const RAND_TYPE_LABELS = { trading_card:"🃏 トレカ", badge_random:"🔵 缶バッジ", kuji:"🎰 くじ", other:"📦 その他" };
  const RARITY_COLOR = { N:"#9ca3af",R:"#60a5fa",SR:"#a78bfa",SSR:"#f59e0b",SP:"#f472b6",SEC:"#ef4444" };

  const surplusTotal  = Object.values(surplusMap).reduce((a,b)=>a+b,0);
  const wantedCount   = wantedIds.length;

  // 交換シェアテキスト生成
  const generateShareText = () => {
    const surplusLines = Object.entries(surplusMap)
      .filter(([,n])=>n>0)
      .map(([id,n])=>{ const v=variants.find(v=>v.id===id); return `　${v?.name||"?"} ×${n}`; }).join("\n");
    const wantedLines = wantedIds
      .map(id=>{ const v=variants.find(v=>v.id===id); return `　${v?.name||"?"}`; }).join("\n");
    const tags = ["#SAIDAN交換", set.series?`#${set.series}交換`:""].filter(Boolean).join(" ");
    return [
      `【交換希望】${set.name}`,
      surplusLines ? `🔵 お渡しできます\n${surplusLines}` : "",
      wantedLines  ? `💖 欲しい\n${wantedLines}` : "",
      tags,
    ].filter(Boolean).join("\n");
  };

  const copyShareText = () => {
    navigator.clipboard.writeText(generateShareText())
      .then(()=>alert("コピーしました！Xに貼り付けて投稿しよう 🎉"));
  };

  const toggleWanted   = (vid) => onUpdate({ wantedIds: wantedIds.includes(vid)?wantedIds.filter(i=>i!==vid):[...wantedIds,vid] });
  const setSurplus     = (vid, val) => onUpdate({ surplusMap: {...surplusMap,[vid]:Math.max(0,val)} });
  const addTrade       = (trade) => onUpdate({ tradeHistory:[...tradeHistory,{id:newUid(),date:new Date().toISOString().slice(0,10),...trade}] });
  const deleteTrade    = (tid) => onUpdate({ tradeHistory:tradeHistory.filter(t=>t.id!==tid) });

  return (
    <div style={{ background:"rgba(255,255,255,0.04)",borderRadius:16,border:`1px solid ${isComplete?"rgba(34,197,94,0.4)":"rgba(255,255,255,0.07)"}`,overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"14px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer" }} onClick={onToggle}>
        <div style={{ fontSize:32 }}>{set.emoji||"🎰"}</div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8,flexWrap:"wrap" }}>
            <span style={{ fontSize:14,fontWeight:800,color:"#f0e8ff" }}>{set.name}</span>
            {isComplete && <span style={{ fontSize:10,background:"rgba(34,197,94,0.2)",color:"#22c55e",borderRadius:10,padding:"1px 8px",fontWeight:700 }}>🎉 コンプリート！</span>}
            <span style={{ fontSize:10,color:"#7c6a9a",background:"rgba(255,255,255,0.05)",borderRadius:8,padding:"1px 6px" }}>{RAND_TYPE_LABELS[set.randType]||"🎰 ランダム"}</span>
          </div>
          {set.series && <div style={{ fontSize:11,color:"#818cf8",marginTop:1 }}>{set.series}</div>}
          {total>0 && (
            <div style={{ marginTop:6 }}>
              <div style={{ display:"flex",justifyContent:"space-between",fontSize:10,color:"#7c6a9a",marginBottom:3 }}>
                <span>コンプリート {gotCount}/{total}種</span>
                <span style={{ display:"flex",gap:10 }}>
                  {surplusTotal>0&&<span style={{ color:"#60a5fa" }}>🔵 余剰 {surplusTotal}枚</span>}
                  {wantedCount>0&&<span style={{ color:"#f472b6" }}>💖 欲しい {wantedCount}種</span>}
                  <span>{pct}%</span>
                </span>
              </div>
              <div style={{ height:4,background:"rgba(255,255,255,0.08)",borderRadius:4,overflow:"hidden" }}>
                <div style={{ height:"100%",width:`${pct}%`,background:isComplete?"#22c55e":"linear-gradient(90deg,#e879f9,#818cf8)",borderRadius:4,transition:"width 0.5s" }}/>
              </div>
            </div>
          )}
          <div style={{ fontSize:10,color:"#6b7280",marginTop:3 }}>累計 {set.totalDraws||0} 回 · 交換 {tradeHistory.length} 件</div>
        </div>
        <div style={{ display:"flex",gap:6,alignItems:"center",flexShrink:0 }}>
          <button onClick={e=>{e.stopPropagation();onDraw();}} style={{ padding:"6px 12px",borderRadius:20,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer" }}>🎰 記録</button>
          <button onClick={e=>{e.stopPropagation();onDelete();}} style={{ ...S.iconBtn,color:"#ef4444" }}>🗑</button>
          <span style={{ color:"#6b7280",fontSize:12 }}>{isActive?"▲":"▼"}</span>
        </div>
      </div>

      {/* Expanded */}
      {isActive && (
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)",padding:"0 16px 16px" }}>
          {/* Inner tabs */}
          <div style={{ display:"flex",gap:6,marginTop:12,marginBottom:14 }}>
            {[["variants",`🃏 全種 (${total})`],["trade",`🔄 交換管理${surplusTotal>0||wantedCount>0?" ●":""}`],["history",`📋 履歴 (${logs.length})`]].map(([t,l])=>(
              <button key={t} onClick={()=>setInnerTab(t)} style={{ padding:"5px 12px",borderRadius:20,border:`1px solid ${innerTab===t?"rgba(232,121,249,0.4)":"rgba(255,255,255,0.08)"}`,background:innerTab===t?"rgba(232,121,249,0.15)":"transparent",color:innerTab===t?"#e879f9":"#9ca3af",fontSize:11,fontWeight:700,cursor:"pointer" }}>{l}</button>
            ))}
          </div>

          {/* ── Variants tab ── */}
          {innerTab==="variants" && variants.length>0 && (
            <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:6 }}>
              {variants.map(v=>{
                const cnt     = owned[v.id]||0;
                const got     = cnt>=1;
                const surplus = surplusMap[v.id]||0;
                const wanted  = wantedIds.includes(v.id);
                return (
                  <div key={v.id} style={{ background:got?"rgba(34,197,94,0.08)":"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 6px",textAlign:"center",border:`1px solid ${wanted?"rgba(244,114,182,0.5)":got?"rgba(34,197,94,0.25)":"rgba(255,255,255,0.06)"}`,position:"relative" }}>
                    {cnt>1 && <div style={{ position:"absolute",top:3,right:3,fontSize:9,background:"rgba(96,165,250,0.3)",color:"#60a5fa",borderRadius:6,padding:"1px 4px",fontWeight:700 }}>×{cnt}</div>}
                    {surplus>0 && <div style={{ position:"absolute",top:3,left:3,fontSize:9,background:"rgba(96,165,250,0.2)",color:"#60a5fa",borderRadius:6,padding:"1px 4px",fontWeight:700 }}>↔{surplus}</div>}
                    <div style={{ color:wanted?"#f472b6":got?"#22c55e":"#6b7280",fontWeight:got?700:400,fontSize:11,marginBottom:2 }}>
                      {wanted?"💖 ":got?"✓ ":"　"}{v.name}
                    </div>
                    {v.rarity && <div style={{ fontSize:9,color:RARITY_COLOR[v.rarity]||"#6b7280",fontWeight:700 }}>{v.rarity}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Trade tab ── */}
          {innerTab==="trade" && (
            <div>
              {/* Surplus manager */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12,fontWeight:700,color:"#60a5fa",marginBottom:8 }}>🔵 余剰管理（交換に出せるもの）</div>
                <div style={{ display:"flex",flexDirection:"column",gap:5 }}>
                  {variants.filter(v=>(owned[v.id]||0)>=2||(surplusMap[v.id]||0)>0).length===0 && (
                    <div style={{ fontSize:11,color:"#4b5563",padding:"8px 0" }}>2枚以上引いた弾がここに表示されます</div>
                  )}
                  {variants.filter(v=>(owned[v.id]||0)>=2||(surplusMap[v.id]||0)>0).map(v=>{
                    const cnt     = owned[v.id]||0;
                    const surplus = surplusMap[v.id]||0;
                    const maxSurplus = Math.max(0, cnt-1);
                    return (
                      <div key={v.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"rgba(96,165,250,0.06)",borderRadius:10,border:"1px solid rgba(96,165,250,0.15)" }}>
                        <div style={{ flex:1,fontSize:12,color:"#d1d5db" }}>
                          {v.name}
                          {v.rarity&&<span style={{ fontSize:10,color:RARITY_COLOR[v.rarity]||"#6b7280",marginLeft:6 }}>{v.rarity}</span>}
                          <span style={{ fontSize:10,color:"#6b7280",marginLeft:6 }}>所持×{cnt}</span>
                        </div>
                        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                          <span style={{ fontSize:11,color:"#9ca3af" }}>交換に出す:</span>
                          <button onClick={()=>setSurplus(v.id,surplus-1)} style={{ width:22,height:22,borderRadius:"50%",border:"none",background:"rgba(255,255,255,0.08)",color:"#f0e8ff",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700 }}>−</button>
                          <span style={{ width:20,textAlign:"center",fontSize:13,fontWeight:700,color:surplus>0?"#60a5fa":"#6b7280" }}>{surplus}</span>
                          <button onClick={()=>setSurplus(v.id,Math.min(surplus+1,maxSurplus))} style={{ width:22,height:22,borderRadius:"50%",border:"none",background:"rgba(96,165,250,0.2)",color:"#60a5fa",fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700 }}>＋</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Wanted manager */}
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12,fontWeight:700,color:"#f472b6",marginBottom:8 }}>💖 欲しいリスト（未所持 or 欲しい弾）</div>
                <div style={{ display:"flex",flexWrap:"wrap",gap:6 }}>
                  {variants.filter(v=>(owned[v.id]||0)===0||(owned[v.id]||0)>=1).map(v=>{
                    const wanted = wantedIds.includes(v.id);
                    const got    = (owned[v.id]||0)>=1;
                    if (got && !wanted) return null; // 持ってて欲しくないものは非表示（チェック済みのみ）
                    return (
                      <button key={v.id} onClick={()=>toggleWanted(v.id)}
                        style={{ padding:"5px 12px",borderRadius:20,border:`1px solid ${wanted?"rgba(244,114,182,0.6)":"rgba(255,255,255,0.1)"}`,background:wanted?"rgba(244,114,182,0.15)":"transparent",color:wanted?"#f472b6":"#9ca3af",fontSize:11,fontWeight:wanted?700:400,cursor:"pointer",transition:"all 0.15s" }}>
                        {wanted?"💖":"○"} {v.name}{v.rarity?` (${v.rarity})`:""}
                      </button>
                    );
                  })}
                  {variants.filter(v=>(owned[v.id]||0)===0).length===0&&wantedIds.length===0&&(
                    <div style={{ fontSize:11,color:"#4b5563" }}>未所持の弾をタップして欲しいリストに追加</div>
                  )}
                </div>
                {/* Show all variants for wanted toggle */}
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:10,color:"#6b7280",marginBottom:6 }}>未所持の弾:</div>
                  <div style={{ display:"flex",flexWrap:"wrap",gap:5 }}>
                    {variants.filter(v=>(owned[v.id]||0)===0).map(v=>{
                      const wanted=wantedIds.includes(v.id);
                      return (
                        <button key={v.id} onClick={()=>toggleWanted(v.id)}
                          style={{ padding:"4px 10px",borderRadius:20,border:`1px solid ${wanted?"rgba(244,114,182,0.5)":"rgba(255,255,255,0.08)"}`,background:wanted?"rgba(244,114,182,0.12)":"transparent",color:wanted?"#f472b6":"#6b7280",fontSize:10,cursor:"pointer" }}>
                          {wanted?"💖 ":""}{v.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Share button */}
              {(surplusTotal>0||wantedCount>0) && (
                <button onClick={copyShareText} style={{ width:"100%",padding:"10px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#1d9bf0,#818cf8)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",marginBottom:14 }}>
                  𝕏 交換希望をXにシェア
                </button>
              )}

              {/* Trade history (PRO) */}
              <div>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:"#c084fc" }}>📒 交換履歴 {isPro?"":"（PRO機能）"}</div>
                  {isPro && <button onClick={()=>setShowTradeAdd(true)} style={{ fontSize:11,color:"#e879f9",background:"rgba(232,121,249,0.1)",border:"1px solid rgba(232,121,249,0.2)",borderRadius:8,padding:"3px 10px",cursor:"pointer" }}>＋ 記録</button>}
                </div>
                {!isPro ? (
                  <div style={{ fontSize:11,color:"#4b5563",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:8,padding:"10px 12px" }}>
                    PROプランで誰と何を交換したかを記録できます
                  </div>
                ) : tradeHistory.length===0 ? (
                  <div style={{ fontSize:11,color:"#4b5563",padding:"8px 0" }}>まだ交換履歴がありません</div>
                ) : (
                  <div style={{ display:"flex",flexDirection:"column",gap:5,maxHeight:180,overflowY:"auto" }}>
                    {[...tradeHistory].reverse().map(t=>{
                      const given    = variants.find(v=>v.id===t.givenId);
                      const received = variants.find(v=>v.id===t.receivedId);
                      return (
                        <div key={t.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8 }}>
                          <span style={{ fontSize:10,color:"#6b7280",whiteSpace:"nowrap" }}>{t.date}</span>
                          <span style={{ fontSize:12,flex:1,color:"#d1d5db" }}>
                            <span style={{ color:"#60a5fa" }}>{given?.name||"?"}</span>
                            <span style={{ color:"#6b7280",margin:"0 4px" }}>→</span>
                            <span style={{ color:"#f472b6" }}>{received?.name||"?"}</span>
                            {t.partner&&<span style={{ color:"#9ca3af",marginLeft:6 }}>@{t.partner}</span>}
                          </span>
                          <button onClick={()=>deleteTrade(t.id)} style={{ background:"none",border:"none",color:"#4b5563",cursor:"pointer",fontSize:12 }}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── History tab ── */}
          {innerTab==="history" && (
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:"#c084fc",marginBottom:8 }}>📋 引いた履歴（全件）</div>
              {logs.length===0 ? (
                <div style={{ fontSize:12,color:"#4b5563",textAlign:"center",padding:"16px 0" }}>まだ記録がありません</div>
              ) : (
                <div style={{ maxHeight:260,overflowY:"auto",display:"flex",flexDirection:"column",gap:4 }}>
                  {Object.entries(logsByDate).map(([date,dayLogs])=>(
                    <div key={date}>
                      <div style={{ fontSize:10,color:"#6b7280",fontWeight:600,marginBottom:4,marginTop:6 }}>📅 {date}</div>
                      {dayLogs.map(l=>{
                        const v=variants.find(v=>v.id===l.variantId);
                        return (
                          <div key={l.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 10px",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:2 }}>
                            <span style={{ fontSize:13 }}>🎰</span>
                            <span style={{ flex:1,fontSize:12,color:"#d1d5db" }}>{v?.name||"不明"}</span>
                            {l.count>1&&<span style={{ fontSize:11,color:"#60a5fa",fontWeight:700 }}>×{l.count}</span>}
                            {v?.rarity&&<span style={{ fontSize:10,color:RARITY_COLOR[v.rarity]||"#6b7280",fontWeight:700 }}>{v.rarity}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trade add modal */}
      {showTradeAdd && (
        <TradeAddModal variants={variants} onClose={()=>setShowTradeAdd(false)} onAdd={(t)=>{ addTrade(t); setShowTradeAdd(false); }} />
      )}
    </div>
  );
}

// ─── Trade Add Modal ──────────────────────────────────────────
function TradeAddModal({ variants, onClose, onAdd }) {
  const [givenId,setGivenId]       = useState(variants[0]?.id||"");
  const [receivedId,setReceivedId] = useState(variants[0]?.id||"");
  const [partner,setPartner]       = useState("");
  const [memo,setMemo]             = useState("");
  const submit = () => { if(!givenId||!receivedId) return; onAdd({givenId,receivedId,partner:partner.trim(),memo:memo.trim()}); };
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:380 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:16,fontWeight:800,color:"#e879f9" }}>🔄 交換を記録</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>渡した弾（自分→相手）</label>
          <select value={givenId} onChange={e=>setGivenId(e.target.value)} style={{ ...S.input,cursor:"pointer" }}>
            {variants.map(v=><option key={v.id} value={v.id}>{v.name}{v.rarity?` (${v.rarity})`:""}</option>)}
          </select>
        </div>
        <div style={{ textAlign:"center",fontSize:18,margin:"4px 0",color:"#6b7280" }}>⇄</div>
        <div style={S.fieldGroup}>
          <label style={S.label}>もらった弾（相手→自分）</label>
          <select value={receivedId} onChange={e=>setReceivedId(e.target.value)} style={{ ...S.input,cursor:"pointer" }}>
            {variants.map(v=><option key={v.id} value={v.id}>{v.name}{v.rarity?` (${v.rarity})`:""}</option>)}
          </select>
        </div>
        <div style={S.fieldGroup}><label style={S.label}>相手のXID（任意）</label><input value={partner} onChange={e=>setPartner(e.target.value)} placeholder="@username" style={S.input} maxLength={50}/></div>
        <div style={S.fieldGroup}><label style={S.label}>メモ（任意）</label><input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="オフ会、DM交換など" style={S.input} maxLength={60}/></div>
        <button onClick={submit} style={{ width:"100%",padding:"11px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer" }}>記録する</button>
      </div>
    </div>
  );
}

// ─── Add Random Set Modal ─────────────────────────────────────
function AddRandomSetModal({ onClose, onAdd }) {
  const [name,setName]       = useState("");
  const [series,setSeries]   = useState("");
  const [randType,setRandType] = useState("trading_card");
  const [emoji,setEmoji]     = useState("🎰");
  const [variants,setVariants] = useState([{id:newUid(),name:"",rarity:""}]);
  const [error,setError]     = useState("");

  const RAND_TYPES = [
    {id:"trading_card",label:"🃏 トレカ"},
    {id:"badge_random",label:"🔵 缶バッジ"},
    {id:"kuji",        label:"🎰 くじ"},
    {id:"other",       label:"📦 その他"},
  ];
  const EMOJIS = ["🎰","🃏","🔵","🎪","⭐","💎","🌸","🎀","🔥","👑"];
  const RARITIES = ["","N","R","SR","SSR","SP","SEC","1等","2等","3等","ラスト1"];

  const addVariant    = ()=>setVariants(prev=>[...prev,{id:newUid(),name:"",rarity:""}]);
  const removeVariant = (id)=>setVariants(prev=>prev.filter(v=>v.id!==id));
  const updateVariant = (id,field,val)=>setVariants(prev=>prev.map(v=>v.id===id?{...v,[field]:val}:v));

  const submit = ()=>{
    if (!name.trim()){setError("セット名を入力してください");return;}
    const filled = variants.filter(v=>v.name.trim());
    if (!filled.length){setError("弾・種類を最低1つ入力してください");return;}
    onAdd({ id:newUid(), name:name.trim(), series:series.trim(), randType, emoji, variants:filled.map(v=>({...v,name:v.name.trim()})), ownedVariants:{}, drawLogs:[], totalDraws:0, createdAt:new Date().toISOString() });
    onClose();
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:480 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:18,fontWeight:800,color:"#e879f9" }}>🎰 ランダムセットを追加</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>

        {/* Type */}
        <div style={S.fieldGroup}>
          <label style={S.label}>種類</label>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {RAND_TYPES.map(t=>(
              <button key={t.id} onClick={()=>setRandType(t.id)} style={{ padding:"6px 12px",borderRadius:20,border:`1px solid ${randType===t.id?"rgba(232,121,249,0.5)":"rgba(255,255,255,0.1)"}`,background:randType===t.id?"rgba(232,121,249,0.15)":"transparent",color:randType===t.id?"#e879f9":"#9ca3af",fontSize:12,fontWeight:600,cursor:"pointer" }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* Emoji */}
        <div style={S.fieldGroup}>
          <label style={S.label}>アイコン</label>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            {EMOJIS.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{ fontSize:22,width:38,height:38,borderRadius:8,border:`2px solid ${emoji===e?"#e879f9":"transparent"}`,background:"rgba(255,255,255,0.05)",cursor:"pointer" }}>{e}</button>)}
          </div>
        </div>

        <div style={S.fieldGroup}><label style={S.label}>セット名 *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="例: 月ノ美兎 トレーディングカード vol.2" style={S.input} maxLength={60}/></div>
        <div style={S.fieldGroup}><label style={S.label}>シリーズ</label><input value={series} onChange={e=>setSeries(e.target.value)} placeholder="例: にじさんじ" style={S.input} maxLength={40}/></div>

        {/* Variants */}
        <div style={S.fieldGroup}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
            <label style={{ ...S.label,marginBottom:0 }}>弾・種類一覧（全種を登録）</label>
            <button onClick={addVariant} style={{ fontSize:11,color:"#e879f9",background:"rgba(232,121,249,0.1)",border:"1px solid rgba(232,121,249,0.2)",borderRadius:8,padding:"3px 10px",cursor:"pointer" }}>＋ 追加</button>
          </div>
          <div style={{ maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:6 }}>
            {variants.map((v,i)=>(
              <div key={v.id} style={{ display:"flex",gap:6,alignItems:"center" }}>
                <span style={{ fontSize:11,color:"#6b7280",width:20,textAlign:"right",flexShrink:0 }}>{i+1}</span>
                <input value={v.name} onChange={e=>updateVariant(v.id,"name",e.target.value)} placeholder={`例: Aホロ / ${i+1}番`} style={{ ...S.input,flex:2,padding:"6px 10px",fontSize:12 }} maxLength={40}/>
                <select value={v.rarity} onChange={e=>updateVariant(v.id,"rarity",e.target.value)} style={{ ...S.input,flex:1,padding:"6px 8px",fontSize:11,cursor:"pointer" }}>
                  {RARITIES.map(r=><option key={r} value={r}>{r||"レアリティ"}</option>)}
                </select>
                {variants.length>1 && <button onClick={()=>removeVariant(v.id)} style={{ background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:14,flexShrink:0 }}>✕</button>}
              </div>
            ))}
          </div>
        </div>

        {error && <div style={{ color:"#f87171",fontSize:12,marginBottom:10,fontWeight:600 }}>{error}</div>}
        <button onClick={submit} style={{ width:"100%",padding:"12px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer" }}>追加する</button>
      </div>
    </div>
  );
}

// ─── Draw Modal ───────────────────────────────────────────────
function DrawModal({ set, onClose, onRecord }) {
  const variants = set?.variants||[];
  // counts per variant for this draw session
  const [counts, setCounts] = useState(()=>Object.fromEntries(variants.map(v=>[v.id,0])));
  const [quickMode, setQuickMode] = useState(false); // quick: single click = +1

  const setCount = (id,val)=>setCounts(prev=>({...prev,[id]:Math.max(0,val)}));
  const total = Object.values(counts).reduce((a,b)=>a+b,0);

  const submit = ()=>{
    const result = Object.entries(counts).filter(([,c])=>c>0).map(([variantId,count])=>({variantId,count}));
    if (!result.length){ alert("1つ以上記録してください"); return; }
    onRecord(result);
  };

  const RARITY_COLOR = { N:"#9ca3af", R:"#60a5fa", SR:"#a78bfa", SSR:"#f59e0b", SP:"#f472b6", SEC:"#ef4444" };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:460 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
          <div style={{ fontSize:18,fontWeight:800,color:"#e879f9" }}>🎰 引いた結果を記録</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ fontSize:12,color:"#7c6a9a",marginBottom:14 }}>{set?.name}</div>

        {/* Quick mode toggle */}
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"8px 12px",background:"rgba(255,255,255,0.03)",borderRadius:10 }}>
          <span style={{ fontSize:12,color:"#9ca3af",flex:1 }}>クイックモード（タップで＋1）</span>
          <button onClick={()=>setQuickMode(q=>!q)} style={{ width:42,height:24,borderRadius:12,border:"none",background:quickMode?"#e879f9":"rgba(255,255,255,0.1)",cursor:"pointer",position:"relative",transition:"background 0.2s" }}>
            <div style={{ width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:quickMode?21:3,transition:"left 0.2s" }}/>
          </button>
        </div>

        <div style={{ maxHeight:300,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,marginBottom:14 }}>
          {variants.map(v=>{
            const cnt = counts[v.id]||0;
            return (
              <div key={v.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:cnt>0?"rgba(232,121,249,0.08)":"rgba(255,255,255,0.03)",borderRadius:10,border:`1px solid ${cnt>0?"rgba(232,121,249,0.2)":"rgba(255,255,255,0.05)"}`,cursor:quickMode?"pointer":"default",transition:"all 0.15s" }}
                onClick={()=>quickMode&&setCount(v.id,cnt+1)}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13,fontWeight:cnt>0?700:400,color:cnt>0?"#f0e8ff":"#9ca3af" }}>{v.name}</div>
                  {v.rarity && <div style={{ fontSize:10,color:RARITY_COLOR[v.rarity]||"#6b7280",fontWeight:700 }}>{v.rarity}</div>}
                </div>
                {!quickMode && (
                  <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                    <button onClick={()=>setCount(v.id,cnt-1)} style={{ width:24,height:24,borderRadius:"50%",border:"none",background:"rgba(255,255,255,0.08)",color:"#f0e8ff",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700 }}>−</button>
                    <span style={{ width:24,textAlign:"center",fontSize:13,fontWeight:700,color:cnt>0?"#e879f9":"#6b7280" }}>{cnt}</span>
                    <button onClick={()=>setCount(v.id,cnt+1)} style={{ width:24,height:24,borderRadius:"50%",border:"none",background:"rgba(232,121,249,0.2)",color:"#e879f9",fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700 }}>＋</button>
                  </div>
                )}
                {quickMode && cnt>0 && <span style={{ fontSize:16,fontWeight:900,color:"#e879f9",minWidth:24,textAlign:"center" }}>×{cnt}</span>}
              </div>
            );
          })}
        </div>

        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12 }}>
          <span style={{ fontSize:12,color:"#7c6a9a" }}>今回の合計: <strong style={{ color:"#e879f9" }}>{total}枚</strong></span>
          <button onClick={()=>setCounts(Object.fromEntries(variants.map(v=>[v.id,0])))} style={{ fontSize:11,color:"#6b7280",background:"none",border:"none",cursor:"pointer" }}>リセット</button>
        </div>

        <button onClick={submit} disabled={total===0} style={{ width:"100%",padding:"12px",borderRadius:14,border:"none",background:total>0?"linear-gradient(135deg,#e879f9,#818cf8)":"rgba(255,255,255,0.08)",color:total>0?"#fff":"#6b7280",fontSize:15,fontWeight:800,cursor:total>0?"pointer":"default" }}>
          {total>0?`${total}枚を記録する`:"引いた枚数を入力してください"}
        </button>
      </div>
    </div>
  );
}

function CollectionPage({ goods, counts, characters, isPro, onAdd, onUpdateStatus, onDelete, onUpdateChar, onAddCharacter, onDeleteCharacter, onUpgrade, loaded }) {
  const [filter, setFilter]           = useState("all");
  const [typeFilter, setTypeFilter]   = useState("all");
  const [charFilter, setCharFilter]   = useState(null);
  const [displayMode, setDisplayMode] = useState("grouped"); // "grouped" | "all"
  const [showCharManager, setShowCharManager] = useState(false);
  const [confirmId, setConfirmId]     = useState(null);

  let visible = goods.filter(g=>filter==="all"||g.status===filter);
  if (typeFilter!=="all") visible = visible.filter(g=>(g.goodType||"other")===typeFilter);
  if (charFilter) visible = visible.filter(g=>g.characterId===charFilter);

  // grouped mode: merge goods with same name+series into one card with count
  const grouped = displayMode==="grouped"
    ? Object.values(visible.reduce((acc,g)=>{
        const key = `${g.name}__${g.series||""}__${g.status}`;
        if (!acc[key]) acc[key]={ ...g, _count:1, _ids:[g.id] };
        else { acc[key]._count++; acc[key]._ids.push(g.id); }
        return acc;
      },{}))
    : visible;

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
          <button onClick={()=>setCharFilter(null)} style={{ ...S.filterBtn, ...(charFilter===null?S.filterBtnOn:{}) }}>🌟 全員</button>
          {characters.map(c=>(
            <button key={c.id} onClick={()=>setCharFilter(charFilter===c.id?null:c.id)}
              style={{ ...S.filterBtn, ...(charFilter===c.id?{ background:`${c.color}22`, color:c.color, border:`1px solid ${c.color}66` }:{}) }}>
              {c.emoji} {c.name}
            </button>
          ))}
          <button onClick={()=>setShowCharManager(true)} style={{ ...S.filterBtn, border:"1px dashed rgba(232,121,249,0.3)", color:"#7c6a9a" }}>＋ 推しを追加</button>
        </div>
      )}
      {!isPro && (
        <div style={{ marginBottom:12, padding:"10px 14px", background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontSize:12, color:"#fbbf24" }}>👑 PROプランで推し別フォルダ管理が使えます</span>
          <button onClick={onUpgrade} style={{ fontSize:11, fontWeight:700, color:"#f59e0b", background:"rgba(245,158,11,0.15)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:10, padding:"3px 10px", cursor:"pointer" }}>アップグレード</button>
        </div>
      )}

      <div style={S.toolbar}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[["all","すべて"],["owned","持ってる"],["reserved","予約済み"],["wanted","欲しい"]].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)} style={{ ...S.filterBtn, ...(filter===v?S.filterBtnOn:{}) }}>{l}</button>
          ))}
        </div>
        <div style={{ display:"flex",gap:6,alignItems:"center" }}>
          {/* Display mode toggle */}
          <div style={{ display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:20,padding:2,border:"1px solid rgba(255,255,255,0.08)" }}>
            {[["grouped","まとめ表示","⊞"],["all","全て表示","⊟"]].map(([m,l,icon])=>(
              <button key={m} onClick={()=>setDisplayMode(m)} title={l} style={{ padding:"4px 12px",borderRadius:18,border:"none",background:displayMode===m?"rgba(232,121,249,0.25)":"transparent",color:displayMode===m?"#e879f9":"#6b7280",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.15s",whiteSpace:"nowrap" }}>{icon} {l}</button>
            ))}
          </div>
          <button onClick={onAdd} style={S.addBtn}>＋ グッズ追加</button>
        </div>
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
          {grouped.map(g=><GoodCard key={g._ids?g._ids[0]:g.id} good={g} count={g._count||1} characters={characters} isPro={isPro}
            onStatusChange={s=>{ if(g._ids) g._ids.forEach(id=>onUpdateStatus(id,s)); else onUpdateStatus(g.id,s); }}
            onDelete={()=>setConfirmId(g._ids?g._ids[0]:g.id)}
            onCharChange={cid=>onUpdateChar(g._ids?g._ids[0]:g.id,cid)} />)}
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

function GoodDetailModal({ good, onClose }) {
  const [rotation,setRotation]=useState(0);
  const [zoom,setZoom]=useState(1);
  return (
    <div style={{ ...S.overlay,zIndex:3000 }} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:360,padding:18 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
          <div style={{ fontSize:15,fontWeight:800,color:"#e879f9",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{good.name}</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer",flexShrink:0,marginLeft:8 }}>✕</button>
        </div>
        <div style={{ width:"100%",aspectRatio:"1/1",display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.04)",borderRadius:16,overflow:"hidden",marginBottom:16,position:"relative" }}>
          {good.image
            ?<img src={good.image} alt={good.name} style={{ maxWidth:"90%",maxHeight:"90%",objectFit:"contain",transform:`rotate(${rotation}deg) scale(${zoom})`,transition:"transform 0.15s",borderRadius:8,userSelect:"none" }}/>
            :<div style={{ fontSize:80,transform:`rotate(${rotation}deg) scale(${zoom})`,transition:"transform 0.15s" }}>{good.emoji||"📦"}</div>
          }
        </div>
        <div style={{ marginBottom:10 }}>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"#9ca3af",marginBottom:4 }}>
            <span>🔄 回転</span><span style={{ fontWeight:700,color:"#e879f9" }}>{rotation}°</span>
          </div>
          <input type="range" min={-180} max={180} value={rotation} onChange={e=>setRotation(Number(e.target.value))}
            style={{ width:"100%",accentColor:"#e879f9",cursor:"pointer" }}/>
        </div>
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"#9ca3af",marginBottom:4 }}>
            <span>🔍 ズーム</span><span style={{ fontWeight:700,color:"#e879f9" }}>{Math.round(zoom*100)}%</span>
          </div>
          <input type="range" min={0.5} max={3} step={0.1} value={zoom} onChange={e=>setZoom(Number(e.target.value))}
            style={{ width:"100%",accentColor:"#e879f9",cursor:"pointer" }}/>
        </div>
        <button onClick={()=>{setRotation(0);setZoom(1);}} style={{ width:"100%",padding:"8px",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"#9ca3af",fontSize:12,cursor:"pointer",transition:"background 0.15s" }}>リセット</button>
      </div>
    </div>
  );
}

function GoodCard({ good, count=1, characters, isPro, onStatusChange, onDelete, onCharChange }) {
  const st=STATUS[good.status];
  const [open,setOpen]=useState(false);
  const [viewing,setViewing]=useState(false);
  const char=characters.find(c=>c.id===good.characterId);
  return (
    <div style={S.card}>
      <div style={{ ...S.cardImgWrap,cursor:"zoom-in" }} onClick={()=>setViewing(true)}>
        {good.image?<img src={good.image} alt={good.name} style={S.cardImg}/>:<div style={S.cardEmoji}>{good.emoji||"📦"}</div>}
        <div style={{ ...S.badge,background:st.bg,color:st.color }}>{st.icon} {st.label}</div>
        {count>1 && <div style={{ position:"absolute",top:8,right:8,background:"rgba(232,121,249,0.9)",color:"#fff",borderRadius:12,padding:"2px 8px",fontSize:11,fontWeight:900 }}>×{count}</div>}
        {char&&<div style={{ position:"absolute",bottom:6,right:6,fontSize:9,background:`${char.color}33`,color:char.color,borderRadius:10,padding:"1px 6px",fontWeight:700,border:`1px solid ${char.color}44` }}>{char.emoji} {char.name}</div>}
      </div>
      <div style={S.cardBody}>
        <div style={S.cardName}>{good.name}</div>
        {good.goodType&&good.goodType!=="other"&&(()=>{ const t=GOOD_TYPES.find(t=>t.id===good.goodType); return t?<div style={{ fontSize:10,color:"#a78bfa",marginBottom:2 }}>{t.emoji} {t.label}</div>:null; })()}
        {good.series&&<div style={S.cardSeries}>{good.series}</div>}
        {good.purchaseDate&&<div style={S.cardMeta}>📅 {good.purchaseDate}</div>}
        {good.releaseDate&&<div style={S.cardMeta}>🔖 発売: {good.releaseDate}</div>}
        {(good.proofImage||good.receiptImage)&&<div style={{ fontSize:10,color:"#4ade80",fontWeight:700,marginTop:2 }}>✓ 証明済み{good.proofImage&&good.receiptImage?" 📸📧":good.proofImage?" 📸":" 📧"}</div>}
        {good.officialUrl&&<a href={good.officialUrl} target="_blank" rel="noreferrer" style={{ fontSize:10,color:"#818cf8",display:"block",marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>🔗 公式サイト</a>}
      </div>
      <div style={S.cardActions}>
        {isPro&&characters.length>0&&(
          <select value={good.characterId||""} onChange={e=>onCharChange(e.target.value||null)}
            style={{ fontSize:10,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,color:"#9ca3af",padding:"2px 4px",flex:1,cursor:"pointer" }}>
            <option value="">— 推し未設定</option>
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
      {viewing&&<GoodDetailModal good={good} onClose={()=>setViewing(false)}/>}
    </div>
  );
}

// ─── Character Manager Modal (PRO) ───────────────────────────
function CharManagerModal({ characters, onAdd, onDelete, onClose }) {
  const [name,setName]=useState("");
  const [emoji,setEmoji]=useState("⭐");
  const [color,setColor]=useState("#e879f9");
  const EMOJIS=["⭐","🌸","🎀","💎","🌙","🔥","🌈","🐱","🦋","🎵","👑","🌺"];
  const [birthday, setBirthday] = useState("");
  const submit=()=>{
    if(!name.trim()) return;
    onAdd({id:newUid(),name:name.trim(),emoji,color,birthday}); setName(""); setEmoji("⭐"); setBirthday("");
  };
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:400 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:17,fontWeight:800,color:"#e879f9" }}>🌟 推し管理</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
        {/* Add form */}
        <div style={{ background:"rgba(255,255,255,0.03)",borderRadius:12,padding:14,marginBottom:14,border:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize:12,color:"#7c6a9a",fontWeight:700,marginBottom:10 }}>新しい推しを追加</div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:10 }}>
            {EMOJIS.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{ fontSize:20,width:36,height:36,borderRadius:8,border:`2px solid ${emoji===e?"#e879f9":"transparent"}`,background:"rgba(255,255,255,0.05)",cursor:"pointer" }}>{e}</button>)}
          </div>
          <div style={{ display:"flex",gap:8,marginBottom:10,alignItems:"center" }}>
            <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{ width:36,height:36,border:"none",borderRadius:8,padding:2,background:"transparent",cursor:"pointer" }}/>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="推しの名前 (例: 月ノ美兎)" style={{ ...S.input,flex:1 }} maxLength={20} onKeyDown={e=>e.key==="Enter"&&submit()} />
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
            <span style={{ fontSize:12,color:"#7c6a9a",whiteSpace:"nowrap",flexShrink:0 }}>🎂 誕生日</span>
            <input type="date" value={birthday} onChange={e=>setBirthday(e.target.value)} style={{ ...S.input,flex:1,padding:"6px 10px",fontSize:12 }}/>
          </div>
          <div style={{ display:"flex",gap:8 }}>
          </div>
          <button onClick={submit} style={{ width:"100%",padding:"9px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer" }}>追加する</button>
        </div>
        {/* List */}
        {characters.length===0?<div style={{ textAlign:"center",opacity:0.4,fontSize:13,padding:20 }}>まだ推しが登録されていません</div>:(
          <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
            {characters.map(c=>(
              <div key={c.id} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,0.03)",borderRadius:10,border:`1px solid ${c.color}33` }}>
                <span style={{ fontSize:20 }}>{c.emoji}</span>
                <div style={{ flex:1 }}>
                <span style={{ fontSize:13,fontWeight:700,color:c.color }}>{c.name}</span>
                {c.birthday&&<div style={{ fontSize:10,color:"#6b7280",marginTop:1 }}>🎂 {c.birthday.slice(5).replace("-","月")}日</div>}
              </div>
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
function AltarPage({ altar, template, goods, altars, isPro, isPremium, viewingShared, onUpdateAltar, goodById, showToast, onOpenTemplates, onOpenShare, onOpenAltarManager, onOpenMaterials, onOpenBgPicker, onSwitchAltar, onUpgrade, onAutoArrange }) {
  const ownedGoods = goods.filter(g=>g.status==="owned"||g.status==="reserved");
  const shelf   = altar.shelf;
  const freeItems = altar.freeItems;
  const altarMode = altar.altarMode;
  const onShelf = new Set(shelf.flat().filter(Boolean));
  const onHina     = new Set((altar.hinaShelf||[]).flat().filter(Boolean));
  const onShowcase = new Set((altar.showcaseShelf||[]).flat().filter(Boolean));
  const onFlat     = new Set((altar.flatShelf||[]).filter(Boolean));
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

  // ── Hina shelf handlers ────────────────────────────────────
  const hinaShelf = altar.hinaShelf || Array.from({length:5},(_,i)=>Array(i+2).fill(null)).reverse();
  const placeOnHina=(goodId,r,c)=>onUpdateAltar({hinaShelf:hinaShelf.map((row,ri)=>row.map((cell,ci)=>{ if(cell===goodId) return null; if(ri===r&&ci===c) return goodId; return cell; }))});
  const swapHina=(r1,c1,r2,c2)=>onUpdateAltar({hinaShelf:hinaShelf.map((row,ri)=>row.map((cell,ci)=>{ if(ri===r1&&ci===c1) return hinaShelf[r2][c2]; if(ri===r2&&ci===c2) return hinaShelf[r1][c1]; return cell; }))});
  const removeHina=(r,c)=>onUpdateAltar({hinaShelf:hinaShelf.map((row,ri)=>row.map((cell,ci)=>ri===r&&ci===c?null:cell))});
  // ── Showcase handlers ────────────────────────────────────
  const showcaseShelf = altar.showcaseShelf || Array.from({length:3},()=>Array(4).fill(null));
  const placeOnShowcase=(goodId,r,c)=>onUpdateAltar({showcaseShelf:showcaseShelf.map((row,ri)=>row.map((cell,ci)=>{ if(cell===goodId) return null; if(ri===r&&ci===c) return goodId; return cell; }))});
  const swapShowcase=(r1,c1,r2,c2)=>onUpdateAltar({showcaseShelf:showcaseShelf.map((row,ri)=>row.map((cell,ci)=>{ if(ri===r1&&ci===c1) return showcaseShelf[r2][c2]; if(ri===r2&&ci===c2) return showcaseShelf[r1][c1]; return cell; }))});
  const removeShowcase=(r,c)=>onUpdateAltar({showcaseShelf:showcaseShelf.map((row,ri)=>row.map((cell,ci)=>ri===r&&ci===c?null:cell))});
  const [showcaseDragSrcGood,setShowcaseDragSrcGood]=useState(null);
  const [showcaseDragSrcCell,setShowcaseDragSrcCell]=useState(null);
  const [showcaseHoverCell,setShowcaseHoverCell]=useState(null);
  const handleShowcaseDrop=(r,c)=>{
    if(showcaseDragSrcGood){placeOnShowcase(showcaseDragSrcGood,r,c);showToast("ショーケースに配置しました ✓");setShowcaseDragSrcGood(null);}
    else if(showcaseDragSrcCell){const[sr,sc]=showcaseDragSrcCell;if(sr!==r||sc!==c)swapShowcase(sr,sc,r,c);setShowcaseDragSrcCell(null);}
    setShowcaseHoverCell(null);
  };

  // ── Flat shelf handlers ────────────────────────────────────
  const flatShelf = altar.flatShelf || Array(8).fill(null);
  const placeOnFlat=(goodId,i)=>onUpdateAltar({flatShelf:flatShelf.map((cell,ci)=>{ if(cell===goodId) return null; if(ci===i) return goodId; return cell; })});
  const removeFlat=(i)=>onUpdateAltar({flatShelf:flatShelf.map((cell,ci)=>ci===i?null:cell)});
  const [flatDragSrcGood,setFlatDragSrcGood]=useState(null);
  const [flatDragSrcIdx,setFlatDragSrcIdx]=useState(null);
  const [flatHoverIdx,setFlatHoverIdx]=useState(null);
  const handleFlatDrop=(i)=>{
    if(flatDragSrcGood){placeOnFlat(flatDragSrcGood,i);showToast("フラット台に配置しました ✓");setFlatDragSrcGood(null);}
    else if(flatDragSrcIdx!==null&&flatDragSrcIdx!==i){
      const nf=[...flatShelf]; [nf[flatDragSrcIdx],nf[i]]=[nf[i],nf[flatDragSrcIdx]];
      onUpdateAltar({flatShelf:nf}); setFlatDragSrcIdx(null);
    }
    setFlatHoverIdx(null);
  };

  const [hinaDragSrcGood,setHinaDragSrcGood]=useState(null);
  const [hinaDragSrcCell,setHinaDragSrcCell]=useState(null);
  const [hinaHoverCell,setHinaHoverCell]=useState(null);
  const handleHinaDrop=(r,c)=>{
    if(hinaDragSrcGood){placeOnHina(hinaDragSrcGood,r,c);showToast("ひな壇に配置しました ✓");setHinaDragSrcGood(null);}
    else if(hinaDragSrcCell){const[sr,sc]=hinaDragSrcCell;if(sr!==r||sc!==c)swapHina(sr,sc,r,c);setHinaDragSrcCell(null);}
    setHinaHoverCell(null);
  };
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

  // ── Deco sticker drag ──────────────────────────────────────
  const decoItems = altar.decoItems||[];
  const [draggingDeco,setDraggingDeco]       = useState(null);
  const [dragOffsetDeco,setDragOffsetDeco]   = useState({x:0,y:0});
  const [selectedDeco,setSelectedDeco]       = useState(null);
  const maxZDeco = useRef(100);

  const startDecoDrag = useCallback((e,id)=>{
    e.preventDefault(); e.stopPropagation();
    const rect=freeRef.current?.getBoundingClientRect()||{left:0,top:0};
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const cy=e.touches?e.touches[0].clientY:e.clientY;
    const item=decoItems.find(i=>i.id===id);
    if(!item) return;
    maxZDeco.current++;
    onUpdateAltar({decoItems:decoItems.map(i=>i.id===id?{...i,zIndex:maxZDeco.current}:i)});
    setDraggingDeco(id); setDragOffsetDeco({x:cx-rect.left-item.x,y:cy-rect.top-item.y});
  },[decoItems,onUpdateAltar]);

  const onDecoMove = useCallback((e)=>{
    if(!draggingDeco) return;
    const rect=freeRef.current?.getBoundingClientRect()||{left:0,top:0};
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const cy=e.touches?e.touches[0].clientY:e.clientY;
    onUpdateAltar({decoItems:decoItems.map(i=>i.id===draggingDeco?{...i,x:cx-rect.left-dragOffsetDeco.x,y:cy-rect.top-dragOffsetDeco.y}:i)});
  },[draggingDeco,dragOffsetDeco,decoItems,onUpdateAltar]);

  const endDecoDrag = useCallback(()=>setDraggingDeco(null),[]);
  const scaleDecoItem  = (id,d)=>onUpdateAltar({decoItems:decoItems.map(i=>i.id===id?{...i,scale:Math.max(0.3,Math.min(5,(i.scale||1)+d))}:i)});
  const rotateDecoItem = (id,d)=>onUpdateAltar({decoItems:decoItems.map(i=>i.id===id?{...i,rotation:(i.rotation||0)+d}:i)});
  const updateDecoItem = (id,patch)=>onUpdateAltar({decoItems:decoItems.map(i=>i.id===id?{...i,...patch}:i)});
  const removeDecoItem = (id)=>{ onUpdateAltar({decoItems:decoItems.filter(i=>i.id!==id)}); setSelectedDeco(null); };

  // Layer reorder: swap zIndex values to move item forward/backward
  const reorderLayer=(id,dir)=>{
    const sorted=[...freeItems].sort((a,b)=>(b.zIndex||0)-(a.zIndex||0));
    const idx=sorted.findIndex(i=>i.id===id);
    const swapIdx=dir==="up"?idx-1:idx+1;
    if(swapIdx<0||swapIdx>=sorted.length) return;
    const a=sorted[idx],b=sorted[swapIdx];
    onUpdateAltar({freeItems:freeItems.map(i=>i.id===a.id?{...i,zIndex:b.zIndex}:i.id===b.id?{...i,zIndex:a.zIndex}:i)});
  };
  const scaleLayer=(id,val)=>onUpdateAltar({freeItems:freeItems.map(i=>i.id===id?{...i,scale:val}:i)});
  const [showLayerPanel,setShowLayerPanel]=useState(false);
  const removeFreeItem=(id)=>onUpdateAltar({freeItems:freeItems.filter(i=>i.id!==id)});
  const scaleFreeItem=(id,d)=>onUpdateAltar({freeItems:freeItems.map(i=>i.id===id?{...i,scale:Math.max(0.5,Math.min(2.5,i.scale+d))}:i)});

  const startFreeDrag=useCallback((e,id)=>{ e.preventDefault(); e.stopPropagation(); const rect=freeRef.current.getBoundingClientRect(); const cx=e.touches?e.touches[0].clientX:e.clientX; const cy=e.touches?e.touches[0].clientY:e.clientY; const item=freeItems.find(i=>i.id===id); maxZFree.current++; onUpdateAltar({freeItems:freeItems.map(i=>i.id===id?{...i,zIndex:maxZFree.current}:i)}); setDraggingFree(id); setDragOffsetFree({x:cx-rect.left-item.x,y:cy-rect.top-item.y}); },[freeItems,onUpdateAltar]);
  const onFreeMove=useCallback((e)=>{ if(!draggingFree) return; const rect=freeRef.current?.getBoundingClientRect(); if(!rect) return; const cx=e.touches?e.touches[0].clientX:e.clientX; const cy=e.touches?e.touches[0].clientY:e.clientY; onUpdateAltar({freeItems:freeItems.map(i=>i.id===draggingFree?{...i,x:cx-rect.left-dragOffsetFree.x,y:cy-rect.top-dragOffsetFree.y}:i)}); },[draggingFree,dragOffsetFree,freeItems,onUpdateAltar]);
  const endFreeDrag=useCallback(()=>setDraggingFree(null),[]);

  useEffect(()=>{
    const mm=(e)=>{ onFreeMove(e); onDecoMove(e); };
    const mu=()=>{ endFreeDrag(); endDecoDrag(); };
    window.addEventListener("mousemove",mm);
    window.addEventListener("mouseup",mu);
    window.addEventListener("touchmove",mm,{passive:false});
    window.addEventListener("touchend",mu);
    return()=>{
      window.removeEventListener("mousemove",mm);
      window.removeEventListener("mouseup",mu);
      window.removeEventListener("touchmove",mm);
      window.removeEventListener("touchend",mu);
    };
  },[onFreeMove,endFreeDrag,onDecoMove,endDecoDrag]);

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
          <div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>
            <input ref={nameRef} value={nameInput} onChange={e=>setNameInput(e.target.value)} onBlur={commitName} onKeyDown={e=>{if(e.key==="Enter")commitName();if(e.key==="Escape"){setNameInput(altar.name);setEditingName(false);}}} maxLength={30}
              style={{ flex:1,minWidth:0,fontSize:20,fontWeight:800,background:"transparent",border:"none",borderBottom:"2px solid #e879f9",color:isDark?"#f0e8ff":"#1a0030",outline:"none",padding:"2px 4px" }}/>
            <button
              onMouseDown={e=>{e.preventDefault(); onUpdateAltar({hideEmojiDecor:!altar.hideEmojiDecor});}}
              title={altar.hideEmojiDecor?"絵文字を表示する":"絵文字を非表示にする"}
              style={{ fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:12,border:"1px solid rgba(255,255,255,0.15)",background:altar.hideEmojiDecor?"rgba(255,255,255,0.06)":"rgba(232,121,249,0.15)",color:altar.hideEmojiDecor?"#6b7280":"#e879f9",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0 }}>
              {altar.hideEmojiDecor ? "⛩ OFF" : "⛩ ON"}
            </button>
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
      <div style={{ display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center" }}>
        {[["shelf","🗄 棚"],["hina","🎎 ひな壇"],["showcase","🪟 ショーケース"],["flat","🟫 フラット台"],["free","✦ 自由配置"]].map(([m,l])=>(
          <button key={m} onClick={()=>!viewingShared&&onUpdateAltar({altarMode:m})} style={{ ...S.modeBtn,...(altarMode===m?S.modeBtnOn:{}) }}>{l}</button>
        ))}
        {!viewingShared&&<button onClick={onOpenTemplates} style={{ ...S.modeBtn,border:`1px solid ${template.border}`,color:template.accent }}>{template.emoji} テンプレ</button>}
        {!viewingShared&&altarMode==="shelf"&&<ShelfStylePicker currentId={altar.shelfStyleId||"default"} isPremium={isPremium} onChange={id=>onUpdateAltar({shelfStyleId:id})} />}
        {!viewingShared&&<button onClick={onAutoArrange} style={{ ...S.modeBtn,border:"1px solid rgba(255,200,100,0.3)",color:"#fcd34d" }}>✨ 自動配置</button>}
        {!viewingShared&&altarMode==="free"&&freeItems.length>0&&<button onClick={()=>setShowLayerPanel(l=>!l)} style={{ ...S.modeBtn,border:`1px solid ${showLayerPanel?"rgba(165,180,252,0.5)":"rgba(165,180,252,0.2)"}`,color:"#a5b4fc",background:showLayerPanel?"rgba(165,180,252,0.1)":"transparent" }}>🔲 レイヤー</button>}
        {!viewingShared&&<button onClick={onOpenBgPicker} style={{ ...S.modeBtn,border:`1px solid ${altar.bgMaterialId||altar.bgCustomColor||altar.customColors||altar.bgCustomImage?"rgba(99,102,241,0.5)":"rgba(99,102,241,0.25)"}`,color:"#818cf8",background:altar.bgMaterialId||altar.bgCustomColor||altar.customColors||altar.bgCustomImage?"rgba(99,102,241,0.12)":"transparent" }}>🌌 背景{altar.bgMaterialId||altar.bgCustomColor||altar.customColors||altar.bgCustomImage?" ✓":""}</button>}
        {!viewingShared&&<button onClick={onOpenMaterials} style={{ ...S.modeBtn,border:"1px solid rgba(192,132,252,0.4)",color:"#c084fc",background:altar.frameMaterialId||altar.frameCustomImage||altar.decoItems?.length?"rgba(192,132,252,0.1)":"transparent" }}>🎨 素材{(altar.frameMaterialId||altar.frameCustomImage||altar.decoItems?.length||altar.lightId)?` ✓`:""}</button>}
        <button onClick={onOpenShare} style={S.shareBtn}>📸 シェア</button>
      </div>

      {/* Shelf mode */}
      {altarMode==="shelf"&&(
        <div style={{ ...S.altarBg,background:altar.bgCustomColor||(altar.bgMaterialId&&MATERIALS.find(m=>m.id===altar.bgMaterialId)?.bg)||template.bg,border:`1px solid ${template.border}`,marginBottom:16,overflow:"hidden",position:"relative" }}>
          {template.star&&<StarField/>}
          <AnimatedBG materialId={altar.bgMaterialId}/>
          {altar.bgCustomImage&&<img src={altar.bgCustomImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0,pointerEvents:"none"}}/>}
          <LightOverlay materialId={altar.lightId}/>
          <FrameOverlay materialId={altar.frameMaterialId} frameCustomColor={altar.frameCustomColor}/>
          {altar.frameCustomImage&&<img src={altar.frameCustomImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"fill",zIndex:11,pointerEvents:"none",borderRadius:18}}/>}
          <AltarTopBar template={template} altarName={altar.name} hideEmojiDecor={altar.hideEmojiDecor}/>
          {/* Deco stickers on shelf */}
          <DecoLayer decoItems={decoItems} isDark={template.dark!==false} viewingShared={viewingShared}
            draggingDeco={draggingDeco} selectedDeco={selectedDeco}
            onStartDrag={startDecoDrag} onSelect={setSelectedDeco}
            onScale={scaleDecoItem} onRotate={rotateDecoItem} onUpdate={updateDecoItem} onRemove={removeDecoItem} onEndDrag={endDecoDrag} freeRef={freeRef}/>
          {shelf.map((row,rIdx)=>{
            const ss=SHELF_STYLES.find(s=>s.id===(altar.shelfStyleId||"default"))||SHELF_STYLES[0];
            return (
            <div key={rIdx} style={{ ...S.shelfRow }}>
              <div style={{ ...S.shelfPlank,background:ss.plank,border:ss.plankBorder||"none",boxShadow:ss.shadow,height:ss.height||8,borderRadius:ss.radius,backdropFilter:ss.blur?"blur(8px)":undefined }}>
                {ss.grain&&<div style={{ position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)",borderRadius:ss.radius }}/>}
              </div>
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
          );
          })}
        </div>
      )}

      {/* ── Hina mode ── */}
      {altarMode==="hina"&&(
        <div style={{ ...S.altarBg,background:altar.bgCustomColor||(altar.bgMaterialId&&MATERIALS.find(m=>m.id===altar.bgMaterialId)?.bg)||template.bg,border:`1px solid ${template.border}`,marginBottom:16,overflow:"hidden",position:"relative",minHeight:360 }}>
          {template.star&&<StarField/>}
          <AnimatedBG materialId={altar.bgMaterialId}/>
          {altar.bgCustomImage&&<img src={altar.bgCustomImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0,pointerEvents:"none"}}/>}
          <LightOverlay materialId={altar.lightId}/>
          <FrameOverlay materialId={altar.frameMaterialId} frameCustomColor={altar.frameCustomColor}/>
          {altar.frameCustomImage&&<img src={altar.frameCustomImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"fill",zIndex:11,pointerEvents:"none",borderRadius:18}}/>}
          <DecoLayer decoItems={decoItems} isDark={template.dark!==false} viewingShared={viewingShared}
            draggingDeco={draggingDeco} selectedDeco={selectedDeco}
            onStartDrag={startDecoDrag} onSelect={setSelectedDeco}
            onScale={scaleDecoItem} onRotate={rotateDecoItem} onUpdate={updateDecoItem} onRemove={removeDecoItem} onEndDrag={endDecoDrag} freeRef={freeRef}/>
          <AltarTopBar template={template} altarName={altar.name} hideEmojiDecor={altar.hideEmojiDecor}/>
          {/* Hina pyramid */}
          <HinaStage
            hinaShelf={hinaShelf} template={template} goodById={goodById}
            isDark={isDark} viewingShared={viewingShared}
            hinaDragSrcGood={hinaDragSrcGood} hinaDragSrcCell={hinaDragSrcCell} hinaHoverCell={hinaHoverCell}
            setHinaDragSrcGood={setHinaDragSrcGood} setHinaDragSrcCell={setHinaDragSrcCell}
            setHinaHoverCell={setHinaHoverCell} onDrop={handleHinaDrop} onRemove={removeHina}
            shelfStyleId={altar.shelfStyleId||"default"}
          />
        </div>
      )}

      {/* ── Showcase mode ── */}
      {altarMode==="showcase"&&(
        <div style={{ ...S.altarBg,background:altar.bgCustomColor||(altar.bgMaterialId&&MATERIALS.find(m=>m.id===altar.bgMaterialId)?.bg)||template.bg,border:`1px solid ${template.border}`,marginBottom:16,overflow:"hidden",position:"relative" }}>
          {template.star&&<StarField/>}
          <AnimatedBG materialId={altar.bgMaterialId}/>
          {altar.bgCustomImage&&<img src={altar.bgCustomImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0,pointerEvents:"none"}}/>}
          <LightOverlay materialId={altar.lightId}/>
          <FrameOverlay materialId={altar.frameMaterialId} frameCustomColor={altar.frameCustomColor}/>
          {altar.frameCustomImage&&<img src={altar.frameCustomImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"fill",zIndex:11,pointerEvents:"none",borderRadius:18}}/>}
          <DecoLayer decoItems={decoItems} isDark={template.dark!==false} viewingShared={viewingShared}
            draggingDeco={draggingDeco} selectedDeco={selectedDeco}
            onStartDrag={startDecoDrag} onSelect={setSelectedDeco}
            onScale={scaleDecoItem} onRotate={rotateDecoItem} onUpdate={updateDecoItem} onRemove={removeDecoItem} onEndDrag={endDecoDrag} freeRef={freeRef}/>
          <AltarTopBar template={template} altarName={altar.name} hideEmojiDecor={altar.hideEmojiDecor}/>
          <ShowcaseStage
            showcaseShelf={showcaseShelf} template={template} goodById={goodById}
            isDark={isDark} viewingShared={viewingShared}
            dragSrcGood={showcaseDragSrcGood} dragSrcCell={showcaseDragSrcCell} hoverCell={showcaseHoverCell}
            setDragSrcCell={setShowcaseDragSrcCell} setHoverCell={setShowcaseHoverCell}
            onDrop={handleShowcaseDrop} onRemove={removeShowcase}
            shelfStyleId={altar.shelfStyleId||"default"}
          />
        </div>
      )}

      {/* ── Flat mode ── */}
      {altarMode==="flat"&&(
        <div style={{ ...S.altarBg,background:altar.bgCustomColor||(altar.bgMaterialId&&MATERIALS.find(m=>m.id===altar.bgMaterialId)?.bg)||template.bg,border:`1px solid ${template.border}`,marginBottom:16,overflow:"hidden",position:"relative" }}>
          {template.star&&<StarField/>}
          <AnimatedBG materialId={altar.bgMaterialId}/>
          {altar.bgCustomImage&&<img src={altar.bgCustomImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0,pointerEvents:"none"}}/>}
          <LightOverlay materialId={altar.lightId}/>
          <FrameOverlay materialId={altar.frameMaterialId} frameCustomColor={altar.frameCustomColor}/>
          {altar.frameCustomImage&&<img src={altar.frameCustomImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"fill",zIndex:11,pointerEvents:"none",borderRadius:18}}/>}
          <DecoLayer decoItems={decoItems} isDark={template.dark!==false} viewingShared={viewingShared}
            draggingDeco={draggingDeco} selectedDeco={selectedDeco}
            onStartDrag={startDecoDrag} onSelect={setSelectedDeco}
            onScale={scaleDecoItem} onRotate={rotateDecoItem} onUpdate={updateDecoItem} onRemove={removeDecoItem} onEndDrag={endDecoDrag} freeRef={freeRef}/>
          <AltarTopBar template={template} altarName={altar.name} hideEmojiDecor={altar.hideEmojiDecor}/>
          <FlatStage
            flatShelf={flatShelf} template={template} goodById={goodById}
            isDark={isDark} viewingShared={viewingShared}
            dragSrcGood={flatDragSrcGood} dragSrcIdx={flatDragSrcIdx} hoverIdx={flatHoverIdx}
            setDragSrcIdx={setFlatDragSrcIdx} setHoverIdx={setFlatHoverIdx}
            onDrop={handleFlatDrop} onRemove={removeFlat}
            shelfStyleId={altar.shelfStyleId||"default"}
          />
        </div>
      )}

      {/* Layer panel */}
      {altarMode==="free"&&showLayerPanel&&!viewingShared&&(
        <LayerPanel freeItems={freeItems} goodById={goodById} onReorder={reorderLayer} onScaleDepth={scaleLayer}/>
      )}

      {/* Free mode */}
      {altarMode==="free"&&(
        <div ref={freeRef} onClick={()=>setSelectedFree(null)} style={{ ...S.altarBg,background:altar.bgCustomColor||(altar.bgMaterialId&&MATERIALS.find(m=>m.id===altar.bgMaterialId)?.bg)||template.bg,border:`1px solid ${template.border}`,height:380,position:"relative",overflow:"hidden",cursor:draggingFree?"grabbing":"default",marginBottom:16 }}>
          <AltarTopBar template={template} altarName={altar.name} hideEmojiDecor={altar.hideEmojiDecor}/>
          {template.star&&<StarField/>}
          <AnimatedBG materialId={altar.bgMaterialId}/>
          {altar.bgCustomImage&&<img src={altar.bgCustomImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",zIndex:0,pointerEvents:"none"}}/>}
          <LightOverlay materialId={altar.lightId}/>
          <FrameOverlay materialId={altar.frameMaterialId} frameCustomColor={altar.frameCustomColor}/>
          {altar.frameCustomImage&&<img src={altar.frameCustomImage} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"fill",zIndex:11,pointerEvents:"none",borderRadius:18}}/>}
          {/* Deco stickers on free altar */}
          <DecoLayer decoItems={decoItems} isDark={template.dark!==false} viewingShared={viewingShared}
            draggingDeco={draggingDeco} selectedDeco={selectedDeco}
            onStartDrag={startDecoDrag} onSelect={setSelectedDeco}
            onScale={scaleDecoItem} onRotate={rotateDecoItem} onUpdate={updateDecoItem} onRemove={removeDecoItem} onEndDrag={endDecoDrag} freeRef={freeRef}/>
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
              {ownedGoods.map(g=>{ const placed=altarMode==="shelf"?onShelf.has(g.id):altarMode==="hina"?onHina.has(g.id):altarMode==="showcase"?onShowcase.has(g.id):altarMode==="flat"?onFlat.has(g.id):onFree.has(g.id); return (
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

function AltarTopBar({ template, altarName, hideEmojiDecor }) {
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"10px 20px",borderBottom:`1px solid ${template.border}`,color:template.accent,background:`${template.accent}08`,fontSize:14 }}>
      {!hideEmojiDecor && <span>{template.emoji}</span>}
      <span style={{ fontSize:13,fontWeight:700,letterSpacing:2 }}>{altarName}</span>
      {!hideEmojiDecor && <span>{template.emoji}</span>}
    </div>
  );
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
function FrameOverlay({ materialId, frameCustomColor }) {
  if (!materialId) return null;
  const mat = MATERIALS.find(m=>m.id===materialId);
  if (!mat) return null;
  // hex → rgba helper for shadow colors
  const toRgba = (hex, a) => {
    if (!hex||!hex.startsWith("#")) return `rgba(200,200,200,${a})`;
    const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  };
  const c = frameCustomColor; // null → use default
  const getStyles = () => ({
    fr_simple: { border:`3px solid ${c||"rgba(255,255,255,0.45)"}`, borderRadius:18 },
    fr_gold:   { border:`4px solid ${c||"#f59e0b"}`,  boxShadow:`inset 0 0 20px ${toRgba(c||"#f59e0b",0.25)}, 0 0 20px ${toRgba(c||"#f59e0b",0.2)}`, borderRadius:18 },
    fr_star:   { border:`3px solid ${c||"#fcd34d"}`,  boxShadow:`inset 0 0 30px ${toRgba(c||"#fcd34d",0.1)}, 0 0 15px ${toRgba(c||"#fcd34d",0.3)}`, borderRadius:18 },
    fr_torii:  { border:`4px solid ${c||"#dc2626"}`,  boxShadow:`inset 0 0 20px ${toRgba(c||"#dc2626",0.15)}, 0 0 15px ${toRgba(c||"#dc2626",0.2)}`, borderRadius:18 },
  });
  const styles = getStyles();
  const accentColor = c || { fr_torii:"#dc2626", fr_gold:"#f59e0b", fr_star:"#fcd34d", fr_simple:"rgba(255,255,255,0.45)" }[materialId] || "#818cf8";
  return (
    <>
      <div style={{ position:"absolute",inset:0,pointerEvents:"none",zIndex:10,borderRadius:18,...(styles[materialId]||{ border:`3px solid ${accentColor}`, borderRadius:18 }) }}/>
      {materialId==="fr_torii"&&<div style={{ position:"absolute",top:0,left:0,right:0,height:8,background:c||"#dc2626",pointerEvents:"none",zIndex:11,borderRadius:"18px 18px 0 0" }}/>}
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

// ─── Bg Modal ─────────────────────────────────────────────────
function BgModal({ altar, onUpdateAltar, onClose }) {
  const [bgTab, setBgTab] = useState(altar.customColors?"custom":altar.bgCustomColor?"solid":"solid");

  // ── 単色タブ state ──
  const [colorInput, setColorInput] = useState(altar.bgCustomColor||"#1a0a2e");
  const PRESET_COLORS = [
    { hex:"#0c0a14", name:"ディープブラック" }, { hex:"#1a0a2e", name:"ミッドナイト" },
    { hex:"#0a1628", name:"ネイビー" },         { hex:"#1a0505", name:"ダークレッド" },
    { hex:"#052e16", name:"フォレスト" },        { hex:"#1c1000", name:"ディープゴールド" },
    { hex:"#fdf2f8", name:"パステルピンク" },    { hex:"#f0f4ff", name:"ライトブルー" },
    { hex:"#fffbeb", name:"クリーム" },          { hex:"#f5f5f5", name:"ホワイト" },
    { hex:"#2d1b69", name:"パープル" },          { hex:"#134e4a", name:"ティール" },
  ];
  const applyCustomColor = (hex) => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) onUpdateAltar({ bgCustomColor: hex, bgMaterialId: null });
  };
  const clearCustomColor = () => onUpdateAltar({ bgCustomColor: null });

  // ── カスタムカラータブ state ──
  const baseTemplate = TEMPLATES.find(t=>t.id===altar.templateId)||TEMPLATES[0];
  const merged = altar.customColors ? {...baseTemplate,...altar.customColors} : baseTemplate;
  const [bgTop,  setBgTop]  = useState(merged.bg.match(/#[0-9a-f]{3,6}/gi)?.[0]||"#0c0a14");
  const [bgBot,  setBgBot]  = useState(merged.bg.match(/#[0-9a-f]{3,6}/gi)?.[1]||"#1a0f2e");
  const [accent, setAccent] = useState(merged.accent);
  const [plankTop,  setPlankTop]  = useState(merged.plank.match(/#[0-9a-f]{3,6}/gi)?.[0]||"#3d2060");
  const [plankBot,  setPlankBot]  = useState(merged.plank.match(/#[0-9a-f]{3,6}/gi)?.[1]||"#2a1540");
  const [isDarkMode,setIsDarkMode]= useState(merged.dark!==false);
  const hexInput = (label,val,set) => (
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:11,color:"#7c6a9a",marginBottom:5,fontWeight:600 }}>{label}</div>
      <div style={{ display:"flex",gap:8,alignItems:"center" }}>
        <input type="color" value={val} onChange={e=>set(e.target.value)} style={{ width:36,height:36,border:"none",borderRadius:8,cursor:"pointer",padding:2,background:"rgba(255,255,255,0.05)" }}/>
        <input type="text"  value={val} onChange={e=>{ if(/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) set(e.target.value); }} maxLength={7} placeholder="#000000" style={{ ...S.input,flex:1,padding:"7px 10px",fontSize:13,fontFamily:"monospace" }}/>
      </div>
    </div>
  );
  const applyCustom = () => {
    onUpdateAltar({
      customColors:{ bg:`linear-gradient(180deg,${bgTop},${bgBot})`, accent, gold:accent, floor:`${accent}14`, border:`${accent}55`, plank:`linear-gradient(180deg,${plankTop},${plankBot})`, dark:isDarkMode },
      bgCustomColor: null,
    });
  };
  const clearCustomColors = () => {
    onUpdateAltar({ customColors: null });
    // reset local state to base template
    setBgTop( baseTemplate.bg.match(/#[0-9a-f]{3,6}/gi)?.[0]||"#0c0a14");
    setBgBot( baseTemplate.bg.match(/#[0-9a-f]{3,6}/gi)?.[1]||"#1a0f2e");
    setAccent(baseTemplate.accent);
    setPlankTop(baseTemplate.plank.match(/#[0-9a-f]{3,6}/gi)?.[0]||"#3d2060");
    setPlankBot(baseTemplate.plank.match(/#[0-9a-f]{3,6}/gi)?.[1]||"#2a1540");
    setIsDarkMode(baseTemplate.dark!==false);
  };

  // ── 画像アップロード（アニメタブ内）──
  const bgImgRef = useRef(null);
  const handleBgImgFile = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5*1024*1024) { alert("5MB以下にしてください"); return; }
    onUpdateAltar({ bgCustomImage: await readFileAsDataURL(f) });
  };

  // ── アニメ背景タブ ──
  const bgItems = MATERIALS.filter(m=>m.type==="bg");
  const isBgMatActive = (mat) => altar.bgMaterialId===mat.id;
  const toggleBgMat = (mat) => {
    onUpdateAltar({ bgMaterialId: altar.bgMaterialId===mat.id?null:mat.id, bgCustomColor: null });
  };

  const TABS = [["solid","🎨 単色"],["custom","✏ カスタム"],["anim","🌈 アニメ"]];
  const hasActiveSolid  = !!altar.bgCustomColor;
  const hasActiveCustom = !!altar.customColors;
  const hasActiveAnim   = !!altar.bgMaterialId;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:500 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ fontSize:18,fontWeight:800,color:"#818cf8" }}>🌌 背景を選ぶ</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex",gap:6,marginBottom:14 }}>
          {TABS.map(([t,l])=>{
            const hasActive = t==="solid"?hasActiveSolid:t==="custom"?hasActiveCustom:hasActiveAnim;
            return (
              <button key={t} onClick={()=>setBgTab(t)}
                style={{ flex:1,padding:"7px 4px",borderRadius:10,border:`1px solid ${bgTab===t?"rgba(129,140,248,0.5)":hasActive?"rgba(129,140,248,0.25)":"rgba(255,255,255,0.08)"}`,background:bgTab===t?"rgba(129,140,248,0.18)":"transparent",color:bgTab===t?"#818cf8":hasActive?"#a5b4fc":"#9ca3af",fontSize:11,fontWeight:700,cursor:"pointer",position:"relative" }}>
                {hasActive&&<span style={{ position:"absolute",top:3,right:5,fontSize:8,color:"#818cf8" }}>✓</span>}
                {l}
              </button>
            );
          })}
        </div>

        {/* ── 単色タブ ── */}
        {bgTab==="solid"&&(
          <div>
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
              {PRESET_COLORS.map(c=>(
                <button key={c.hex} title={c.name} onClick={()=>{ setColorInput(c.hex); applyCustomColor(c.hex); }}
                  style={{ width:32,height:32,borderRadius:8,background:c.hex,border:`2px solid ${altar.bgCustomColor===c.hex?"#22c55e":"rgba(255,255,255,0.12)"}`,cursor:"pointer",transition:"transform 0.1s",flexShrink:0 }}
                  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.15)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}/>
              ))}
            </div>
            <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:12 }}>
              <input type="color" value={colorInput} onChange={e=>{ setColorInput(e.target.value); applyCustomColor(e.target.value); }}
                style={{ width:36,height:36,border:"none",borderRadius:8,cursor:"pointer",padding:2,background:"transparent",flexShrink:0 }}/>
              <input type="text" value={colorInput}
                onChange={e=>{ setColorInput(e.target.value); if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)) applyCustomColor(e.target.value); }}
                placeholder="#000000" maxLength={7}
                style={{ ...S.input,flex:1,padding:"7px 10px",fontSize:13,fontFamily:"monospace" }}/>
              <div style={{ width:36,height:36,borderRadius:8,background:colorInput,border:"1px solid rgba(255,255,255,0.15)",flexShrink:0 }}/>
            </div>
            {hasActiveSolid&&(
              <button onClick={clearCustomColor} style={{ width:"100%",padding:"8px",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#9ca3af",fontSize:12,cursor:"pointer" }}>✕ 単色を解除</button>
            )}
          </div>
        )}

        {/* ── カスタムカラータブ ── */}
        {bgTab==="custom"&&(<>
          {/* preview */}
          <div style={{ background:`linear-gradient(180deg,${bgTop},${bgBot})`,borderRadius:12,height:64,border:`2px solid ${accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:accent,letterSpacing:1,position:"relative",overflow:"hidden",marginBottom:14 }}>
            <div style={{ position:"absolute",bottom:0,left:0,right:0,height:"35%",background:`${accent}14` }}/>
            <div style={{ position:"absolute",bottom:"33%",left:"10%",right:"10%",height:5,background:`linear-gradient(180deg,${plankTop},${plankBot})`,borderRadius:3 }}/>
            <span style={{ position:"relative",zIndex:1 }}>⛩ プレビュー</span>
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 16px" }}>
            {hexInput("背景（上）",bgTop,setBgTop)}
            {hexInput("背景（下）",bgBot,setBgBot)}
            {hexInput("アクセントカラー",accent,setAccent)}
            {hexInput("棚カラー（上）",plankTop,setPlankTop)}
            {hexInput("棚カラー（下）",plankBot,setPlankBot)}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 14px",background:"rgba(255,255,255,0.04)",borderRadius:10 }}>
            <span style={{ fontSize:12,color:"#9ca3af",flex:1 }}>ダークモード（テキストを白にする）</span>
            <button onClick={()=>setIsDarkMode(d=>!d)} style={{ width:42,height:24,borderRadius:12,border:"none",background:isDarkMode?"#818cf8":"rgba(255,255,255,0.1)",cursor:"pointer",position:"relative",transition:"background 0.2s" }}>
              <div style={{ width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,left:isDarkMode?21:3,transition:"left 0.2s" }}/>
            </button>
          </div>
          <div style={{ display:"flex",gap:8 }}>
            {hasActiveCustom&&(
              <button onClick={clearCustomColors}
                style={{ flex:1,padding:"10px",borderRadius:12,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#9ca3af",fontSize:12,fontWeight:700,cursor:"pointer" }}>🔄 リセット</button>
            )}
            <button onClick={applyCustom}
              style={{ flex:2,padding:"10px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#818cf8,#6366f1)",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer" }}>✓ このカラーで適用</button>
          </div>
        </>)}

        {/* ── アニメ背景タブ ── */}
        {bgTab==="anim"&&(
          <div>
            {/* 画像アップロード */}
            <div style={{ background:"rgba(255,255,255,0.03)",border:`2px solid ${altar.bgCustomImage?"rgba(129,140,248,0.5)":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:"12px 14px",marginBottom:12 }}>
              <div style={{ fontSize:12,fontWeight:700,color:"#818cf8",marginBottom:8 }}>📁 背景画像をアップロード</div>
              <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
                <div style={{ width:72,height:72,borderRadius:10,border:"2px dashed rgba(129,140,248,0.3)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,0.02)" }}
                  onClick={()=>bgImgRef.current?.click()}>
                  {altar.bgCustomImage
                    ? <img src={altar.bgCustomImage} alt="bg" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>
                    : <div style={{ textAlign:"center",color:"#7c6a9a",fontSize:10 }}>📷<br/>選択</div>}
                  <input ref={bgImgRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleBgImgFile} style={{ display:"none" }}/>
                </div>
                <div style={{ flex:1,display:"flex",flexDirection:"column",gap:6 }}>
                  <div style={{ fontSize:9,color:"#6b7280",lineHeight:1.5 }}>PNG/JPG/WebP・5MB以下<br/>透過PNGはそのまま使えます</div>
                  <div style={{ background:"rgba(129,140,248,0.07)",border:"1px solid rgba(129,140,248,0.2)",borderRadius:8,padding:"6px 10px",fontSize:10,color:"#a5b4fc",lineHeight:1.6 }}>
                    💡 <a href="https://sozaino.site/" target="_blank" rel="noreferrer" style={{ color:"#818cf8",fontWeight:700 }}>OKUMONO（sozaino.site）</a> でフリー素材を探せます
                  </div>
                  <div style={{ background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.25)",borderRadius:8,padding:"6px 10px",fontSize:10,color:"#fbbf24",lineHeight:1.6 }}>
                    ⚠️ アップロードする画像は、<strong>商用利用可のフリー素材・自作画像</strong>など、使用権のあるものをご使用ください。他者の著作物の無断使用は禁止です。
                  </div>
                  {altar.bgCustomImage&&<button onClick={()=>onUpdateAltar({bgCustomImage:null})} style={{ padding:"4px 10px",borderRadius:8,border:"1px solid rgba(239,68,68,0.3)",background:"transparent",color:"#ef4444",fontSize:11,cursor:"pointer" }}>✕ 削除</button>}
                </div>
              </div>
            </div>
            {/* プリセット背景グリッド */}
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8 }}>
            {bgItems.map(mat=>{
              const active = isBgMatActive(mat);
              return (
                <div key={mat.id} onClick={()=>toggleBgMat(mat)}
                  style={{ borderRadius:12,padding:"12px 8px",textAlign:"center",cursor:"pointer",transition:"all 0.2s",position:"relative",
                    background:active?"rgba(129,140,248,0.2)":"rgba(255,255,255,0.04)",
                    border:`2px solid ${active?"#818cf8":"rgba(255,255,255,0.08)"}` }}>
                  {active&&<div style={{ position:"absolute",top:5,right:5,width:14,height:14,borderRadius:"50%",background:"#818cf8",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900 }}>✓</div>}
                  {mat.image
                    ? <img src={mat.image} alt={mat.name} style={{ width:44,height:44,objectFit:"contain",display:"block",margin:"0 auto 4px" }}/>
                    : <div style={{ fontSize:28,marginBottom:4 }}>{mat.emoji}</div>}
                  <div style={{ fontSize:11,fontWeight:700,color:active?"#818cf8":"#f0e8ff" }}>{mat.name}</div>
                  <div style={{ fontSize:9,color:"#7c6a9a",marginTop:2 }}>{mat.desc}</div>
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Materials Modal ──────────────────────────────────────────
function MaterialsModal({ altar, onUpdateAltar, canUseMaterial, onClose }) {
  const [tab, setTab] = useState("frame");
  const [frameColorInput, setFrameColorInput] = useState(altar.frameCustomColor||"#f59e0b");
  const [customDecoName, setCustomDecoName] = useState("");
  const [customDecoImg, setCustomDecoImg]   = useState(null);
  const customDecoRef  = useRef(null);
  const customFrameRef = useRef(null);

  const handleCustomFrameFile = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5*1024*1024) { alert("5MB以下にしてください"); return; }
    onUpdateAltar({ frameCustomImage: await readFileAsDataURL(f) });
  };

  const handleCustomDecoFile = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 3*1024*1024) { alert("3MB以下にしてください"); return; }
    setCustomDecoImg(await readFileAsDataURL(f));
  };

  const addCustomDeco = () => {
    if (!customDecoImg) { alert("画像を選択してください"); return; }
    const cur = altar.decoItems||[];
    onUpdateAltar({ decoItems:[...cur,{
      id:newUid(), materialId:"custom",
      customImage:customDecoImg,
      customName:customDecoName.trim()||"マイデコ",
      x:150+Math.random()*200, y:100+Math.random()*150,
      scale:1.5, zIndex:(cur.length+1)*10,
    }]});
    setCustomDecoImg(null); setCustomDecoName("");
    alert("追加しました！祭壇上で位置を調整してください ✓");
  };
  const TABS = [["frame","🖼 フレーム"],["deco","🎀 デコ"],["light","💡 ライト"]];
  const items = MATERIALS.filter(m=>m.type===tab);

  // Frame color presets
  const FRAME_PRESET_COLORS = [
    { hex:"#f59e0b", name:"ゴールド" },
    { hex:"#dc2626", name:"レッド" },
    { hex:"#ec4899", name:"ピンク" },
    { hex:"#8b5cf6", name:"パープル" },
    { hex:"#3b82f6", name:"ブルー" },
    { hex:"#10b981", name:"グリーン" },
    { hex:"#f97316", name:"オレンジ" },
    { hex:"#ffffff", name:"ホワイト" },
    { hex:"#fcd34d", name:"イエロー" },
    { hex:"#818cf8", name:"インディゴ" },
    { hex:"#f0abfc", name:"ラベンダー" },
    { hex:"#a1a1aa", name:"シルバー" },
  ];

  const applyFrameColor = (hex) => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      onUpdateAltar({ frameCustomColor: hex });
    }
  };
  const clearFrameColor = () => { onUpdateAltar({ frameCustomColor: null }); };
  const isFrameColorActive = !!altar.frameCustomColor;

  const isActive = (mat) => {
    if (mat.type==="frame") return altar.frameMaterialId===mat.id;
    if (mat.type==="deco")  return (altar.decoItems||[]).some(d=>d.materialId===mat.id);
    if (mat.type==="light") return altar.lightId===mat.id;
  };
  const toggle = (mat) => {
    if (!canUseMaterial(mat)) return;
    if (mat.type==="frame") onUpdateAltar({frameMaterialId: altar.frameMaterialId===mat.id?null:mat.id});
    if (mat.type==="light") onUpdateAltar({lightId:         altar.lightId===mat.id?null:mat.id});
    if (mat.type==="deco")  {
      const cur = altar.decoItems||[];
      const exists = cur.find(d=>d.materialId===mat.id);
      if (exists) {
        onUpdateAltar({decoItems: cur.filter(d=>d.materialId!==mat.id)});
      } else {
        onUpdateAltar({decoItems:[...cur,{id:newUid(),materialId:mat.id,x:200+Math.random()*200,y:120+Math.random()*100,scale:1.5,zIndex:(cur.length+1)*10}]});
      }
    }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:500 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ fontSize:18,fontWeight:800,color:"#c084fc" }}>🎨 素材ショップ</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>


        {/* Tabs */}
        <div style={{ display:"flex",gap:6,marginBottom:14,overflowX:"auto" }}>
          {TABS.map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{ flex:1,padding:"6px 4px",borderRadius:10,border:`1px solid ${tab===t?"rgba(192,132,252,0.4)":"rgba(255,255,255,0.08)"}`,background:tab===t?"rgba(192,132,252,0.15)":"transparent",color:tab===t?"#c084fc":"#9ca3af",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" }}>{l}</button>
          ))}
        </div>

        {/* Frame color picker (frame tab, only when a frame is selected) */}
        {tab==="frame"&&altar.frameMaterialId&&(
          <div style={{ background:"rgba(255,255,255,0.03)",border:`2px solid ${isFrameColorActive?"rgba(192,132,252,0.6)":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:"12px 14px",marginBottom:12 }}>
            <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:10 }}>
              <span style={{ fontSize:13,fontWeight:700,color:isFrameColorActive?"#c084fc":"#f0e8ff" }}>🎨 フレームの色</span>
              {isFrameColorActive&&<button onClick={clearFrameColor} style={{ marginLeft:"auto",fontSize:10,color:"#9ca3af",background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,padding:"2px 8px",cursor:"pointer" }}>✕ デフォルトに戻す</button>}
            </div>
            {/* Preset swatches */}
            <div style={{ display:"flex",flexWrap:"wrap",gap:6,marginBottom:10 }}>
              {FRAME_PRESET_COLORS.map(c=>(
                <button key={c.hex} title={c.name} onClick={()=>{ setFrameColorInput(c.hex); applyFrameColor(c.hex); }}
                  style={{ width:28,height:28,borderRadius:8,background:c.hex,border:`2px solid ${altar.frameCustomColor===c.hex?"#c084fc":"rgba(255,255,255,0.15)"}`,cursor:"pointer",transition:"transform 0.1s",flexShrink:0 }}
                  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.15)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
                />
              ))}
            </div>
            {/* Custom hex input */}
            <div style={{ display:"flex",gap:8,alignItems:"center" }}>
              <input type="color" value={frameColorInput} onChange={e=>{ setFrameColorInput(e.target.value); applyFrameColor(e.target.value); }}
                style={{ width:36,height:36,border:"none",borderRadius:8,cursor:"pointer",padding:2,background:"transparent",flexShrink:0 }}/>
              <input type="text" value={frameColorInput}
                onChange={e=>{ setFrameColorInput(e.target.value); if(/^#[0-9a-fA-F]{6}$/.test(e.target.value)) applyFrameColor(e.target.value); }}
                placeholder="#000000" maxLength={7}
                style={{ ...S.input,flex:1,padding:"7px 10px",fontSize:13,fontFamily:"monospace" }}/>
              <div style={{ width:36,height:36,borderRadius:8,background:frameColorInput,border:"1px solid rgba(255,255,255,0.15)",flexShrink:0 }}/>
            </div>
          </div>
        )}

        {/* Frame image upload (frame tab) */}
        {tab==="frame"&&(
          <div style={{ background:"rgba(255,255,255,0.03)",border:`2px solid ${altar.frameCustomImage?"rgba(192,132,252,0.5)":"rgba(255,255,255,0.07)"}`,borderRadius:12,padding:"12px 14px",marginBottom:12 }}>
            <div style={{ fontSize:12,fontWeight:700,color:"#c084fc",marginBottom:8 }}>📁 フレーム画像をアップロード</div>
            <div style={{ display:"flex",gap:10,alignItems:"flex-start" }}>
              <div style={{ width:72,height:72,borderRadius:10,border:"2px dashed rgba(192,132,252,0.3)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,0.02)" }}
                onClick={()=>customFrameRef.current?.click()}>
                {altar.frameCustomImage
                  ? <img src={altar.frameCustomImage} alt="frame" style={{ width:"100%",height:"100%",objectFit:"contain" }}/>
                  : <div style={{ textAlign:"center",color:"#7c6a9a",fontSize:10 }}>📷<br/>選択</div>}
                <input ref={customFrameRef} type="file" accept="image/png,image/webp,image/gif" onChange={handleCustomFrameFile} style={{ display:"none" }}/>
              </div>
              <div style={{ flex:1,display:"flex",flexDirection:"column",gap:6 }}>
                <div style={{ fontSize:9,color:"#6b7280",lineHeight:1.5 }}>透過PNG推奨・5MB以下<br/>祭壇の枠に重ねて表示されます</div>
                <div style={{ background:"rgba(192,132,252,0.07)",border:"1px solid rgba(192,132,252,0.2)",borderRadius:8,padding:"6px 10px",fontSize:10,color:"#d8b4fe",lineHeight:1.6 }}>
                  💡 <a href="https://sozaino.site/" target="_blank" rel="noreferrer" style={{ color:"#c084fc",fontWeight:700 }}>OKUMONO（sozaino.site）</a> でフリー素材を探せます
                </div>
                <div style={{ background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.25)",borderRadius:8,padding:"6px 10px",fontSize:10,color:"#fbbf24",lineHeight:1.6 }}>
                  ⚠️ アップロードする画像は、<strong>商用利用可のフリー素材・自作画像</strong>など、使用権のあるものをご使用ください。他者の著作物の無断使用は禁止です。
                </div>
                {altar.frameCustomImage&&<button onClick={()=>onUpdateAltar({frameCustomImage:null})} style={{ padding:"4px 10px",borderRadius:8,border:"1px solid rgba(239,68,68,0.3)",background:"transparent",color:"#ef4444",fontSize:11,cursor:"pointer" }}>✕ 削除</button>}
              </div>
            </div>
          </div>
        )}

        {/* Items grid */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,maxHeight:340,overflowY:"auto" }}>
          {items.map(mat=>{
            const active = isActive(mat);
            return (
              <div key={mat.id} onClick={()=>toggle(mat)}
                style={{ borderRadius:12,padding:"12px 8px",textAlign:"center",cursor:"pointer",transition:"all 0.2s",position:"relative",
                  background:active?"rgba(192,132,252,0.2)":"rgba(255,255,255,0.04)",
                  border:`2px solid ${active?"#c084fc":"rgba(255,255,255,0.08)"}` }}>
                {active&&<div style={{ position:"absolute",top:5,right:5,width:14,height:14,borderRadius:"50%",background:"#c084fc",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900 }}>✓</div>}
                {mat.type==="deco"&&active&&(()=>{ const cnt=(altar.decoItems||[]).filter(d=>d.materialId===mat.id).length; return cnt>0?<div style={{ position:"absolute",bottom:5,right:5,fontSize:9,background:"rgba(232,121,249,0.3)",color:"#e879f9",borderRadius:6,padding:"1px 5px",fontWeight:700 }}>×{cnt}</div>:null; })()}
                {mat.image
                  ? <img src={mat.image} alt={mat.name} style={{ width:44,height:44,objectFit:"contain",marginBottom:4,display:"block",margin:"0 auto 4px" }}/>
                  : <div style={{ fontSize:28,marginBottom:4 }}>{mat.emoji}</div>}
                <div style={{ fontSize:11,fontWeight:700,color:active?"#c084fc":"#f0e8ff" }}>{mat.name}</div>
                <div style={{ fontSize:9,color:"#7c6a9a",marginTop:2 }}>{mat.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Custom deco upload — shown in deco tab */}
        {tab==="deco"&&(
          <div style={{ background:"rgba(232,121,249,0.06)",border:"1px solid rgba(232,121,249,0.2)",borderRadius:12,padding:"12px 14px",marginBottom:12 }}>
            <div style={{ fontSize:12,fontWeight:700,color:"#e879f9",marginBottom:8 }}>📁 自分で描いたデコをアップロード</div>
            <div style={{ display:"flex",gap:8,alignItems:"flex-start" }}>
              {/* Preview / upload area */}
              <div style={{ width:72,height:72,borderRadius:10,border:"2px dashed rgba(232,121,249,0.3)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,0.02)" }}
                onClick={()=>customDecoRef.current?.click()}>
                {customDecoImg
                  ? <img src={customDecoImg} alt="preview" style={{ width:"100%",height:"100%",objectFit:"contain" }}/>
                  : <div style={{ textAlign:"center",color:"#7c6a9a",fontSize:10 }}>📷<br/>選択</div>
                }
                <input ref={customDecoRef} type="file" accept="image/png,image/gif,image/webp" onChange={handleCustomDecoFile} style={{ display:"none" }}/>
              </div>
              <div style={{ flex:1,display:"flex",flexDirection:"column",gap:6 }}>
                <input value={customDecoName} onChange={e=>setCustomDecoName(e.target.value)} placeholder="名前（省略可）" style={{ ...S.input,padding:"6px 10px",fontSize:12 }} maxLength={20}/>
                <div style={{ fontSize:9,color:"#6b7280",lineHeight:1.5 }}>PNG推奨・透過対応・3MB以下<br/>アイビスペイントで書き出したものをそのまま使えます</div>
                <div style={{ background:"rgba(129,140,248,0.07)",border:"1px solid rgba(129,140,248,0.2)",borderRadius:8,padding:"6px 10px",fontSize:10,color:"#a5b4fc",lineHeight:1.6 }}>
                  💡 <strong style={{ color:"#c7d2fe" }}>素材をお探しですか？</strong><br/>
                  <a href="https://sozaino.site/" target="_blank" rel="noreferrer" style={{ color:"#818cf8",fontWeight:700 }}>OKUMONO（sozaino.site）</a> はVTuber向けフリー素材サイトです。商用利用可・登録不要。
                </div>
                <button onClick={addCustomDeco} disabled={!customDecoImg}
                  style={{ padding:"6px",borderRadius:8,border:"none",background:customDecoImg?"linear-gradient(135deg,#e879f9,#818cf8)":"rgba(255,255,255,0.06)",color:customDecoImg?"#fff":"#4b5563",fontSize:11,fontWeight:700,cursor:customDecoImg?"pointer":"default" }}>
                  ＋ 祭壇に追加
                </button>
              </div>
            </div>
          </div>
        )}

        {tab==="deco"&&(altar.decoItems||[]).length>0&&(
          <div style={{ marginTop:8,display:"flex",justifyContent:"flex-end" }}>
            <button onClick={()=>onUpdateAltar({decoItems:[]})} style={{ fontSize:11,color:"#ef4444",background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"3px 10px",cursor:"pointer" }}>🗑 全デコを削除</button>
          </div>
        )}
        <div style={{ marginTop:8,padding:"8px 12px",background:"rgba(192,132,252,0.06)",border:"1px solid rgba(192,132,252,0.15)",borderRadius:10,fontSize:11,color:"#a5b4fc",lineHeight:1.6 }}>
          🎀 <strong style={{ color:"#c084fc" }}>デコの使い方</strong>：タップで祭壇に追加 → ドラッグで移動 → タップして選択でサイズ変更・削除
        </div>
        <div style={{ marginTop:8,fontSize:10,color:"#4b5563",textAlign:"center" }}>
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
function UpgradeModal({ onUpgrade, onClose, plan }) {
  const [processing, setProcessing] = useState(false);

  const FEATURES = [
    { icon:"⛩", label:"祭壇を作れる数", free:"1つまで", pro:"無制限" },
    { icon:"🌟", label:"推し別グッズ管理", free:"✗", pro:"✓" },
    { icon:"📸", label:"シェア画像・URL", free:"✓", pro:"✓" },
    { icon:"🎨", label:"素材・テンプレート", free:"✓", pro:"✓" },
  ];

  const handleUpgrade = () => {
    setProcessing(true);
    setTimeout(() => { setProcessing(false); onUpgrade(); }, 800);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth:380 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:17,fontWeight:800,color:"#f59e0b" }}>👑 PROプランへアップグレード</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>

        {/* Feature comparison */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex",padding:"4px 0 8px",borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
            <span style={{ flex:1,fontSize:10,color:"#6b7280" }}></span>
            <span style={{ fontSize:10,color:"#9ca3af",width:56,textAlign:"center",fontWeight:600 }}>FREE</span>
            <span style={{ fontSize:10,color:"#f59e0b",width:56,textAlign:"center",fontWeight:700 }}>PRO</span>
          </div>
          {FEATURES.map(f=>(
            <div key={f.label} style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
              <span style={{ fontSize:14,width:22,textAlign:"center" }}>{f.icon}</span>
              <span style={{ flex:1,fontSize:12,color:"#d1d5db" }}>{f.label}</span>
              <span style={{ fontSize:11,color:"#6b7280",width:56,textAlign:"center" }}>{f.free}</span>
              <span style={{ fontSize:11,color:"#4ade80",fontWeight:700,width:56,textAlign:"center" }}>{f.pro}</span>
            </div>
          ))}
        </div>

        {plan==="pro"
          ? <div style={{ textAlign:"center",padding:"12px",background:"rgba(245,158,11,0.1)",borderRadius:12,border:"1px solid rgba(245,158,11,0.3)",fontSize:13,color:"#f59e0b",fontWeight:700,marginBottom:12 }}>
              ✓ 現在PROプランです
            </div>
          : <>
              <button onClick={handleUpgrade} disabled={processing}
                style={{ width:"100%",padding:"13px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#f59e0b,#e879f9)",color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer",marginBottom:8 }}>
                {processing ? "処理中…" : "PROプランにアップグレード"}
              </button>
              <div style={{ fontSize:10,color:"#4b5563",textAlign:"center",lineHeight:1.7 }}>
                ※ 現在はデモ版のため課金は発生しません。<br/>正式リリース時にStripe決済を実装予定です。
              </div>
            </>
        }
      </div>
    </div>
  );
}

// ─── Template Modal ───────────────────────────────────────────
function TemplateModal({ current, customColors, onSelect, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:500 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:18,fontWeight:800,color:"#e879f9" }}>🎨 テンプレート</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
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
        <div style={{ marginTop:12,padding:"8px 12px",background:"rgba(129,140,248,0.06)",border:"1px solid rgba(129,140,248,0.15)",borderRadius:10,fontSize:11,color:"#a5b4fc",lineHeight:1.6 }}>
          💡 背景の色やアクセントカラーを細かく変えたい場合は <strong style={{ color:"#818cf8" }}>🌌 背景 → ✏ カスタム</strong> から設定できます
        </div>
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
      ctx.fillStyle=template.accent; ctx.font="bold 15px sans-serif"; ctx.textAlign="center";
      const topLabel = altar.hideEmojiDecor ? altar.name : `${template.emoji}  ${altar.name}  ${template.emoji}`;
      ctx.fillText(topLabel, W/2, 34);
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
  const [name,setName]           = useState("");
  const [series,setSeries]       = useState("");
  const [status,setStatus]       = useState("owned");
  const [goodType,setGoodType]   = useState("other");
  const [imgMode,setImgMode]     = useState("emoji"); // "emoji"|"upload"|"url"
  const [image,setImage]         = useState(null);
  const [emojiInput,setEmojiInput] = useState("📦");  // free: picker selection | pro: free text
  const [officialUrl,setOfficialUrl] = useState("");
  const [purchaseDate,setPurchaseDate] = useState("");
  const [releaseDate,setReleaseDate]   = useState("");
  const [memo,setMemo]           = useState("");
  const [characterId,setCharacterId] = useState(null);
  const [error,setError]         = useState("");
  const [imgWarn,setImgWarn]     = useState(""); // スクショ検出警告
  const [proofImage,setProofImage] = useState(null); // 手持ち証明写真
  const [receiptImage,setReceiptImage] = useState(null); // 購入確認メールスクショ
  const [removingBg,setRemovingBg] = useState(false);
  const [autoBgRemove,setAutoBgRemove] = useState(true);
  const fileRef = useRef(null);
  const proofRef = useRef(null);
  const receiptRef = useRef(null);

  // Free plan emoji picker options
  const EMOJI_PICKS = ["📦","🧸","🖼️","🪆","🎀","🎵","📚","🎮","☕","⭐","🌸","💎","🎪","🖊️","🎭","🏆","🃏","🔵","🎰","🌙","🔥","🐱","🦊","🐰","🌈"];

  // スクショ・EC画像っぽいか判定
  const checkImageTrust = async(file) => {
    try {
      const { default: exifr } = await import("exifr");
      const exif = await exifr.parse(file, { pick:["Make","Model","DateTime","DateTimeOriginal"] });
      if (exif?.Make || exif?.Model || exif?.DateTimeOriginal) {
        setImgWarn(""); // カメラ撮影 → 信頼できる
      } else {
        setImgWarn("⚠️ この画像にはカメラ情報がありません。スクリーンショットや商品画像の可能性があります。手持ち写真の登録を推奨します。");
      }
    } catch { setImgWarn(""); }
  };

  const handleFile = async(e) => {
    const f=e.target.files[0]; if(!f) return;
    if(f.size>5*1024*1024){setError("5MB以下にしてください");return;}
    setImgWarn("");
    checkImageTrust(f); // 非同期でEXIFチェック（ブロックしない）
    if (autoBgRemove) {
      setRemovingBg(true); setError("");
      try {
        const { removeBackground } = await import("@imgly/background-removal");
        const blob = await removeBackground(f, { output: { format:"image/png", quality:1 } });
        setImage(await readFileAsDataURL(blob));
      } catch {
        setImage(await readFileAsDataURL(f));
        setError("背景除去に失敗しました。元の画像で登録します。");
      } finally { setRemovingBg(false); }
    } else {
      setImage(await readFileAsDataURL(f)); setError("");
    }
  };

  const handleProofFile = async(e) => {
    const f=e.target.files[0]; if(!f) return;
    if(f.size>5*1024*1024){setError("証明写真は5MB以下にしてください");return;}
    setProofImage(await readFileAsDataURL(f));
  };

  const handleReceiptFile = async(e) => {
    const f=e.target.files[0]; if(!f) return;
    if(f.size>5*1024*1024){setError("購入確認画像は5MB以下にしてください");return;}
    setReceiptImage(await readFileAsDataURL(f));
  };

  const resolvedEmoji = emojiInput || "📦";

  const today = new Date().toISOString().split("T")[0];

  const submit = () => {
    if(!name.trim()){setError("グッズ名を入力してください");return;}
    if(imgMode==="url"&&officialUrl&&!/^https?:\/\/.+/.test(officialUrl)){setError("URLはhttpまたはhttpsで始めてください");return;}
    if(purchaseDate && purchaseDate > today){setError("購入日に未来の日付は設定できません");return;}
    onAdd({
      id:newUid(), name:name.trim(), series:series.trim(), status, goodType,
      image: imgMode==="upload"?image:null,
      emoji: resolvedEmoji,
      officialUrl: officialUrl.trim()||null,
      purchaseDate, releaseDate, memo:memo.trim(), characterId,
      proofImage: proofImage||null,    // 手持ち証明写真
      receiptImage: receiptImage||null, // 購入確認メールスクショ
      createdAt:new Date().toISOString(),
    });
    onClose();
  };

  // 「持ってる」は画像アップロードのみ・タブ非表示
  useEffect(()=>{
    if(status==="owned") setImgMode("upload");
  },[status]);

  // Image mode tabs: "欲しい"なら "emoji" と "url" を優先表示、"持ってる"は非表示
  const imgTabs = status==="wanted"
    ? [["emoji","アイコン"],["url","公式URL"],["upload","画像"]]
    : status==="owned"
      ? null // タブ非表示
      : [["emoji","アイコン"],["upload","画像"],["url","公式URL"]];

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        {/* Drag handle */}
        <div style={{ width:40,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",margin:"-4px auto 14px",flexShrink:0 }}/>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:18,fontWeight:800,color:"#e879f9" }}>グッズを追加</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>

        {/* Status */}
        <div style={{ display:"flex",gap:8,marginBottom:14 }}>
          {Object.entries(STATUS).map(([k,v])=>(
            <button key={k} onClick={()=>setStatus(k)} style={{ flex:1,padding:"8px 4px",borderRadius:12,fontSize:12,fontWeight:700,cursor:"pointer",background:status===k?v.bg:"transparent",color:status===k?v.color:"#666",border:`2px solid ${status===k?v.color:"transparent"}` }}>{v.icon} {v.label}</button>
          ))}
        </div>

        {/* Image mode tabs（「持ってる」は非表示） */}
        {status==="owned"
          ? <div style={{ fontSize:11,color:"#a78bfa",marginBottom:10,padding:"6px 10px",background:"rgba(167,139,250,0.08)",borderRadius:10,border:"1px solid rgba(167,139,250,0.2)" }}>
              📷 持っているグッズは画像アップロードが必要です
            </div>
          : imgTabs && <div style={{ display:"flex",gap:6,marginBottom:12 }}>
              {imgTabs.map(([m,l])=>(
                <button key={m} onClick={()=>setImgMode(m)} style={{ flex:1,padding:"6px",borderRadius:10,border:`1px solid ${imgMode===m?"rgba(232,121,249,0.4)":"rgba(255,255,255,0.1)"}`,background:imgMode===m?"rgba(232,121,249,0.15)":"transparent",color:imgMode===m?"#e879f9":"#9ca3af",fontSize:11,fontWeight:600,cursor:"pointer" }}>{l}</button>
              ))}
            </div>
        }

        {/* Emoji / icon */}
        {imgMode==="emoji" && (<>
          {isPro ? (
            <div style={S.fieldGroup}>
              <label style={S.label}>アイコン（PRO: 自由入力）<span style={{ color:"#c084fc",marginLeft:4 }}>👑</span></label>
              <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                <div style={{ fontSize:36,width:52,height:52,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(255,255,255,0.05)",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",flexShrink:0 }}>{resolvedEmoji}</div>
                <input value={emojiInput} onChange={e=>setEmojiInput(e.target.value)} placeholder="絵文字を入力 例: 🌸✨" style={{ ...S.input,flex:1 }} maxLength={10}/>
              </div>
              <div style={{ fontSize:10,color:"#6b7280",marginTop:4 }}>複数絵文字や記号も入力できます（例: 🎪🎀）</div>
            </div>
          ) : (
            <div style={{ marginBottom:14 }}>
              <label style={S.label}>アイコン</label>
              <div style={{ display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center" }}>
                {EMOJI_PICKS.map(e=>(
                  <button key={e} onClick={()=>setEmojiInput(e)} style={{ fontSize:22,width:40,height:40,borderRadius:8,border:`2px solid ${emojiInput===e?"#e879f9":"transparent"}`,background:"rgba(255,255,255,0.05)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>{e}</button>
                ))}
              </div>
              <div style={{ fontSize:10,color:"#6b7280",marginTop:6,textAlign:"center" }}>
                👑 PROプランで絵文字を自由入力できます
              </div>
            </div>
          )}
        </>)}

        {/* Upload */}
        {imgMode==="upload" && (
          <>
            {/* 背景除去トグル */}
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,padding:"6px 10px",background:"rgba(129,140,248,0.07)",borderRadius:10,border:"1px solid rgba(129,140,248,0.2)" }}>
              <span style={{ fontSize:12,color:"#a5b4fc" }}>✨ 背景を自動で除去する</span>
              <div onClick={()=>setAutoBgRemove(v=>!v)} style={{ width:36,height:20,borderRadius:10,background:autoBgRemove?"#818cf8":"rgba(255,255,255,0.1)",cursor:"pointer",position:"relative",transition:"background 0.2s" }}>
                <div style={{ position:"absolute",top:2,left:autoBgRemove?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s" }}/>
              </div>
            </div>
            <div style={{ border:"2px dashed rgba(232,121,249,0.3)",borderRadius:12,height:110,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:removingBg?"default":"pointer",marginBottom:8,color:"#7c6a9a",overflow:"hidden",position:"relative" }} onClick={()=>!removingBg&&fileRef.current?.click()}>
              {removingBg
                ? <><div style={{ fontSize:22,marginBottom:4 }}>✨</div><div style={{ fontSize:12,color:"#a5b4fc" }}>背景を除去中…</div></>
                : image
                  ? <img src={image} alt="preview" style={{ width:"100%",height:"100%",objectFit:"contain" }}/>
                  : <><div style={{ fontSize:26,marginBottom:5 }}>📷</div><div style={{ fontSize:12 }}>タップして画像を選択（5MB以下）</div></>
              }
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }}/>
            </div>
          </>
        )}

        {/* Official URL */}
        {imgMode==="url" && (
          <div style={S.fieldGroup}>
            <label style={S.label}>公式サイトURL</label>
            <input value={officialUrl} onChange={e=>setOfficialUrl(e.target.value)} placeholder="https://shop.nijisanji.jp/..." style={S.input} maxLength={300}/>
            <div style={{ fontSize:10,color:"#6b7280",marginTop:4 }}>
              公式ショップのページURLを貼り付けると、欲しいグッズとして登録できます
            </div>
            {officialUrl && (
              <a href={officialUrl} target="_blank" rel="noreferrer" style={{ display:"inline-block",marginTop:6,fontSize:11,color:"#818cf8",textDecoration:"underline" }}>🔗 URLを確認する</a>
            )}
          </div>
        )}

        {/* Fields */}
        <div style={S.fieldGroup}><label style={S.label}>グッズ名 *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="例: 月ノ美兎 アクリルスタンド" style={S.input} maxLength={60}/></div>
        <div style={S.fieldGroup}><label style={S.label}>シリーズ / タグ</label><input value={series} onChange={e=>setSeries(e.target.value)} placeholder="例: にじさんじ" style={S.input} maxLength={40}/></div>

        <div style={S.fieldGroup}>
          <label style={S.label}>グッズの種類</label>
          <div style={{ display:"flex",flexWrap:"wrap",gap:5 }}>
            {GOOD_TYPES.map(t=>(
              <button key={t.id} onClick={()=>setGoodType(t.id)} style={{ padding:"4px 10px",borderRadius:20,border:`1px solid ${goodType===t.id?"rgba(232,121,249,0.5)":"rgba(255,255,255,0.1)"}`,background:goodType===t.id?"rgba(232,121,249,0.15)":"transparent",color:goodType===t.id?"#e879f9":"#9ca3af",fontSize:11,fontWeight:600,cursor:"pointer" }}>{t.emoji} {t.label}</button>
            ))}
          </div>
        </div>

        {isPro&&characters.length>0&&(
          <div style={S.fieldGroup}>
            <label style={S.label}>推し <span style={{ color:"#c084fc" }}>👑</span></label>
            <select value={characterId||""} onChange={e=>setCharacterId(e.target.value||null)} style={{ ...S.input,cursor:"pointer" }}>
              <option value="">— 未設定</option>
              {characters.map(c=><option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </div>
        )}

        {status==="owned"&&<div style={S.fieldGroup}><label style={S.label}>購入日</label><input type="date" value={purchaseDate} max={today} onChange={e=>setPurchaseDate(e.target.value)} style={S.input}/></div>}
        {status==="reserved"&&<div style={S.fieldGroup}><label style={S.label}>発売予定日</label><input type="date" value={releaseDate} onChange={e=>setReleaseDate(e.target.value)} style={S.input}/></div>}
        <div style={S.fieldGroup}><label style={S.label}>メモ</label><textarea value={memo} onChange={e=>setMemo(e.target.value)} placeholder="イベント限定品など" style={{ ...S.input,height:48,resize:"none" }} maxLength={100}/></div>

        {/* スクショ警告 */}
        {imgWarn && (
          <div style={{ background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:10,padding:"8px 12px",fontSize:11,color:"#fbbf24",marginBottom:10,lineHeight:1.6 }}>
            {imgWarn}
          </div>
        )}

        {/* 証明写真（持ってる場合のみ） */}
        {status==="owned" && (
          <div style={{ background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:10,padding:"10px 12px",marginBottom:12 }}>
            <div style={{ fontSize:12,color:"#4ade80",fontWeight:700,marginBottom:6 }}>📋 所有証明（任意）</div>
            <div style={{ fontSize:11,color:"#86efac",marginBottom:10,lineHeight:1.6 }}>どちらか一方でも登録すると <strong>✓ 証明済み</strong> バッジが付きます。</div>

            {/* 手持ち写真 */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:11,color:"#6ee7b7",fontWeight:700,marginBottom:6 }}>✋ 手持ち写真</div>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div onClick={()=>proofRef.current?.click()} style={{ width:64,height:64,borderRadius:10,border:"2px dashed rgba(74,222,128,0.4)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",flexShrink:0 }}>
                  {proofImage?<img src={proofImage} alt="proof" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>:<span style={{ fontSize:22 }}>📸</span>}
                </div>
                <div style={{ fontSize:11,color:"#6ee7b7",lineHeight:1.7 }}>
                  グッズを手に持って撮った写真<br/>
                  <span style={{ color:"#fca5a5" }}>商品画像・スクショはNGです</span>
                </div>
              </div>
              <input ref={proofRef} type="file" accept="image/*" onChange={handleProofFile} style={{ display:"none" }}/>
            </div>

            {/* 購入確認メールスクショ */}
            <div>
              <div style={{ fontSize:11,color:"#6ee7b7",fontWeight:700,marginBottom:6 }}>📧 購入確認メール・注文確認画面</div>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <div onClick={()=>receiptRef.current?.click()} style={{ width:64,height:64,borderRadius:10,border:"2px dashed rgba(74,222,128,0.4)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",flexShrink:0 }}>
                  {receiptImage?<img src={receiptImage} alt="receipt" style={{ width:"100%",height:"100%",objectFit:"cover" }}/>:<span style={{ fontSize:22 }}>📩</span>}
                </div>
                <div style={{ fontSize:11,color:"#6ee7b7",lineHeight:1.7 }}>
                  ECサイトの注文確認メールや<br/>
                  注文履歴ページのスクショでOK
                </div>
              </div>
              <input ref={receiptRef} type="file" accept="image/*" onChange={handleReceiptFile} style={{ display:"none" }}/>
            </div>
          </div>
        )}

        {status==="wanted" && (
          <div style={{ background:"rgba(96,165,250,0.07)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:10,padding:"8px 12px",fontSize:11,color:"#93c5fd",marginBottom:12,lineHeight:1.6 }}>
            💡 欲しいグッズは公式サイトのURLを貼り付けて登録できます。画像が手元になくてもOK！
          </div>
        )}
        {status!=="wanted" && (
          <div style={{ background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.18)",borderRadius:10,padding:"8px 12px",fontSize:11,color:"#fbbf24",marginBottom:12,lineHeight:1.6 }}>
            ⚠ 実際に所持・購入・予約したグッズのみ登録してください
          </div>
        )}

        {error&&<div style={{ color:"#f87171",fontSize:12,marginBottom:10,fontWeight:600 }}>{error}</div>}
        <button onClick={submit} style={{ width:"100%",padding:"12px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer" }}>追加する</button>
      </div>
    </div>
  );
}

// ─── Hina Stage ──────────────────────────────────────────────
// Pyramid/tiered cake stand layout — rows get narrower toward the top
function HinaStage({ hinaShelf, template, goodById, isDark, viewingShared, hinaDragSrcGood, hinaDragSrcCell, hinaHoverCell, setHinaDragSrcGood, setHinaDragSrcCell, setHinaHoverCell, onDrop, onRemove, shelfStyleId }) {
  const ss = SHELF_STYLES.find(s=>s.id===shelfStyleId)||SHELF_STYLES[0];
  // hinaShelf rows: index 0 = widest (bottom), last = narrowest (top)
  // We render top-to-bottom visually so reverse for display
  const rows = [...hinaShelf].reverse(); // top row (narrowest) first visually

  // Each row is a tier of the cake stand
  // Width shrinks as we go up: bottom row takes full width, top row is narrow
  const totalRows = rows.length;

  return (
    <div style={{ padding:"10px 16px 16px",display:"flex",flexDirection:"column",gap:0,alignItems:"center" }}>
      {rows.map((row,displayIdx)=>{
        // displayIdx 0 = top (narrow), last = bottom (wide)
        const dataIdx = totalRows - 1 - displayIdx; // index in hinaShelf data
        const widthPct = 30 + (displayIdx / (totalRows-1)) * 66; // top=30%, bottom=96%
        const tierH = 70 + (displayIdx * 4); // items get slightly bigger lower down
        const isHov = (r,c) => hinaHoverCell?.[0]===dataIdx && hinaHoverCell?.[1]===c;
        const isDragSrc = (c) => hinaDragSrcCell?.[0]===dataIdx && hinaDragSrcCell?.[1]===c;

        return (
          <div key={dataIdx} style={{ width:`${widthPct}%`,position:"relative",marginBottom:0 }}>
            {/* Items row */}
            <div style={{ display:"flex",justifyContent:"center",gap:4,paddingBottom:10,minHeight:tierH }}>
              {row.map((cellId,cIdx)=>{
                const good = cellId ? goodById(cellId) : null;
                const hov  = isHov(dataIdx,cIdx);
                const dsrc = isDragSrc(cIdx);
                return (
                  <div key={cIdx}
                    style={{ flex:1,maxWidth:80,minHeight:tierH-10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",borderRadius:8,background:hov?`${template.accent}28`:"transparent",outline:hov?`2px dashed ${template.accent}`:dsrc?"2px dashed rgba(255,255,255,0.2)":"none",opacity:dsrc?0.4:1,position:"relative",transition:"all 0.15s",padding:"0 2px" }}
                    onDragOver={e=>{e.preventDefault();setHinaHoverCell([dataIdx,cIdx]);}}
                    onDragLeave={()=>setHinaHoverCell(null)}
                    onDrop={()=>!viewingShared&&onDrop(dataIdx,cIdx)}
                  >
                    {good ? (
                      <div style={{ width:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",flex:1,cursor:"grab",position:"relative" }}
                        draggable={!viewingShared}
                        onDragStart={()=>setHinaDragSrcCell([dataIdx,cIdx])}
                        onDragEnd={()=>setHinaDragSrcCell(null)}>
                        {good.image
                          ? <img src={good.image} alt={good.name} style={{ width:"80%",flex:1,objectFit:"contain",minHeight:0 }}/>
                          : <div style={{ fontSize:28+displayIdx*2,flex:1,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1 }}>{good.emoji||"📦"}</div>
                        }
                        <div style={{ fontSize:8,color:isDark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)",textAlign:"center",width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2 }}>{good.name}</div>
                        {!viewingShared&&<button style={{ ...S_removeCellBtn }} onClick={()=>onRemove(dataIdx,cIdx)}>×</button>}
                      </div>
                    ) : (
                      !viewingShared&&<div style={{ fontSize:14,color:`${template.accent}44`,pointerEvents:"none",marginBottom:8 }}>{hov?"ここへ":"+"}</div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Tier plank */}
            <div style={{ height:ss.height||8,background:ss.plank,border:ss.plankBorder,boxShadow:ss.shadow,borderRadius:ss.radius,position:"relative",overflow:"hidden" }}>
              {ss.grain&&<div style={{ position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)" }}/>}
            </div>
            {/* Tier stand / pillar */}
            {displayIdx < totalRows-1 && (
              <div style={{ width:`${Math.max(20,widthPct*0.25)}%`,margin:"0 auto",height:14,background:ss.plank,boxShadow:ss.shadow,borderRadius:"0 0 6px 6px",opacity:0.8 }}/>
            )}
          </div>
        );
      })}
      {/* Base platform */}
      <div style={{ width:"105%",height:12,background:ss.plank,border:ss.plankBorder,boxShadow:ss.shadow,borderRadius:"0 0 8px 8px",marginTop:2 }}>
        {ss.grain&&<div style={{ position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)" }}/>}
      </div>
    </div>
  );
}

// Shared style for remove button (used in HinaStage)
const S_removeCellBtn = { position:"absolute",top:-4,right:-4,width:15,height:15,borderRadius:"50%",border:"none",background:"#ef4444",color:"#fff",fontSize:9,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,padding:0 };

// ─── Showcase Stage ──────────────────────────────────────────
// Vertical BOX display case: 3 rows × 4 cols with glass case styling
function ShowcaseStage({ showcaseShelf, template, goodById, isDark, viewingShared, dragSrcGood, dragSrcCell, hoverCell, setDragSrcCell, setHoverCell, onDrop, onRemove, shelfStyleId }) {
  const ss = SHELF_STYLES.find(s=>s.id===shelfStyleId)||SHELF_STYLES[0];
  return (
    <div style={{ padding:"10px 14px 14px",display:"flex",gap:8 }}>
      {/* Main case body */}
      <div style={{ flex:1,border:`2px solid ${template.border}`,borderRadius:12,overflow:"hidden",background:`${template.accent}06`,backdropFilter:"blur(2px)",boxShadow:`inset 0 0 30px ${template.accent}08, 0 4px 20px rgba(0,0,0,0.3)` }}>
        {/* Glass reflection */}
        <div style={{ position:"absolute",top:0,left:0,right:0,height:"40%",background:"linear-gradient(180deg,rgba(255,255,255,0.06),transparent)",pointerEvents:"none",borderRadius:"10px 10px 0 0" }}/>
        {showcaseShelf.map((row,rIdx)=>(
          <div key={rIdx} style={{ display:"flex",borderBottom:rIdx<showcaseShelf.length-1?`1px solid ${template.border}`:undefined }}>
            {row.map((cellId,cIdx)=>{
              const good = cellId ? goodById(cellId) : null;
              const isHov = hoverCell?.[0]===rIdx && hoverCell?.[1]===cIdx;
              const isDragSrc = dragSrcCell?.[0]===rIdx && dragSrcCell?.[1]===cIdx;
              return (
                <div key={cIdx}
                  style={{ flex:1,aspectRatio:"0.65",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",padding:"4px",borderRight:cIdx<row.length-1?`1px solid ${template.border}`:undefined,background:isHov?`${template.accent}20`:"transparent",outline:isDragSrc?"2px dashed rgba(255,255,255,0.2)":"none",opacity:isDragSrc?0.4:1,position:"relative",transition:"background 0.15s" }}
                  onDragOver={e=>{e.preventDefault();setHoverCell([rIdx,cIdx]);}}
                  onDragLeave={()=>setHoverCell(null)}
                  onDrop={()=>!viewingShared&&onDrop(rIdx,cIdx)}
                >
                  {good ? (
                    <div style={{ width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",cursor:"grab",position:"relative" }}
                      draggable={!viewingShared}
                      onDragStart={()=>setDragSrcCell([rIdx,cIdx])}
                      onDragEnd={()=>setDragSrcCell(null)}>
                      {good.image
                        ? <img src={good.image} alt={good.name} style={{ width:"85%",flex:1,objectFit:"contain",minHeight:0,filter:"drop-shadow(0 4px 8px rgba(0,0,0,0.4))" }}/>
                        : <div style={{ fontSize:34,flex:1,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,filter:"drop-shadow(0 4px 6px rgba(0,0,0,0.4))" }}>{good.emoji||"📦"}</div>
                      }
                      <div style={{ fontSize:8,color:isDark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)",textAlign:"center",width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",paddingBottom:2 }}>{good.name}</div>
                      {!viewingShared&&<button style={S_removeCellBtn} onClick={()=>onRemove(rIdx,cIdx)}>×</button>}
                    </div>
                  ) : (
                    !viewingShared&&<div style={{ fontSize:14,color:`${template.accent}33`,marginBottom:6 }}>{isHov?"ここへ":"+"}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        {/* Bottom plank */}
        <div style={{ height:ss.height||8,background:ss.plank,border:ss.plankBorder,boxShadow:ss.shadow,position:"relative",overflow:"hidden" }}>
          {ss.grain&&<div style={{ position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)" }}/>}
        </div>
      </div>
    </div>
  );
}

// ─── Flat Stage ───────────────────────────────────────────────
// Single wide display platform — great for showing off tall items like figures
function FlatStage({ flatShelf, template, goodById, isDark, viewingShared, dragSrcGood, dragSrcIdx, hoverIdx, setDragSrcIdx, setHoverIdx, onDrop, onRemove, shelfStyleId }) {
  const ss = SHELF_STYLES.find(s=>s.id===shelfStyleId)||SHELF_STYLES[0];
  // Items vary in height based on goodType for depth illusion
  const getItemScale = (i) => {
    // Center items appear bigger (front), side items smaller (back illusion)
    const center = (flatShelf.length-1)/2;
    const dist = Math.abs(i - center);
    return 1 - dist * 0.04; // subtle scale difference
  };
  return (
    <div style={{ padding:"10px 16px 0" }}>
      {/* Platform surface */}
      <div style={{ display:"flex",alignItems:"flex-end",justifyContent:"center",gap:4,marginBottom:0,minHeight:220,padding:"0 8px" }}>
        {flatShelf.map((cellId,i)=>{
          const good = cellId ? goodById(cellId) : null;
          const isHov = hoverIdx===i;
          const isDragSrc = dragSrcIdx===i;
          const scale = getItemScale(i);
          return (
            <div key={i}
              style={{ flex:1,maxWidth:80,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",minHeight:180,transform:`scale(${scale})`,transformOrigin:"bottom center",transition:"transform 0.2s",position:"relative" }}
              onDragOver={e=>{e.preventDefault();setHoverIdx(i);}}
              onDragLeave={()=>setHoverIdx(null)}
              onDrop={()=>!viewingShared&&onDrop(i)}
            >
              {/* Individual pedestal/platform under each item */}
              {good&&(
                <div style={{ position:"absolute",bottom:-2,left:"10%",right:"10%",height:6,background:ss.plank,borderRadius:"3px 3px 0 0",boxShadow:ss.shadow,zIndex:1 }}>
                  {ss.grain&&<div style={{ position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)" }}/>}
                </div>
              )}
              <div style={{ width:"100%",flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",background:isHov?`${template.accent}18`:"transparent",borderRadius:8,outline:isHov?`2px dashed ${template.accent}`:isDragSrc?"2px dashed rgba(255,255,255,0.2)":"none",opacity:isDragSrc?0.3:1,padding:"4px 2px 8px",position:"relative",transition:"all 0.15s" }}>
                {good ? (
                  <div style={{ width:"100%",height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",cursor:"grab",position:"relative" }}
                    draggable={!viewingShared}
                    onDragStart={()=>setDragSrcIdx(i)}
                    onDragEnd={()=>setDragSrcIdx(null)}>
                    {good.image
                      ? <img src={good.image} alt={good.name} style={{ width:"85%",maxHeight:160,objectFit:"contain",filter:`drop-shadow(0 6px 12px rgba(0,0,0,0.5))` }}/>
                      : <div style={{ fontSize:44,lineHeight:1,filter:"drop-shadow(0 6px 10px rgba(0,0,0,0.5))" }}>{good.emoji||"📦"}</div>
                    }
                    <div style={{ fontSize:8,color:isDark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)",textAlign:"center",width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:3 }}>{good.name}</div>
                    {!viewingShared&&<button style={{ ...S_removeCellBtn,top:0,right:0 }} onClick={()=>onRemove(i)}>×</button>}
                  </div>
                ) : (
                  !viewingShared&&<div style={{ fontSize:14,color:`${template.accent}33`,marginBottom:10 }}>{isHov?"ここへ":"+"}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {/* Wide base plank */}
      <div style={{ height:ss.height+4||12,background:ss.plank,border:ss.plankBorder,boxShadow:`${ss.shadow}, 0 6px 20px rgba(0,0,0,0.3)`,borderRadius:ss.radius,marginBottom:0,position:"relative",overflow:"hidden" }}>
        {ss.grain&&<div style={{ position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(90deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)" }}/>}
      </div>
      {/* Legs */}
      <div style={{ display:"flex",justifyContent:"space-between",padding:"0 20px" }}>
        {[0,1,2].map(i=>(
          <div key={i} style={{ width:14,height:20,background:ss.plank,borderRadius:"0 0 4px 4px",boxShadow:ss.shadow }}/>
        ))}
      </div>
    </div>
  );
}

// ─── Deco Layer ──────────────────────────────────────────────
// Renders deco stickers on top of altar (both shelf and free modes)
// Supports: 1-finger drag, 2-finger pinch(scale) + twist(rotate), button controls
function DecoLayer({ decoItems, isDark, viewingShared, draggingDeco, selectedDeco, onStartDrag, onSelect, onScale, onRotate, onUpdate, onRemove, onEndDrag }) {
  const pinchRef = useRef(null); // { id, initDist, initAngle, initScale, initRot }

  const ptDist  = (t1,t2) => Math.hypot(t2.clientX-t1.clientX, t2.clientY-t1.clientY);
  const ptAngle = (t1,t2) => Math.atan2(t2.clientY-t1.clientY, t2.clientX-t1.clientX) * 180 / Math.PI;

  if (!decoItems?.length) return null;

  return (
    <>
      {decoItems.map(item=>{
        const isCustom = item.materialId==="custom";
        const mat = isCustom ? {id:"custom",emoji:"🖼️",animated:false} : MATERIALS.find(m=>m.id===item.materialId);
        if (!mat && !isCustom) return null;
        const isSel     = selectedDeco===item.id;
        const isDragging = draggingDeco===item.id;
        const scale    = item.scale    || 1;
        const rotation = item.rotation || 0;

        const handleTouchStart = (e) => {
          if (viewingShared) return;
          e.stopPropagation();
          onSelect(item.id);
          if (e.touches.length >= 2) {
            // 2本指 → ピンチ開始（ドラッグ停止）
            onEndDrag?.();
            const t1=e.touches[0], t2=e.touches[1];
            pinchRef.current = {
              id: item.id,
              initDist:  ptDist(t1,t2),
              initAngle: ptAngle(t1,t2),
              initScale: scale,
              initRot:   rotation,
            };
          } else {
            // 1本指 → ドラッグ
            pinchRef.current = null;
            onStartDrag(e, item.id);
          }
        };

        const handleTouchMove = (e) => {
          const p = pinchRef.current;
          if (!p || p.id !== item.id || e.touches.length < 2) return;
          e.stopPropagation();
          const t1=e.touches[0], t2=e.touches[1];
          const newScale = Math.max(0.3, Math.min(5, p.initScale * (ptDist(t1,t2) / p.initDist)));
          const newRot   = p.initRot + (ptAngle(t1,t2) - p.initAngle);
          onUpdate(item.id, { scale: newScale, rotation: newRot });
        };

        const handleTouchEnd = (e) => {
          if (pinchRef.current?.id === item.id && e.touches.length < 2) {
            pinchRef.current = null;
          }
        };

        return (
          <div key={item.id}
            onMouseDown={e=>{ if(viewingShared) return; e.stopPropagation(); onSelect(item.id); onStartDrag(e,item.id); }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={e=>{ e.stopPropagation(); onSelect(item.id); }}
            style={{
              position:"absolute",
              left:item.x, top:item.y,
              transform:`translate(-50%,-50%) scale(${scale}) rotate(${rotation}deg)`,
              zIndex:(item.zIndex||50)+200,
              cursor:isDragging?"grabbing":viewingShared?"default":"grab",
              fontSize:36,
              lineHeight:1,
              filter:isSel?"drop-shadow(0 0 8px rgba(232,121,249,0.9))":"drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
              transition:isDragging?"none":"filter 0.2s",
              userSelect:"none",
              touchAction:"none",
            }}>
            {isCustom && item.customImage
              ? <img src={item.customImage} alt={item.customName||"デコ"} style={{ width:64,height:64,objectFit:"contain",display:"block" }}/>
              : mat?.image
              ? <img src={mat.image} alt={mat.name||"デコ"} style={{ width:64,height:64,objectFit:"contain",display:"block" }}/>
              : mat?.emoji||"🖼️"}

            {/* コントロールパネル（選択時） */}
            {isSel && !viewingShared && (
              <div style={{ position:"absolute",top:-40,left:"50%",transform:"translateX(-50%) rotate(0deg)",display:"flex",gap:3,background:isDark?"rgba(10,5,20,0.95)":"rgba(255,255,255,0.95)",borderRadius:22,padding:"5px 9px",border:"1px solid rgba(232,121,249,0.3)",boxShadow:"0 4px 16px rgba(0,0,0,0.4)",whiteSpace:"nowrap" }}>
                {[
                  { l:"↺", a:()=>onRotate(item.id,-15), tip:"左回転" },
                  { l:"↻", a:()=>onRotate(item.id,+15), tip:"右回転" },
                  { l:"−", a:()=>onScale(item.id,-0.2),  tip:"縮小"  },
                  { l:"+", a:()=>onScale(item.id,+0.2),  tip:"拡大"  },
                  { l:"🗑", a:()=>onRemove(item.id),      tip:"削除"  },
                ].map(b=>(
                  <button key={b.l}
                    onMouseDown={e=>{e.stopPropagation();b.a();}}
                    onTouchStart={e=>{e.stopPropagation();e.preventDefault();b.a();}}
                    title={b.tip}
                    style={{ width:24,height:24,border:"none",borderRadius:"50%",
                      background:b.l==="🗑"?"rgba(239,68,68,0.2)":"rgba(232,121,249,0.15)",
                      color:b.l==="🗑"?"#ef4444":"#e879f9",
                      fontSize:b.l==="🗑"?12:13,cursor:"pointer",fontWeight:900,padding:0,
                      display:"flex",alignItems:"center",justifyContent:"center" }}>{b.l}</button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Shelf Style Picker ──────────────────────────────────────
function ShelfStylePicker({ currentId, isPremium, onChange }) {
  const [open, setOpen] = useState(false);
  const current = SHELF_STYLES.find(s=>s.id===currentId)||SHELF_STYLES[0];
  return (
    <div style={{ position:"relative" }}>
      <button onClick={()=>setOpen(o=>!o)} style={{ ...S.modeBtn,border:"1px solid rgba(165,180,252,0.3)",color:"#a5b4fc" }}>
        {current.emoji} 棚素材
      </button>
      {open && (
        <div style={{ position:"absolute",top:36,left:0,background:"#1a1230",border:"1px solid rgba(165,180,252,0.2)",borderRadius:14,padding:10,zIndex:50,boxShadow:"0 8px 30px rgba(0,0,0,0.5)",minWidth:220 }}>
          <div style={{ fontSize:11,color:"#6b7280",marginBottom:8,fontWeight:600 }}>棚の素材を選ぶ</div>
          {SHELF_STYLES.map(ss=>{
            const locked = !ss.free && !isPremium;
            return (
              <div key={ss.id} onClick={()=>{ if(!locked){onChange(ss.id);setOpen(false); }}}
                style={{ display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:8,cursor:locked?"default":"pointer",background:currentId===ss.id?"rgba(165,180,252,0.15)":"transparent",marginBottom:2,opacity:locked?0.5:1 }}>
                {/* Plank preview */}
                <div style={{ width:40,height:ss.height||8,borderRadius:ss.radius,background:ss.plank,border:ss.plankBorder,boxShadow:ss.shadow,flexShrink:0 }}/>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:currentId===ss.id?"#a5b4fc":"#d1d5db" }}>{ss.emoji} {ss.name}</div>
                </div>
                {locked && <span style={{ fontSize:9,color:"#c084fc",background:"rgba(192,132,252,0.15)",borderRadius:6,padding:"1px 5px",fontWeight:700 }}>PRO</span>}
                {currentId===ss.id && <span style={{ fontSize:10,color:"#a5b4fc",fontWeight:700 }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Layer Panel (free mode) ──────────────────────────────────
// Shows stacking order and allows reordering for depth effect
function LayerPanel({ freeItems, goodById, onReorder, onScaleDepth }) {
  const sorted = [...freeItems].sort((a,b)=>(b.zIndex||0)-(a.zIndex||0)); // front to back
  if (sorted.length===0) return null;
  return (
    <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"10px 12px",marginBottom:12 }}>
      <div style={{ fontSize:11,fontWeight:700,color:"#a5b4fc",marginBottom:8 }}>🔲 レイヤー（前後）</div>
      <div style={{ display:"flex",flexDirection:"column",gap:4 }}>
        {sorted.map((item,idx)=>{
          const good=goodById(item.goodId);
          const isFront=idx===0;
          const isBack=idx===sorted.length-1;
          return (
            <div key={item.id} style={{ display:"flex",alignItems:"center",gap:8,padding:"5px 8px",background:"rgba(255,255,255,0.03)",borderRadius:8,border:"1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ fontSize:14,width:20,textAlign:"center" }}>{good?.emoji||"📦"}</span>
              <span style={{ flex:1,fontSize:11,color:"#d1d5db",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{good?.name||"?"}</span>
              <span style={{ fontSize:9,color:"#6b7280",width:28,textAlign:"center" }}>{isFront?"最前面":isBack?"最背面":""}</span>
              {/* Depth scale: further back = smaller + dimmer */}
              <input type="range" min={0.5} max={2.5} step={0.05} value={item.scale||1}
                onChange={e=>onScaleDepth(item.id,parseFloat(e.target.value))}
                style={{ width:60,accentColor:"#a5b4fc" }}/>
              <div style={{ display:"flex",gap:2 }}>
                <button onClick={()=>!isFront&&onReorder(item.id,"up")} disabled={isFront} style={{ width:18,height:18,border:"none",borderRadius:4,background:isFront?"rgba(255,255,255,0.03)":"rgba(165,180,252,0.15)",color:isFront?"#374151":"#a5b4fc",fontSize:10,cursor:isFront?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>↑</button>
                <button onClick={()=>!isBack&&onReorder(item.id,"down")} disabled={isBack} style={{ width:18,height:18,border:"none",borderRadius:4,background:isBack?"rgba(255,255,255,0.03)":"rgba(165,180,252,0.15)",color:isBack?"#374151":"#a5b4fc",fontSize:10,cursor:isBack?"default":"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>↓</button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:9,color:"#4b5563",marginTop:6 }}>↑↓ で前後を変更 · スライダーでサイズ調整（奥を小さくすると立体感が出ます）</div>
    </div>
  );
}

// ─── Auth Modal ──────────────────────────────────────────────
function AuthModal({ mode, session, onLogin, onLogout, onClose }) {
  const [tab, setTab]         = useState(mode==="account"?"account":"login");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  const handleAuth = async(type) => {
    if (!email.trim()||!password.trim()) { setError("メールアドレスとパスワードを入力してください"); return; }
    if (password.length<6) { setError("パスワードは6文字以上にしてください"); return; }
    setLoading(true); setError("");
    try {
      if (type==="signup") {
        await signUp(email, password);
        setSuccess("確認メールを送りました。メールのリンクをクリックしてから再度ログインしてください。");
      } else {
        const sess = await signIn(email, password);
        onLogin(sess);
      }
    } catch(e) {
      const msg = e.message||"";
      if (msg.includes("Invalid login")) setError("メールアドレスまたはパスワードが間違っています");
      else if (msg.includes("already registered")) setError("このメールアドレスはすでに登録されています");
      else if (msg.includes("Email not confirmed")) setError("メールアドレスが確認されていません。届いたメールのリンクをクリックしてください");
      else setError(msg||"エラーが発生しました");
    }
    setLoading(false);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:400 }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:40,height:4,borderRadius:2,background:"rgba(255,255,255,0.15)",margin:"-4px auto 14px" }}/>

        {/* Account tab (when logged in) */}
        {tab==="account" && session && (<>
          <div style={{ textAlign:"center",padding:"16px 0 20px" }}>
            <div style={{ fontSize:36,marginBottom:8 }}>✓</div>
            <div style={{ fontSize:16,fontWeight:800,color:"#4ade80",marginBottom:4 }}>ログイン中</div>
            <div style={{ fontSize:12,color:"#7c6a9a" }}>{session.user?.email}</div>
          </div>
          <div style={{ background:"rgba(34,197,94,0.07)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:12,padding:"12px 14px",marginBottom:16,fontSize:12,color:"#86efac",lineHeight:1.7 }}>
            ✓ データはクラウドに自動保存されています<br/>
            ✓ どのデバイスからでも同じデータが使えます
          </div>
          <button onClick={onLogout} style={{ width:"100%",padding:"12px",borderRadius:12,border:"1px solid rgba(239,68,68,0.3)",background:"rgba(239,68,68,0.08)",color:"#f87171",fontSize:14,fontWeight:700,cursor:"pointer" }}>
            ログアウト
          </button>
        </>)}

        {/* Login / Signup */}
        {tab!=="account" && (<>
          <div style={{ display:"flex",gap:8,marginBottom:20 }}>
            {[["login","ログイン"],["signup","新規登録"]].map(([t,l])=>(
              <button key={t} onClick={()=>{setTab(t);setError("");setSuccess("");}} style={{ flex:1,padding:"10px",borderRadius:12,border:`1px solid ${tab===t?"rgba(232,121,249,0.4)":"rgba(255,255,255,0.1)"}`,background:tab===t?"rgba(232,121,249,0.15)":"transparent",color:tab===t?"#e879f9":"#9ca3af",fontSize:14,fontWeight:700,cursor:"pointer" }}>{l}</button>
            ))}
          </div>

          <div style={{ background:"rgba(96,165,250,0.07)",border:"1px solid rgba(96,165,250,0.2)",borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:11,color:"#93c5fd",lineHeight:1.7 }}>
            {tab==="login"
              ? "ログインするとデータがクラウドに保存され、どのデバイスからでも使えます。"
              : "アカウントを作るとデータがクラウドに保存されます。無料で登録できます。"}
          </div>

          <div style={S.fieldGroup}>
            <label style={S.label}>メールアドレス</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email"
              placeholder="your@email.com" style={S.input} maxLength={100}
              onKeyDown={e=>e.key==="Enter"&&handleAuth(tab)}/>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>パスワード（6文字以上）</label>
            <input value={password} onChange={e=>setPass(e.target.value)} type="password"
              placeholder="••••••••" style={S.input} maxLength={100}
              onKeyDown={e=>e.key==="Enter"&&handleAuth(tab)}/>
          </div>

          {error && <div style={{ color:"#f87171",fontSize:12,marginBottom:10,fontWeight:600,lineHeight:1.5 }}>{error}</div>}
          {success && <div style={{ color:"#4ade80",fontSize:12,marginBottom:10,fontWeight:600,lineHeight:1.5 }}>{success}</div>}

          <button onClick={()=>handleAuth(tab)} disabled={loading}
            style={{ width:"100%",padding:"13px",borderRadius:14,border:"none",background:loading?"rgba(255,255,255,0.08)":"linear-gradient(135deg,#e879f9,#818cf8)",color:loading?"#4b5563":"#fff",fontSize:15,fontWeight:800,cursor:loading?"default":"pointer",marginBottom:12 }}>
            {loading?"処理中…":tab==="login"?"ログイン":"アカウントを作成"}
          </button>

          <div style={{ fontSize:10,color:"#4b5563",textAlign:"center",lineHeight:1.7 }}>
            ログインしなくてもSAIDANは使えます。<br/>
            ログインするとデータがクラウドに同期されます。
          </div>
        </>)}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const S = {
  root:{ fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif",minHeight:"100vh",background:"#0c0a14",color:"#f0e8ff",display:"flex",flexDirection:"column",userSelect:"none" },
  toast:{ position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",background:"#1e1535",color:"#e9d5ff",padding:"10px 22px",borderRadius:30,fontSize:13,fontWeight:700,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",zIndex:9999,border:"1px solid rgba(232,121,249,0.3)" },
  header:{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"rgba(12,10,20,0.97)",borderBottom:"1px solid rgba(232,121,249,0.12)",position:"sticky",top:0,zIndex:100 },
  logo:{ display:"flex",alignItems:"center",gap:8 },
  logoText:{ fontSize:16,fontWeight:900,letterSpacing:3,background:"linear-gradient(90deg,#e879f9,#818cf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" },
  logoSub:{ fontSize:10,color:"#7c6a9a" },
  navBtn:{ padding:"6px 13px",borderRadius:20,border:"1px solid rgba(232,121,249,0.18)",background:"transparent",color:"#9ca3af",fontSize:12,fontWeight:600,cursor:"pointer" },
  navBtnOn:{ background:"rgba(232,121,249,0.15)",color:"#e879f9",border:"1px solid rgba(232,121,249,0.4)" },
  bottomNav:{ display:"flex",position:"fixed",bottom:0,left:0,right:0,background:"rgba(10,8,18,0.97)",borderTop:"1px solid rgba(232,121,249,0.15)",zIndex:100,backdropFilter:"blur(10px)" },
  bottomNavBtn:{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,padding:"8px 4px 10px",border:"none",background:"transparent",color:"#6b7280",cursor:"pointer",transition:"all 0.15s" },
  bottomNavBtnOn:{ color:"#e879f9",background:"rgba(232,121,249,0.08)" },
  main:{ flex:1,padding:"18px 16px 88px",maxWidth:780,width:"100%",margin:"0 auto" },
  statsRow:{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:8,marginBottom:16 },
  statCard:{ background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 8px",textAlign:"center",border:"1px solid rgba(255,255,255,0.06)" },
  toolbar:{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8 },
  filterBtn:{ padding:"5px 12px",borderRadius:20,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"#9ca3af",fontSize:12,fontWeight:600,cursor:"pointer" },
  filterBtnOn:{ background:"rgba(232,121,249,0.15)",color:"#e879f9",border:"1px solid rgba(232,121,249,0.3)" },
  addBtn:{ padding:"8px 18px",borderRadius:20,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",boxShadow:"0 2px 12px rgba(232,121,249,0.3)" },
  grid:{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:8 },
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
  tray:{ display:"flex",gap:8,padding:"10px 12px",overflowX:"auto",flexWrap:"nowrap",WebkitOverflowScrolling:"touch" },
  trayItem:{ width:68,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3,position:"relative",background:"rgba(255,255,255,0.04)",borderRadius:10,padding:"8px 4px",border:"1px solid rgba(255,255,255,0.07)",transition:"all 0.15s" },
  trayItemImg:{ width:48,height:58,objectFit:"contain" },
  trayItemEmoji:{ fontSize:32,height:58,display:"flex",alignItems:"center",justifyContent:"center" },
  trayItemLabel:{ fontSize:9,color:"rgba(255,255,255,0.45)",textAlign:"center",width:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" },
  trayCheckBadge:{ position:"absolute",top:4,right:4,width:14,height:14,borderRadius:"50%",background:"#22c55e",color:"#fff",fontSize:8,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900 },
  nameSaveBtn:{ background:"#e879f9",color:"#fff",border:"none",borderRadius:12,padding:"4px 14px",fontSize:12,fontWeight:700,cursor:"pointer" },
  overlay:{ position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200,padding:"0 0 0 0" },
  modal:{ background:"#110d20",borderRadius:"20px 20px 0 0",padding:"20px 16px 32px",width:"100%",maxWidth:500,maxHeight:"92vh",overflowY:"auto",border:"1px solid rgba(232,121,249,0.22)",boxShadow:"0 -8px 40px rgba(0,0,0,0.6)" },
  confirmBox:{ background:"#110d20",borderRadius:16,padding:"28px 24px",maxWidth:320,width:"100%",border:"1px solid rgba(239,68,68,0.3)",textAlign:"center" },
  btnGhost:{ padding:"8px 20px",borderRadius:12,border:"1px solid rgba(255,255,255,0.15)",background:"transparent",color:"#9ca3af",fontSize:13,fontWeight:700,cursor:"pointer" },
  btnDanger:{ padding:"8px 20px",borderRadius:12,border:"none",background:"#ef4444",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer" },
  fieldGroup:{ marginBottom:11 },
  label:{ display:"block",fontSize:11,color:"#7c6a9a",fontWeight:700,marginBottom:4,letterSpacing:0.5 },
  input:{ width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:10,padding:"9px 12px",color:"#f0e8ff",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit" },
  emptyMsg:{ textAlign:"center",padding:40,color:"#6b7280" },
  emptyState:{ textAlign:"center",padding:"60px 20px",color:"#6b7280" },
};

// ─── Splash Screen ────────────────────────────────────────────
function SplashScreen({ fading }) {
  return (
    <div style={{
      position:"fixed", inset:0, background:"#0c0a14",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      zIndex:9999,
      transition:"opacity 0.4s ease, visibility 0.4s ease",
      opacity: fading ? 0 : 1,
      visibility: fading ? "hidden" : "visible",
      pointerEvents: fading ? "none" : "auto",
    }}>
      <style>{`
        @keyframes saidanFloat  { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-10px) scale(1.06)} }
        @keyframes saidanGlow   { 0%,100%{text-shadow:0 0 20px rgba(232,121,249,0.4)} 50%{text-shadow:0 0 40px rgba(232,121,249,0.9)} }
        @keyframes saidanFadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes saidanDot    { 0%,80%,100%{opacity:0.2;transform:scale(0.8)} 40%{opacity:1;transform:scale(1.2)} }
      `}</style>

      {/* Icon */}
      <div style={{ fontSize:72, animation:"saidanFloat 2.4s ease-in-out infinite", marginBottom:20 }}>⛩</div>

      {/* Title */}
      <div style={{
        fontSize:30, fontWeight:900, letterSpacing:6,
        background:"linear-gradient(135deg,#e879f9,#818cf8)",
        WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        animation:"saidanGlow 2s ease-in-out infinite, saidanFadeUp 0.5s ease forwards",
        marginBottom:8,
      }}>SAIDAN</div>

      {/* Subtitle */}
      <div style={{
        fontSize:12, color:"#7c6a9a", letterSpacing:2,
        animation:"saidanFadeUp 0.6s ease 0.15s both",
        marginBottom:40,
      }}>推しグッズ祭壇メーカー</div>

      {/* Loading dots */}
      <div style={{ display:"flex", gap:8 }}>
        {[0,1,2].map(i=>(
          <div key={i} style={{
            width:8, height:8, borderRadius:"50%",
            background:"#e879f9",
            animation:`saidanDot 1.4s ease-in-out ${i*0.22}s infinite`,
          }}/>
        ))}
      </div>
    </div>
  );
}

// ─── 利用規約 Modal ────────────────────────────────────────────
function TermsModal({ onClose }) {
  const H = ({children})=><div style={{ fontSize:13,fontWeight:800,color:"#c084fc",marginTop:20,marginBottom:6 }}>{children}</div>;
  const P = ({children})=><p style={{ fontSize:12,color:"#d1d5db",lineHeight:1.8,marginBottom:4 }}>{children}</p>;
  return (
    <div style={{ ...S.overlay,zIndex:4000,alignItems:"center" }} onClick={onClose}>
      <div style={{ ...S.modal,borderRadius:20,maxWidth:480,maxHeight:"85vh",padding:"24px 20px 32px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:17,fontWeight:800,color:"#c084fc" }}>📜 利用規約</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ fontSize:10,color:"#6b7280",marginBottom:16 }}>最終更新日：2026年5月30日</div>

        <H>第1条（サービスの内容）</H>
        <P>本規約は、SAIDAN（以下「本サービス」）の利用条件を定めるものです。本サービスは、推しグッズのコレクション管理・祭壇作成ができるウェブアプリケーションです。</P>

        <H>第2条（利用資格）</H>
        <P>本サービスは13歳以上の方が利用できます。13歳未満の方のご利用はお断りします。</P>

        <H>第3条（アカウント）</H>
        <P>1. ユーザーはメールアドレスとパスワードでアカウントを作成できます。</P>
        <P>2. アカウント情報の管理はユーザーの責任です。</P>
        <P>3. 不正利用が確認された場合、予告なくアカウントを削除する場合があります。</P>

        <H>第4条（ユーザーコンテンツ）</H>
        <P>1. ユーザーが投稿した画像・データの著作権はユーザーに帰属します。</P>
        <P>2. ユーザーは本サービスの運営に必要な範囲でのデータ利用を許諾するものとします。</P>
        <P>3. 第三者の著作権・肖像権を侵害するコンテンツの投稿は禁止します。</P>

        <H>第5条（禁止事項）</H>
        <P>・法令または公序良俗に反する行為</P>
        <P>・第三者の権利を侵害する行為</P>
        <P>・本サービスの運営を妨げる行為</P>
        <P>・商業目的での無断利用</P>

        <H>第6条（サービスの変更・停止）</H>
        <P>本サービスは予告なく内容の変更・停止・終了する場合があります。これによる損害について、運営は責任を負いません。</P>

        <H>第7条（免責事項）</H>
        <P>本サービスは現状有姿で提供されます。データの消失・システム障害・第三者サービスの障害による損害について、運営は責任を負いません。</P>

        <H>第8条（準拠法・管轄裁判所）</H>
        <P>本規約は日本法に準拠し、東京地方裁判所を第一審の管轄裁判所とします。</P>

        <H>お問い合わせ</H>
        <P>X（旧Twitter）: <a href="https://x.com/SAIDANdayo" target="_blank" rel="noreferrer" style={{ color:"#818cf8" }}>@SAIDANdayo</a></P>
        <P>Email: <a href="mailto:support.saidan@gmail.com" style={{ color:"#818cf8" }}>support.saidan@gmail.com</a></P>
      </div>
    </div>
  );
}

// ─── プライバシーポリシー Modal ────────────────────────────────
function PrivacyModal({ onClose }) {
  const H = ({children})=><div style={{ fontSize:13,fontWeight:800,color:"#c084fc",marginTop:20,marginBottom:6 }}>{children}</div>;
  const P = ({children})=><p style={{ fontSize:12,color:"#d1d5db",lineHeight:1.8,marginBottom:4 }}>{children}</p>;
  return (
    <div style={{ ...S.overlay,zIndex:4000,alignItems:"center" }} onClick={onClose}>
      <div style={{ ...S.modal,borderRadius:20,maxWidth:480,maxHeight:"85vh",padding:"24px 20px 32px" }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ fontSize:17,fontWeight:800,color:"#c084fc" }}>🔒 プライバシーポリシー</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ fontSize:10,color:"#6b7280",marginBottom:16 }}>最終更新日：2026年5月30日</div>

        <P>SAIDAN（以下「本サービス」）は、ユーザーのプライバシーを尊重し、個人情報を適切に管理します。</P>

        <H>1. 収集する情報</H>
        <P>・メールアドレス（アカウント登録時）</P>
        <P>・グッズ・祭壇データ（クラウド同期を利用した場合）</P>
        <P>・ユーザーがアップロードした画像</P>

        <H>2. 利用目的</H>
        <P>・サービスの提供・運営・改善</P>
        <P>・ユーザーの識別・認証</P>
        <P>・データのクラウド同期</P>

        <H>3. 第三者への提供</H>
        <P>以下のサービスを利用しており、これらへのデータ提供が発生します。</P>
        <P>・<strong style={{ color:"#e2e8f0" }}>Supabase</strong>（認証・データ保管） — <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" style={{ color:"#818cf8" }}>プライバシーポリシー</a></P>
        <P>上記以外の第三者に個人情報を提供することはありません。</P>

        <H>4. データの保管・削除</H>
        <P>データはSupabaseのサーバーに保管されます。アカウント削除・データ消去のご要望はお問い合わせください。</P>

        <H>5. ローカルストレージについて</H>
        <P>本サービスはデータ保存のためにブラウザのlocalStorageを使用します。ブラウザの設定から削除できます。</P>

        <H>6. 本ポリシーの変更</H>
        <P>内容を変更する場合は本ページで告知します。継続利用をもって同意とみなします。</P>

        <H>お問い合わせ</H>
        <P>X（旧Twitter）: <a href="https://x.com/SAIDANdayo" target="_blank" rel="noreferrer" style={{ color:"#818cf8" }}>@SAIDANdayo</a></P>
        <P>Email: <a href="mailto:support.saidan@gmail.com" style={{ color:"#818cf8" }}>support.saidan@gmail.com</a></P>
      </div>
    </div>
  );
}
