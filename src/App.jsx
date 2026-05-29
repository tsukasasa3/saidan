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

// ── Flower catalog (for bouquet builder) ─────────────────────
const FLOWERS = [
  // 無料
  { id:"fl_rose",      name:"バラ",       emoji:"🌹", color:"#e11d48", free:true,  desc:"定番の赤バラ"     },
  { id:"fl_pink_rose", name:"ピンクバラ", emoji:"🌸", color:"#f472b6", free:true,  desc:"やわらかピンク"   },
  { id:"fl_tulip",     name:"チューリップ",emoji:"🌷", color:"#f43f5e", free:true,  desc:"春の定番"         },
  { id:"fl_daisy",     name:"デイジー",   emoji:"🌼", color:"#fbbf24", free:true,  desc:"かわいい小花"     },
  { id:"fl_sunflower", name:"ひまわり",   emoji:"🌻", color:"#f59e0b", free:true,  desc:"元気な黄色"       },
  { id:"fl_cherry",    name:"桜",         emoji:"🌸", color:"#fda4af", free:true,  desc:"春の桜"           },
  // 有料（PRO or 個別購入）
  { id:"fl_lily",      name:"ユリ",       emoji:"🌺", color:"#c026d3", free:false, desc:"気品ある白ユリ",  price:120 },
  { id:"fl_lavender",  name:"ラベンダー", emoji:"💜", color:"#a855f7", free:false, desc:"癒しの紫",        price:120 },
  { id:"fl_carnation", name:"カーネーション",emoji:"💐",color:"#f9a8d4",free:false,desc:"感謝を込めて",    price:120 },
  { id:"fl_cosmos",    name:"コスモス",   emoji:"🌸", color:"#f0abfc", free:false, desc:"秋桜のやさしさ",  price:120 },
  { id:"fl_orchid",    name:"胡蝶蘭",    emoji:"🌺", color:"#e879f9", free:false, desc:"高貴な白",        price:150 },
  { id:"fl_babysbreath",name:"かすみ草",  emoji:"🤍", color:"#f1f5f9", free:false, desc:"花束を引き立てる",price:100 },
];

const RIBBON_COLORS = [
  { id:"rb_pink",   name:"ピンク",   color:"#f472b6" },
  { id:"rb_white",  name:"ホワイト", color:"#f8fafc" },
  { id:"rb_purple", name:"パープル", color:"#a855f7" },
  { id:"rb_red",    name:"レッド",   color:"#e11d48" },
  { id:"rb_gold",   name:"ゴールド", color:"#f59e0b" },
  { id:"rb_blue",   name:"ブルー",   color:"#60a5fa" },
  { id:"rb_green",  name:"グリーン", color:"#4ade80" },
  { id:"rb_black",  name:"ブラック", color:"#1e293b" },
];

const WRAP_STYLES = [
  { id:"wrap_round",   name:"丸ブーケ",   desc:"定番の丸い束"   },
  { id:"wrap_cascade", name:"カスケード", desc:"流れるように垂れ下がる" },
  { id:"wrap_posy",    name:"ポージー",   desc:"小ぶりでコンパクト" },
];

// ── 誕生花データベース（月ごと代表花） ──────────────────────
// 将来的に365日対応予定。まず12ヶ月の代表花から。
const BIRTH_FLOWERS_DB = [
  { month:1,  day:null, name:"スノードロップ", emoji:"🤍", color:"#f0f9ff", meaning:"希望・慰め",        flowerIds:["fl_babysbreath"] },
  { month:2,  day:null, name:"パンジー",       emoji:"💜", color:"#7c3aed", meaning:"思慮深さ・愛",      flowerIds:["fl_lavender"] },
  { month:3,  day:null, name:"桜",             emoji:"🌸", color:"#fda4af", meaning:"精神の美・優雅さ",  flowerIds:["fl_cherry"] },
  { month:4,  day:null, name:"チューリップ",   emoji:"🌷", color:"#f43f5e", meaning:"愛の告白・誠実",    flowerIds:["fl_tulip"] },
  { month:5,  day:null, name:"バラ",           emoji:"🌹", color:"#e11d48", meaning:"愛情・情熱",        flowerIds:["fl_rose"] },
  { month:6,  day:null, name:"アジサイ",       emoji:"💙", color:"#60a5fa", meaning:"辛抱強い愛情",      flowerIds:["fl_babysbreath","fl_lavender"] },
  { month:7,  day:null, name:"ひまわり",       emoji:"🌻", color:"#f59e0b", meaning:"あなただけを見つめる",flowerIds:["fl_sunflower"] },
  { month:8,  day:null, name:"ひまわり",       emoji:"🌻", color:"#f59e0b", meaning:"光輝・崇拝",        flowerIds:["fl_sunflower","fl_daisy"] },
  { month:9,  day:null, name:"コスモス",       emoji:"🌸", color:"#f0abfc", meaning:"乙女の純潔・調和",  flowerIds:["fl_cosmos"] },
  { month:10, day:null, name:"コスモス",       emoji:"🌸", color:"#f0abfc", meaning:"少女の純潔・愛情",  flowerIds:["fl_cosmos","fl_babysbreath"] },
  { month:11, day:null, name:"カーネーション", emoji:"💐", color:"#f9a8d4", meaning:"愛・感謝",          flowerIds:["fl_carnation"] },
  { month:12, day:null, name:"ポインセチア",   emoji:"❤️", color:"#dc2626", meaning:"祝福・幸運を祈る",  flowerIds:["fl_rose","fl_carnation"] },
];

// 月から誕生花を取得
function getBirthFlower(month, day) {
  const m = parseInt(month);
  return BIRTH_FLOWERS_DB.find(b=>b.month===m) || BIRTH_FLOWERS_DB[0];
}

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
  return { id:newUid(), name, templateId:"shrine", customColors:null, altarMode:"shelf", shelfStyleId:"default", shelf:Array.from({length:SHELF_ROWS},()=>Array(SHELF_COLS).fill(null)), hinaShelf:Array.from({length:5},(_,i)=>Array(i+2).fill(null)).reverse(), showcaseShelf:Array.from({length:3},()=>Array(4).fill(null)), flatShelf:Array(8).fill(null), freeItems:[], decoItems:[], bgMaterialId:null, bgCustomColor:null, frameMaterialId:null, lightId:null };
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
  const [showBouquet, setShowBouquet]       = useState(false);
  const [bouquets, setBouquets]             = useState([]); // saved bouquets
  const [customFlowers, setCustomFlowers]   = useState([]); // user-uploaded flower images [{id,name,image}]
  const [showRandomSets, setShowRandomSets] = useState(false);
  const [showAltarManager, setShowAltarManager] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [loaded, setLoaded]       = useState(false);
  const [toast, setToast]         = useState(null);
  const [viewingShared, setViewingShared] = useState(null); // shared altar object | null
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
    if (d.bouquets)   setBouquets(d.bouquets);
    if (d.customFlowers) setCustomFlowers(d.customFlowers);
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

  // ── Auto-save ─────────────────────────────────────────────
  const triggerSave = useCallback((plan,altars,activeAltarId,goods,characters,purchasedMaterials,randomSets,bouquets,customFlowers)=>{
    if (!loaded) return;
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async()=>{
      try {
        const data = {plan,altars,activeAltarId,goods,characters,purchasedMaterials,randomSets,bouquets,customFlowers};
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

  useEffect(()=>{ if(loaded) triggerSave(plan,altars,activeAltarId,goods,characters,purchasedMaterials,randomSets,bouquets,customFlowers); },[plan,altars,activeAltarId,goods,characters,purchasedMaterials,randomSets,bouquets,customFlowers,loaded]);

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
  const addCharacter    = (c)=>{ setCharacters(prev=>[...prev,c]); showToast("推しを追加しました ✓"); };
  const deleteCharacter = (id)=>{ setCharacters(prev=>prev.filter(c=>c.id!==id)); setGoods(prev=>prev.map(g=>g.characterId===id?{...g,characterId:null}:g)); };

  // ── Bouquets CRUD ──────────────────────────────────────────
  const saveBouquet = (b) => { setBouquets(prev=>[b,...prev]); showToast("花束を保存しました 💐"); };
  const deleteBouquet = (id) => setBouquets(prev=>prev.filter(b=>b.id!==id));
  const placeBouquetOnAltar = (b) => {
    // Place bouquet as a decoItem on current altar
    const cur = (currentAltar.decoItems||[]);
    updateAltar(currentAltar.id, { decoItems:[...cur,{ id:newUid(), materialId:"bouquet", bouquetData:b, x:200+Math.random()*150, y:150+Math.random()*80, scale:1.2, zIndex:(cur.length+1)*10 }] });
    showToast("花束を祭壇に配置しました 💐");
  };

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
          ["bouquet","💐","花束"],
        ].map(([p,icon,label])=>(
          <button key={p} onClick={()=>setPage(p)} style={{ ...S.bottomNavBtn, ...(page===p?S.bottomNavBtnOn:{}) }}>
            <span style={{ fontSize:20 }}>{icon}</span>
            <span style={{ fontSize:10, fontWeight:page===p?700:400 }}>{label}</span>
          </button>
        ))}
      </nav>

      {page==="bouquet"
        ? <BouquetPage bouquets={bouquets} isPro={isPro} purchasedMaterials={purchasedMaterials} customFlowers={customFlowers} onSave={saveBouquet} onDelete={deleteBouquet} onPlace={placeBouquetOnAltar} onGoAltar={()=>setPage("altar")} characters={characters} onAddCustomFlower={addCustomFlower} onDeleteCustomFlower={deleteCustomFlower} />
        : page==="random"
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
              const data = {plan,altars,activeAltarId:altars[0]?.id,goods,characters,purchasedMaterials,randomSets,bouquets,customFlowers};
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
      {showUpgrade && <UpgradeModal onUpgrade={upgradeToPro} onUpgradePremium={upgradeToPremium} onClose={()=>setShowUpgrade(false)} plan={plan} />}
      {showMaterials && <MaterialsModal altar={currentAltar} onUpdateAltar={(patch)=>updateAltar(currentAltar.id,patch)} isPremium={isPremium} purchasedMaterials={purchasedMaterials} onPurchase={purchaseMaterial} canUseMaterial={canUseMaterial} onClose={()=>setShowMaterials(false)} onUpgrade={()=>{setShowMaterials(false);setShowUpgrade(true);}} />}
      {showAltarManager && <AltarManagerModal altars={altars} activeId={activeAltar?.id} isPro={isPro}
        onAdd={addAltar} onDelete={deleteAltar} onRename={renameAltar} onSwitch={(id)=>{setActiveAltarId(id);setShowAltarManager(false);}}
        onUpgrade={()=>{ setShowAltarManager(false); setShowUpgrade(true); }} onClose={()=>setShowAltarManager(false)} />}
    </div>
  );
}

// ─── Bouquet Page ────────────────────────────────────────────
// ─── Custom Flower Upload ────────────────────────────────────
function CustomFlowerUpload({ onAdd }) {
  const fileRef = useRef(null);
  const [open, setOpen]     = useState(false);
  const [queue, setQueue]   = useState([]); // [{img, name}]
  const [current, setCurrent] = useState(0); // index in queue

  const handleFiles = async(e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const loaded = [];
    for (const f of files) {
      if (f.size > 3*1024*1024) continue;
      const img = await readFileAsDataURL(f);
      // guess name from filename
      const raw = f.name.replace(/\.[^.]+$/, "").replace(/無題\d+_\d+/, "");
      loaded.push({ img, name: raw || "" });
    }
    if (!loaded.length) { alert("読み込める画像がありませんでした"); return; }
    setQueue(loaded);
    setCurrent(0);
    setOpen(true);
    e.target.value = "";
  };

  const item = queue[current];

  const updateName = (val) => {
    setQueue(prev => prev.map((q,i) => i===current ? {...q, name:val} : q));
  };

  const submitOne = () => {
    if (!item) return;
    onAdd({ id:newUid(), name:item.name.trim()||"マイ花", image:item.img });
    if (current < queue.length-1) {
      setCurrent(c=>c+1);
    } else {
      setOpen(false); setQueue([]); setCurrent(0);
    }
  };

  const submitAll = () => {
    queue.forEach(q => onAdd({ id:newUid(), name:q.name.trim()||"マイ花", image:q.img }));
    setOpen(false); setQueue([]); setCurrent(0);
  };

  const skip = () => {
    if (current < queue.length-1) setCurrent(c=>c+1);
    else { setOpen(false); setQueue([]); setCurrent(0); }
  };

  return (
    <>
      <button onClick={()=>fileRef.current?.click()} style={{ fontSize:11,fontWeight:700,color:"#e879f9",background:"rgba(232,121,249,0.1)",border:"1px solid rgba(232,121,249,0.2)",borderRadius:10,padding:"4px 12px",cursor:"pointer" }}>
        ＋ まとめて追加
      </button>
      <input ref={fileRef} type="file" accept="image/png,image/gif,image/webp" multiple onChange={handleFiles} style={{ display:"none" }}/>

      {open && item && (
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16 }}>
          <div style={{ background:"#110d20",borderRadius:18,padding:22,width:"100%",maxWidth:340,border:"1px solid rgba(232,121,249,0.2)" }}>
            {/* Progress */}
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
              <div style={{ fontSize:15,fontWeight:800,color:"#e879f9" }}>🌸 花素材を登録</div>
              <div style={{ fontSize:11,color:"#7c6a9a" }}>{current+1} / {queue.length}枚</div>
            </div>

            {/* Progress bar */}
            <div style={{ height:3,background:"rgba(255,255,255,0.08)",borderRadius:2,marginBottom:14,overflow:"hidden" }}>
              <div style={{ height:"100%",width:`${((current+1)/queue.length)*100}%`,background:"linear-gradient(90deg,#e879f9,#818cf8)",transition:"width 0.3s" }}/>
            </div>

            {/* Preview */}
            <img src={item.img} alt="preview" style={{ width:"100%",height:140,objectFit:"contain",marginBottom:10,background:"rgba(255,255,255,0.03)",borderRadius:10 }}/>

            {/* Name input */}
            <div style={{ fontSize:11,color:"#7c6a9a",marginBottom:5 }}>花の名前</div>
            <input value={item.name} onChange={e=>updateName(e.target.value)}
              placeholder="例: 黄色マーガレット、ピンク小花…"
              style={{ width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"8px 10px",color:"#f0e8ff",fontSize:13,outline:"none",boxSizing:"border-box",marginBottom:12 }}
              maxLength={20} autoFocus
              onKeyDown={e=>e.key==="Enter"&&submitOne()}/>

            {/* Actions */}
            <div style={{ display:"flex",gap:8,marginBottom:8 }}>
              <button onClick={skip} style={{ flex:1,padding:"9px",borderRadius:10,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#9ca3af",fontSize:12,cursor:"pointer" }}>
                {current<queue.length-1?"スキップ →":"スキップして終了"}
              </button>
              <button onClick={submitOne} style={{ flex:2,padding:"9px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer" }}>
                {current<queue.length-1?"追加して次へ →":"追加して完了 ✓"}
              </button>
            </div>
            {queue.length>1&&current===0&&(
              <button onClick={submitAll} style={{ width:"100%",padding:"7px",borderRadius:10,border:"1px solid rgba(232,121,249,0.2)",background:"transparent",color:"#e879f9",fontSize:11,cursor:"pointer" }}>
                全{queue.length}枚を名前なしで一括追加
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function BouquetPage({ bouquets, isPro, purchasedMaterials, customFlowers, onSave, onDelete, onPlace, onGoAltar, characters, onAddCustomFlower, onDeleteCustomFlower }) {
  const [showBuilder, setShowBuilder]   = useState(false);
  const [previewBouquet, setPreviewBouquet] = useState(null);
  const [birthTab, setBirthTab]         = useState("saved"); // "saved" | "birth"

  // 今日の誕生花
  const today = new Date();
  const todayFlower = getBirthFlower(today.getMonth()+1, today.getDate());

  // 推しの誕生日チェック（今月）
  const thisMonth = today.getMonth()+1;
  const oshiThisMonth = (characters||[]).filter(c=>{
    if (!c.birthday) return false;
    const m = parseInt(c.birthday.slice(5,7));
    return m===thisMonth;
  });

  // 推しの誕生花を自動生成してビルダーに渡す
  const createBirthBouquet = (oshi) => {
    const m = parseInt(oshi.birthday.slice(5,7));
    const bf = getBirthFlower(m, null);
    const flowers = bf.flowerIds.map(id=>({id, count:3}));
    // open builder with pre-selected flowers
    setShowBuilder({ preset:{ name:`${oshi.name}への誕生花束`, flowers, ribbonColor:"rb_pink", wrapStyle:"wrap_round" } });
  };

  return (
    <main style={S.main}>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
        <div>
          <div style={{ fontSize:18,fontWeight:800,color:"#f0e8ff" }}>💐 花束メーカー</div>
          <div style={{ fontSize:12,color:"#7c6a9a",marginTop:2 }}>誕生花で推しへの気持ちをカタチに</div>
        </div>
        <button onClick={()=>setShowBuilder({})} style={S.addBtn}>＋ 花束を作る</button>
      </div>

      {/* Today's birth flower banner */}
      <div style={{ background:`linear-gradient(135deg,${todayFlower.color}22,rgba(232,121,249,0.08))`,border:`1px solid ${todayFlower.color}44`,borderRadius:14,padding:"14px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:14 }}>
        <div style={{ fontSize:36 }}>{todayFlower.emoji}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11,color:"#7c6a9a",fontWeight:700,marginBottom:2 }}>今日（{thisMonth}月）の誕生花</div>
          <div style={{ fontSize:16,fontWeight:800,color:"#f0e8ff" }}>{todayFlower.name}</div>
          <div style={{ fontSize:11,color:"#9ca3af",marginTop:2 }}>花言葉: {todayFlower.meaning}</div>
        </div>
        <button onClick={()=>setShowBuilder({ preset:{ name:`${todayFlower.name}の花束`, flowers:todayFlower.flowerIds.map(id=>({id,count:3})), ribbonColor:"rb_pink", wrapStyle:"wrap_round" }})}
          style={{ padding:"8px 14px",borderRadius:20,border:"none",background:`${todayFlower.color}`,color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0,boxShadow:`0 2px 10px ${todayFlower.color}66` }}>
          この花で作る →
        </button>
      </div>

      {/* Oshi birthday this month */}
      {oshiThisMonth.length>0&&(
        <div style={{ background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:16 }}>
          <div style={{ fontSize:11,fontWeight:700,color:"#f59e0b",marginBottom:8 }}>🎂 今月が誕生日の推し</div>
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {oshiThisMonth.map(c=>{
              const bf = getBirthFlower(parseInt(c.birthday.slice(5,7)),null);
              return (
                <button key={c.id} onClick={()=>createBirthBouquet(c)}
                  style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:20,border:`1px solid ${c.color}44`,background:`${c.color}11`,cursor:"pointer" }}>
                  <span style={{ fontSize:16 }}>{c.emoji}</span>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:11,fontWeight:700,color:c.color }}>{c.name}</div>
                    <div style={{ fontSize:9,color:"#7c6a9a" }}>{bf.emoji} {bf.name}の花束を作る</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Birth flowers calendar */}
      <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"12px 16px",marginBottom:16 }}>
        <div style={{ fontSize:12,fontWeight:700,color:"#c084fc",marginBottom:10 }}>📅 月ごとの誕生花</div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:6 }}>
          {BIRTH_FLOWERS_DB.map(bf=>(
            <button key={bf.month} onClick={()=>setShowBuilder({ preset:{ name:`${bf.month}月の誕生花束`, flowers:bf.flowerIds.map(id=>({id,count:3})), ribbonColor:"rb_pink", wrapStyle:"wrap_round" }})}
              style={{ padding:"8px 4px",borderRadius:10,border:`1px solid ${bf.month===thisMonth?bf.color+"88":"rgba(255,255,255,0.07)"}`,background:bf.month===thisMonth?`${bf.color}18`:"rgba(255,255,255,0.02)",cursor:"pointer",textAlign:"center",transition:"all 0.15s" }}
              title={`${bf.month}月の誕生花: ${bf.name}`}>
              <div style={{ fontSize:18 }}>{bf.emoji}</div>
              <div style={{ fontSize:9,color:bf.month===thisMonth?bf.color:"#6b7280",fontWeight:bf.month===thisMonth?700:400,marginTop:2 }}>{bf.month}月</div>
              <div style={{ fontSize:8,color:"#4b5563",marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{bf.name}</div>
            </button>
          ))}
        </div>
        <div style={{ fontSize:10,color:"#4b5563",marginTop:8,textAlign:"center" }}>タップするとその月の誕生花で花束を作れます · 365日対応は近日公開予定</div>
      </div>

      {/* Custom flower upload */}
      <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"12px 16px",marginBottom:14 }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
          <div style={{ fontSize:12,fontWeight:700,color:"#e879f9" }}>🌸 マイ花素材（描いた花・デコ画像）</div>
          <CustomFlowerUpload onAdd={onAddCustomFlower}/>
        </div>
        {customFlowers.length===0 ? (
          <div style={{ fontSize:11,color:"#4b5563",textAlign:"center",padding:"8px 0" }}>
            アイビスペイントで描いた花やデコをアップロードして花束に使えます
          </div>
        ) : (
          <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
            {customFlowers.map(f=>(
              <div key={f.id} style={{ position:"relative",width:52,height:52,borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)" }}>
                <img src={f.image} alt={f.name} style={{ width:"100%",height:"100%",objectFit:"contain",background:"rgba(255,255,255,0.03)" }}/>
                <div style={{ position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.6)",fontSize:7,color:"#fff",textAlign:"center",padding:"1px 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{f.name}</div>
                <button onClick={()=>onDeleteCustomFlower(f.id)} style={{ position:"absolute",top:1,right:1,width:14,height:14,borderRadius:"50%",border:"none",background:"rgba(239,68,68,0.8)",color:"#fff",fontSize:8,cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:"flex",gap:6,marginBottom:14 }}>
        {[["saved",`💐 保存した花束 (${bouquets.length})`]].map(([t,l])=>(
          <button key={t} onClick={()=>setBirthTab(t)} style={{ padding:"6px 14px",borderRadius:20,border:`1px solid ${birthTab===t?"rgba(232,121,249,0.4)":"rgba(255,255,255,0.08)"}`,background:birthTab===t?"rgba(232,121,249,0.15)":"transparent",color:birthTab===t?"#e879f9":"#9ca3af",fontSize:12,fontWeight:700,cursor:"pointer" }}>{l}</button>
        ))}
      </div>

      {bouquets.length===0 ? (
        <div style={{ textAlign:"center",padding:"40px 20px",color:"#6b7280" }}>
          <div style={{ fontSize:40,marginBottom:10 }}>💐</div>
          <div style={{ fontSize:14,fontWeight:700,marginBottom:6 }}>まだ花束がありません</div>
          <div style={{ fontSize:12,opacity:0.5 }}>上の誕生花カレンダーか「＋ 花束を作る」から作ってみよう</div>
        </div>
      ) : (
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:10 }}>
          {bouquets.map(b=>(
            <div key={b.id} style={{ background:"rgba(255,255,255,0.04)",borderRadius:14,border:"1px solid rgba(255,255,255,0.07)",overflow:"hidden" }}>
              <div style={{ height:150,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.2)",position:"relative",cursor:"pointer" }} onClick={()=>setPreviewBouquet(b)}>
                <BouquetPreview bouquet={b} size={110}/>
                <div style={{ position:"absolute",top:6,right:6,fontSize:9,background:"rgba(0,0,0,0.5)",color:"#9ca3af",borderRadius:6,padding:"1px 5px" }}>タップで拡大</div>
              </div>
              <div style={{ padding:"10px 12px" }}>
                <div style={{ fontSize:12,fontWeight:700,color:"#f0e8ff",marginBottom:2 }}>{b.name}</div>
                <div style={{ fontSize:10,color:"#7c6a9a",marginBottom:8 }}>
                  {b.flowers.map(f=>FLOWERS.find(fl=>fl.id===f.id)?.emoji||"🌸").join("")} {b.flowers.reduce((a,f)=>a+f.count,0)}本
                </div>
                <div style={{ display:"flex",gap:5 }}>
                  <button onClick={()=>{ onPlace(b); onGoAltar(); }} style={{ flex:1,padding:"5px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#e879f9,#818cf8)",color:"#fff",fontSize:10,fontWeight:700,cursor:"pointer" }}>⛩ 祭壇へ</button>
                  <button onClick={()=>onDelete(b.id)} style={{ width:28,borderRadius:8,border:"none",background:"rgba(239,68,68,0.15)",color:"#ef4444",fontSize:12,cursor:"pointer" }}>🗑</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showBuilder && <BouquetBuilder isPro={isPro} purchasedMaterials={purchasedMaterials} customFlowers={customFlowers} preset={showBuilder.preset} onSave={(b)=>{ onSave(b); setShowBuilder(false); }} onClose={()=>setShowBuilder(false)}/>}
      {previewBouquet && (
        <div style={S.overlay} onClick={()=>setPreviewBouquet(null)}>
          <div style={{ background:"#110d20",borderRadius:20,padding:24,textAlign:"center",border:"1px solid rgba(232,121,249,0.2)" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:15,fontWeight:800,color:"#f0e8ff",marginBottom:12 }}>{previewBouquet.name}</div>
            <BouquetPreview bouquet={previewBouquet} size={220}/>
            <button onClick={()=>setPreviewBouquet(null)} style={{ marginTop:16,padding:"8px 24px",borderRadius:20,border:"none",background:"rgba(255,255,255,0.08)",color:"#9ca3af",cursor:"pointer" }}>閉じる</button>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Bouquet Preview ──────────────────────────────────────────
// Renders a bouquet as a visual SVG-like arrangement using emoji
function BouquetPreview({ bouquet, size=100 }) {
  const { flowers=[], ribbonColor="", wrapStyle="wrap_round" } = bouquet;
  const ribbon = RIBBON_COLORS.find(r=>r.id===ribbonColor)||RIBBON_COLORS[0];

  // Expand flowers into individual items
  const items = [];
  flowers.forEach(f=>{ const fl=FLOWERS.find(fl=>fl.id===f.id); if(fl) for(let i=0;i<f.count;i++) items.push(fl); });
  if (!items.length) return <div style={{ fontSize:48 }}>💐</div>;

  const total = items.length;
  const fontSize = Math.max(12, Math.min(28, size/(Math.ceil(Math.sqrt(total))*1.4)));

  // Arrange in a fan/circle based on wrapStyle
  const getPos = (i, total, style) => {
    const cx = size/2, cy = size*0.42;
    if (style==="wrap_round") {
      // circular arrangement
      const angle = (i/total)*Math.PI*2 - Math.PI/2;
      const r = size*0.22*(1+total*0.02);
      return { x: cx+Math.cos(angle)*r, y: cy+Math.sin(angle)*r*0.75 };
    } else if (style==="wrap_cascade") {
      // waterfall — flowers drape down on one side
      const col = i%3, row = Math.floor(i/3);
      return { x: cx-20+(col*18), y: cy-30+(row*16) };
    } else {
      // posy — tight cluster
      const angle = (i/total)*Math.PI*2;
      const r = size*0.14*(1+i*0.015);
      return { x: cx+Math.cos(angle)*r, y: cy+Math.sin(angle)*r*0.7 };
    }
  };

  return (
    <div style={{ width:size,height:size,position:"relative",display:"inline-block" }}>
      {/* Wrap paper */}
      <div style={{ position:"absolute",bottom:size*0.05,left:"50%",transform:"translateX(-50%)",width:size*0.45,height:size*0.38,background:`linear-gradient(160deg,${ribbon.color}22,${ribbon.color}44)`,borderRadius:`${size*0.04}px ${size*0.04}px ${size*0.08}px ${size*0.08}px`,border:`1px solid ${ribbon.color}55` }}/>
      {/* Ribbon */}
      <div style={{ position:"absolute",bottom:size*0.12,left:"50%",transform:"translateX(-50%)",fontSize:fontSize*0.8 }}>🎀</div>
      {/* Stem */}
      <div style={{ position:"absolute",bottom:size*0.05,left:"50%",transform:"translateX(-50%)",width:3,height:size*0.25,background:"#4ade80",borderRadius:2 }}/>
      {/* Flowers */}
      {items.slice(0,16).map((fl,i)=>{
        const pos = getPos(i, Math.min(total,16), wrapStyle);
        return (
          <div key={i} style={{ position:"absolute",left:pos.x,top:pos.y,transform:"translate(-50%,-50%)",fontSize,lineHeight:1,zIndex:i+1,filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}>
            {fl.isCustom && fl.customImage
              ? <img src={fl.customImage} alt="" style={{ width:fontSize,height:fontSize,objectFit:"contain" }}/>
              : fl.emoji}
          </div>
        );
      })}
      {total>16&&<div style={{ position:"absolute",bottom:2,right:2,fontSize:9,color:"#9ca3af" }}>+{total-16}</div>}
    </div>
  );
}

// ─── Bouquet Builder Modal ────────────────────────────────────
function BouquetBuilder({ isPro, purchasedMaterials, customFlowers=[], onSave, onClose, preset }) {
  const [name, setName]           = useState(preset?.name||"推しへの花束");
  const [selectedFlowers, setSelectedFlowers] = useState(preset?.flowers||[]); // [{id, count}]
  const [ribbonColor, setRibbonColor] = useState(preset?.ribbonColor||"rb_pink");
  const [wrapStyle, setWrapStyle]   = useState(preset?.wrapStyle||"wrap_round");
  const [tab, setTab]               = useState("flowers");
  const [error, setError]           = useState("");

  const canUseFlower = (f) => f.free || isPro || purchasedMaterials.includes(f.id);

  const setCount = (id, delta, customImage) => {
    setSelectedFlowers(prev=>{
      const ex = prev.find(f=>f.id===id);
      if (!ex && delta>0) return [...prev,{id,count:1,...(customImage?{customImage}:{})}];
      if (!ex) return prev;
      const newCount = ex.count+delta;
      if (newCount<=0) return prev.filter(f=>f.id!==id);
      return prev.map(f=>f.id===id?{...f,count:newCount}:f);
    });
  };

  const totalFlowers = selectedFlowers.reduce((a,f)=>a+f.count,0);

  const preview = { id:newUid(), name, flowers:selectedFlowers, ribbonColor, wrapStyle, createdAt:new Date().toISOString() };

  const submit = () => {
    if (!selectedFlowers.length) { setError("花を1種類以上選んでください"); return; }
    if (!name.trim()) { setError("花束の名前を入力してください"); return; }
    onSave(preview);
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal,maxWidth:520 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
          <div style={{ fontSize:18,fontWeight:800,color:"#e879f9" }}>💐 花束を作る</div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>

        {/* Preview */}
        <div style={{ display:"flex",alignItems:"center",gap:16,padding:"12px 14px",background:"rgba(255,255,255,0.03)",borderRadius:12,marginBottom:14,border:"1px solid rgba(255,255,255,0.07)" }}>
          <BouquetPreview bouquet={preview} size={100}/>
          <div style={{ flex:1 }}>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="花束の名前" style={{ ...S.input,fontSize:14,fontWeight:700,marginBottom:6 }} maxLength={30}/>
            <div style={{ fontSize:11,color:"#7c6a9a" }}>
              {totalFlowers>0 ? `${selectedFlowers.map(f=>{ const fl=FLOWERS.find(fl=>fl.id===f.id); return `${fl?.emoji}×${f.count}`; }).join(" ")} 合計${totalFlowers}本` : "花を選んでください"}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex",gap:6,marginBottom:12 }}>
          {[["flowers","🌸 花を選ぶ"],["ribbon","🎀 リボン"],["wrap","💐 スタイル"]].map(([t,l])=>(
            <button key={t} onClick={()=>setTab(t)} style={{ flex:1,padding:"6px",borderRadius:10,border:`1px solid ${tab===t?"rgba(232,121,249,0.4)":"rgba(255,255,255,0.08)"}`,background:tab===t?"rgba(232,121,249,0.15)":"transparent",color:tab===t?"#e879f9":"#9ca3af",fontSize:11,fontWeight:700,cursor:"pointer" }}>{l}</button>
          ))}
        </div>

        {/* Flowers tab */}
        {tab==="flowers" && (
          <div style={{ maxHeight:280,overflowY:"auto" }}>
            {!isPro&&<div style={{ fontSize:10,color:"#7c6a9a",marginBottom:8,padding:"6px 10px",background:"rgba(192,132,252,0.06)",borderRadius:8 }}>👑 PROプランで全ての花が使えます</div>}

            {/* Custom uploaded flowers */}
            {customFlowers.length>0&&(
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10,fontWeight:700,color:"#e879f9",marginBottom:6 }}>🌸 マイ花素材</div>
                <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6 }}>
                  {customFlowers.map(fl=>{
                    const sel=selectedFlowers.find(f=>f.id===`custom_${fl.id}`);
                    const cnt=sel?.count||0;
                    return (
                      <div key={fl.id} style={{ background:cnt>0?"rgba(232,121,249,0.1)":"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 6px",border:`1px solid ${cnt>0?"rgba(232,121,249,0.3)":"rgba(255,255,255,0.06)"}`,textAlign:"center" }}>
                        <img src={fl.image} alt={fl.name} style={{ width:40,height:40,objectFit:"contain",marginBottom:3 }}/>
                        <div style={{ fontSize:10,fontWeight:700,color:cnt>0?"#e879f9":"#d1d5db",marginBottom:4 }}>{fl.name}</div>
                        <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:4 }}>
                          <button onClick={()=>setCount(`custom_${fl.id}`,-1,fl.image)} disabled={cnt===0} style={{ width:20,height:20,borderRadius:"50%",border:"none",background:cnt>0?"rgba(232,121,249,0.2)":"rgba(255,255,255,0.05)",color:cnt>0?"#e879f9":"#4b5563",fontSize:12,cursor:cnt>0?"pointer":"default",fontWeight:800,padding:0,display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
                          <span style={{ fontSize:12,fontWeight:700,color:cnt>0?"#e879f9":"#6b7280",width:16,textAlign:"center" }}>{cnt}</span>
                          <button onClick={()=>setCount(`custom_${fl.id}`,+1,fl.image)} style={{ width:20,height:20,borderRadius:"50%",border:"none",background:"rgba(232,121,249,0.2)",color:"#e879f9",fontSize:12,cursor:"pointer",fontWeight:800,padding:0,display:"flex",alignItems:"center",justifyContent:"center" }}>＋</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ height:1,background:"rgba(255,255,255,0.07)",margin:"10px 0" }}/>
              </div>
            )}

            <div style={{ fontSize:10,fontWeight:700,color:"#7c6a9a",marginBottom:6 }}>🌸 プリセット花</div>
            <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6 }}>
              {FLOWERS.map(fl=>{
                const sel = selectedFlowers.find(f=>f.id===fl.id);
                const cnt = sel?.count||0;
                const unlocked = canUseFlower(fl);
                return (
                  <div key={fl.id} style={{ background:cnt>0?"rgba(232,121,249,0.1)":"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 6px",border:`1px solid ${cnt>0?"rgba(232,121,249,0.3)":"rgba(255,255,255,0.06)"}`,opacity:unlocked?1:0.5,textAlign:"center" }}>
                    <div style={{ fontSize:24,marginBottom:3 }}>{fl.emoji}</div>
                    <div style={{ fontSize:10,fontWeight:700,color:cnt>0?"#e879f9":"#d1d5db",marginBottom:4 }}>{fl.name}</div>
                    {!unlocked ? (
                      <div style={{ fontSize:9,color:"#c084fc" }}>👑 PRO</div>
                    ) : (
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:4 }}>
                        <button onClick={()=>setCount(fl.id,-1)} disabled={cnt===0} style={{ width:20,height:20,borderRadius:"50%",border:"none",background:cnt>0?"rgba(232,121,249,0.2)":"rgba(255,255,255,0.05)",color:cnt>0?"#e879f9":"#4b5563",fontSize:12,cursor:cnt>0?"pointer":"default",fontWeight:800,padding:0,display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
                        <span style={{ fontSize:12,fontWeight:700,color:cnt>0?"#e879f9":"#6b7280",width:16,textAlign:"center" }}>{cnt}</span>
                        <button onClick={()=>setCount(fl.id,+1)} style={{ width:20,height:20,borderRadius:"50%",border:"none",background:"rgba(232,121,249,0.2)",color:"#e879f9",fontSize:12,cursor:"pointer",fontWeight:800,padding:0,display:"flex",alignItems:"center",justifyContent:"center" }}>＋</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ribbon tab */}
        {tab==="ribbon" && (
          <div style={{ display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",padding:"8px 0" }}>
            {RIBBON_COLORS.map(r=>(
              <button key={r.id} onClick={()=>setRibbonColor(r.id)}
                style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 10px",borderRadius:12,border:`2px solid ${ribbonColor===r.id?r.color:"transparent"}`,background:ribbonColor===r.id?`${r.color}18`:"rgba(255,255,255,0.03)",cursor:"pointer" }}>
                <div style={{ width:28,height:28,borderRadius:"50%",background:r.color,boxShadow:`0 2px 8px ${r.color}66` }}/>
                <div style={{ fontSize:10,color:ribbonColor===r.id?r.color:"#9ca3af",fontWeight:ribbonColor===r.id?700:400 }}>{r.name}</div>
              </button>
            ))}
          </div>
        )}

        {/* Wrap style tab */}
        {tab==="wrap" && (
          <div style={{ display:"flex",flexDirection:"column",gap:8,padding:"4px 0" }}>
            {WRAP_STYLES.map(w=>(
              <button key={w.id} onClick={()=>setWrapStyle(w.id)}
                style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:12,border:`2px solid ${wrapStyle===w.id?"rgba(232,121,249,0.5)":"rgba(255,255,255,0.08)"}`,background:wrapStyle===w.id?"rgba(232,121,249,0.1)":"rgba(255,255,255,0.03)",cursor:"pointer",textAlign:"left" }}>
                <div style={{ width:60,height:60,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <BouquetPreview bouquet={{ flowers:[{id:"fl_rose",count:3},{id:"fl_daisy",count:2}], ribbonColor:"rb_pink", wrapStyle:w.id, name:"" }} size={56}/>
                </div>
                <div>
                  <div style={{ fontSize:13,fontWeight:700,color:wrapStyle===w.id?"#e879f9":"#f0e8ff" }}>{w.name}</div>
                  <div style={{ fontSize:11,color:"#7c6a9a",marginTop:2 }}>{w.desc}</div>
                </div>
                {wrapStyle===w.id&&<div style={{ marginLeft:"auto",color:"#e879f9",fontWeight:700 }}>✓</div>}
              </button>
            ))}
          </div>
        )}

        {error&&<div style={{ color:"#f87171",fontSize:12,margin:"8px 0",fontWeight:600 }}>{error}</div>}

        <button onClick={submit} style={{ width:"100%",padding:"12px",borderRadius:14,border:"none",background:totalFlowers>0?"linear-gradient(135deg,#e879f9,#818cf8)":"rgba(255,255,255,0.08)",color:totalFlowers>0?"#fff":"#4b5563",fontSize:15,fontWeight:800,cursor:totalFlowers>0?"pointer":"default",marginTop:12 }}>
          {totalFlowers>0?`💐 この花束を保存する`:"花を選んでください"}
        </button>
      </div>
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

function GoodCard({ good, count=1, characters, isPro, onStatusChange, onDelete, onCharChange }) {
  const st=STATUS[good.status];
  const [open,setOpen]=useState(false);
  const char=characters.find(c=>c.id===good.characterId);
  return (
    <div style={S.card}>
      <div style={S.cardImgWrap}>
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
function AltarPage({ altar, template, goods, altars, isPro, isPremium, viewingShared, onUpdateAltar, goodById, showToast, onOpenTemplates, onOpenShare, onOpenAltarManager, onOpenMaterials, onSwitchAltar, onUpgrade, onAutoArrange }) {
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
  const scaleDecoItem = (id,d)=>onUpdateAltar({decoItems:decoItems.map(i=>i.id===id?{...i,scale:Math.max(0.5,Math.min(4,i.scale+d))}:i)});
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
      <div style={{ display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center" }}>
        {[["shelf","🗄 棚"],["hina","🎎 ひな壇"],["showcase","🪟 ショーケース"],["flat","🟫 フラット台"],["free","✦ 自由配置"]].map(([m,l])=>(
          <button key={m} onClick={()=>!viewingShared&&onUpdateAltar({altarMode:m})} style={{ ...S.modeBtn,...(altarMode===m?S.modeBtnOn:{}) }}>{l}</button>
        ))}
        {!viewingShared&&<button onClick={onOpenTemplates} style={{ ...S.modeBtn,border:`1px solid ${template.border}`,color:template.accent }}>{template.emoji} テンプレ</button>}
        {!viewingShared&&altarMode==="shelf"&&<ShelfStylePicker currentId={altar.shelfStyleId||"default"} isPremium={isPremium} onChange={id=>onUpdateAltar({shelfStyleId:id})} />}
        {!viewingShared&&<button onClick={onAutoArrange} style={{ ...S.modeBtn,border:"1px solid rgba(255,200,100,0.3)",color:"#fcd34d" }}>✨ 自動配置</button>}
        {!viewingShared&&altarMode==="free"&&freeItems.length>0&&<button onClick={()=>setShowLayerPanel(l=>!l)} style={{ ...S.modeBtn,border:`1px solid ${showLayerPanel?"rgba(165,180,252,0.5)":"rgba(165,180,252,0.2)"}`,color:"#a5b4fc",background:showLayerPanel?"rgba(165,180,252,0.1)":"transparent" }}>🔲 レイヤー</button>}
        {!viewingShared&&<button onClick={()=>setPage("bouquet")} style={{ ...S.modeBtn,border:"1px solid rgba(251,191,36,0.3)",color:"#fbbf24" }}>💐 花束</button>}
        {!viewingShared&&<button onClick={onOpenMaterials} style={{ ...S.modeBtn,border:"1px solid rgba(192,132,252,0.4)",color:"#c084fc",background:altar.bgMaterialId||altar.frameMaterialId||altar.decoItems?.length?"rgba(192,132,252,0.1)":"transparent" }}>🎨 素材{(altar.bgMaterialId||altar.frameMaterialId||altar.decoItems?.length||altar.lightId)?` ✓`:""}</button>}
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
          {/* Deco stickers on shelf */}
          <DecoLayer decoItems={decoItems} isDark={template.dark!==false} viewingShared={viewingShared}
            draggingDeco={draggingDeco} selectedDeco={selectedDeco}
            onStartDrag={startDecoDrag} onSelect={setSelectedDeco}
            onScale={scaleDecoItem} onRemove={removeDecoItem} freeRef={freeRef}/>
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
        <div style={{ ...S.altarBg,background:altar.bgCustomColor||template.bg,border:`1px solid ${template.border}`,marginBottom:16,overflow:"hidden",position:"relative",minHeight:360 }}>
          {template.star&&<StarField/>}
          <AnimatedBG materialId={altar.bgMaterialId}/>
          <LightOverlay materialId={altar.lightId}/>
          <FrameOverlay materialId={altar.frameMaterialId}/>
          <DecoLayer decoItems={decoItems} isDark={template.dark!==false} viewingShared={viewingShared}
            draggingDeco={draggingDeco} selectedDeco={selectedDeco}
            onStartDrag={startDecoDrag} onSelect={setSelectedDeco}
            onScale={scaleDecoItem} onRemove={removeDecoItem} freeRef={freeRef}/>
          <AltarTopBar template={template} altarName={altar.name}/>
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
        <div style={{ ...S.altarBg,background:altar.bgCustomColor||template.bg,border:`1px solid ${template.border}`,marginBottom:16,overflow:"hidden",position:"relative" }}>
          {template.star&&<StarField/>}
          <AnimatedBG materialId={altar.bgMaterialId}/>
          <LightOverlay materialId={altar.lightId}/>
          <FrameOverlay materialId={altar.frameMaterialId}/>
          <DecoLayer decoItems={decoItems} isDark={template.dark!==false} viewingShared={viewingShared}
            draggingDeco={draggingDeco} selectedDeco={selectedDeco}
            onStartDrag={startDecoDrag} onSelect={setSelectedDeco}
            onScale={scaleDecoItem} onRemove={removeDecoItem} freeRef={freeRef}/>
          <AltarTopBar template={template} altarName={altar.name}/>
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
        <div style={{ ...S.altarBg,background:altar.bgCustomColor||template.bg,border:`1px solid ${template.border}`,marginBottom:16,overflow:"hidden",position:"relative" }}>
          {template.star&&<StarField/>}
          <AnimatedBG materialId={altar.bgMaterialId}/>
          <LightOverlay materialId={altar.lightId}/>
          <FrameOverlay materialId={altar.frameMaterialId}/>
          <DecoLayer decoItems={decoItems} isDark={template.dark!==false} viewingShared={viewingShared}
            draggingDeco={draggingDeco} selectedDeco={selectedDeco}
            onStartDrag={startDecoDrag} onSelect={setSelectedDeco}
            onScale={scaleDecoItem} onRemove={removeDecoItem} freeRef={freeRef}/>
          <AltarTopBar template={template} altarName={altar.name}/>
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
        <div ref={freeRef} onClick={()=>setSelectedFree(null)} style={{ ...S.altarBg,background:altar.bgCustomColor||template.bg,border:`1px solid ${template.border}`,height:380,position:"relative",overflow:"hidden",cursor:draggingFree?"grabbing":"default",marginBottom:16 }}>
          <AltarTopBar template={template} altarName={altar.name}/>
          {template.star&&<StarField/>}
          <AnimatedBG materialId={altar.bgMaterialId}/>
          <LightOverlay materialId={altar.lightId}/>
          <FrameOverlay materialId={altar.frameMaterialId}/>
          {/* Deco stickers on free altar */}
          <DecoLayer decoItems={decoItems} isDark={template.dark!==false} viewingShared={viewingShared}
            draggingDeco={draggingDeco} selectedDeco={selectedDeco}
            onStartDrag={startDecoDrag} onSelect={setSelectedDeco}
            onScale={scaleDecoItem} onRemove={removeDecoItem} freeRef={freeRef}/>
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
  const [customDecoName, setCustomDecoName] = useState("");
  const [customDecoImg, setCustomDecoImg]   = useState(null);
  const customDecoRef = useRef(null);

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
  const TABS = [["bg","🌌 背景"],["frame","🖼 フレーム"],["deco","🎀 デコ"],["light","💡 ライト"]];
  const items = MATERIALS.filter(m=>m.type===tab);

  const isActive = (mat) => {
    if (mat.type==="bg")    return altar.bgMaterialId===mat.id;
    if (mat.type==="frame") return altar.frameMaterialId===mat.id;
    if (mat.type==="deco")  return (altar.decoItems||[]).some(d=>d.materialId===mat.id);
    if (mat.type==="light") return altar.lightId===mat.id;
  };
  const toggle = (mat) => {
    if (!canUseMaterial(mat)) return;
    // selecting a material clears custom color
    if (mat.type==="bg")    onUpdateAltar({bgMaterialId:altar.bgMaterialId===mat.id?null:mat.id, bgCustomColor:null});
    if (mat.type==="frame") onUpdateAltar({frameMaterialId: altar.frameMaterialId===mat.id?null:mat.id});
    if (mat.type==="light") onUpdateAltar({lightId:         altar.lightId===mat.id?null:mat.id});
    if (mat.type==="deco")  {
      const cur = altar.decoItems||[];
      const exists = cur.find(d=>d.materialId===mat.id);
      if (exists) {
        onUpdateAltar({decoItems: cur.filter(d=>d.materialId!==mat.id)});
      } else {
        // Add new deco at center of altar
        onUpdateAltar({decoItems:[...cur,{id:newUid(),materialId:mat.id,x:200+Math.random()*200,y:120+Math.random()*100,scale:1.5,zIndex:(cur.length+1)*10}]});
      }
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
        {mat.type==="deco"&&active&&(()=>{ const cnt=(altar.decoItems||[]).filter(d=>d.materialId===mat.id).length; return cnt>0?<div style={{ position:"absolute",bottom:5,right:5,fontSize:9,background:"rgba(232,121,249,0.3)",color:"#e879f9",borderRadius:6,padding:"1px 5px",fontWeight:700 }}>×{cnt}</div>:null; })()}
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
function UpgradeModal({ onUpgrade, onUpgradePremium, onClose, plan }) {
  const [step, setStep]           = useState("plan");   // "plan" | "payment"
  const [selectedPlan, setSelectedPlan] = useState(null); // "pro" | "premium"
  const [payMethod, setPayMethod] = useState("card");   // "card" | "apple" | "google"
  const [billing, setBilling]     = useState("monthly"); // "monthly" | "yearly"
  const [cardNum, setCardNum]     = useState("");
  const [cardExp, setCardExp]     = useState("");
  const [cardCvc, setCardCvc]     = useState("");
  const [cardName, setCardName]   = useState("");
  const [processing, setProcessing] = useState(false);

  const FEATURES = [
    { icon:"⛩", label:"祭壇を無制限に作れる",    free:"1つまで", pro:"無制限",  premium:"無制限" },
    { icon:"🌟", label:"推し別フォルダ管理",     free:"✗",       pro:"✓",       premium:"✓" },
    { icon:"🌌", label:"背景アニメーション",        free:"✗",       pro:"✗",       premium:"✓" },
    { icon:"🎨", label:"素材使い放題",             free:"無料のみ", pro:"無料のみ", premium:"✓" },
    { icon:"📸", label:"シェア画像・URL",          free:"✓",       pro:"✓",       premium:"✓" },
    { icon:"🔖", label:"EC連携・認証バッジ",       free:"✗",       pro:"✓",       premium:"✓" },
  ];

  const PLANS = {
    pro:     { name:"PRO",     color:"#f59e0b", monthlyPrice:298,  yearlyPrice:2980,  studentMonthly:198, studentYearly:1980  },
    premium: { name:"PREMIUM", color:"#c084fc", monthlyPrice:498,  yearlyPrice:4980,  studentMonthly:348, studentYearly:3480  },
  };

  const planData = selectedPlan ? PLANS[selectedPlan] : null;
  const displayPrice = planData ? (billing==="monthly" ? planData.monthlyPrice : planData.yearlyPrice) : 0;
  const billingLabel = billing==="monthly" ? "/ 月" : "/ 年";

  // Format card number with spaces
  const formatCardNum = (val) => val.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
  const formatExp     = (val) => { const v=val.replace(/\D/g,"").slice(0,4); return v.length>2?v.slice(0,2)+"/"+v.slice(2):v; };

  const handleProceed = (p) => { setSelectedPlan(p); setStep("payment"); };

  const handleSubmit = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      if (selectedPlan==="pro") onUpgrade();
      else onUpgradePremium();
    }, 1800);
  };

  const canSubmit = payMethod==="card"
    ? cardNum.replace(/\s/g,"").length===16 && cardExp.length===5 && cardCvc.length>=3 && cardName.trim()
    : true;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth:460 }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            {step==="payment" && (
              <button onClick={()=>setStep("plan")} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:16,cursor:"pointer",padding:"0 4px" }}>←</button>
            )}
            <div style={{ fontSize:17,fontWeight:800,background:"linear-gradient(90deg,#f59e0b,#e879f9,#c084fc)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>
              {step==="plan" ? "SAIDANプランを選ぶ" : `${planData?.name} にアップグレード`}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",color:"#9ca3af",fontSize:18,cursor:"pointer" }}>✕</button>
        </div>

        <div style={{ fontSize:12,color:"#7c6a9a",textAlign:"center",marginBottom:14 }}>推し活に、お金の壁を作らない。</div>

        {/* ── Step 1: Plan selection ── */}
        {step==="plan" && (<>
          {/* Billing toggle */}
          <div style={{ display:"flex",background:"rgba(255,255,255,0.05)",borderRadius:20,padding:3,marginBottom:16,border:"1px solid rgba(255,255,255,0.08)" }}>
            {[["monthly","月払い"],["yearly","年払い（お得）"]].map(([b,l])=>(
              <button key={b} onClick={()=>setBilling(b)} style={{ flex:1,padding:"6px",borderRadius:17,border:"none",background:billing===b?"rgba(232,121,249,0.25)":"transparent",color:billing===b?"#e879f9":"#6b7280",fontSize:12,fontWeight:700,cursor:"pointer",transition:"all 0.15s" }}>
                {l}{b==="yearly"&&<span style={{ fontSize:9,color:"#4ade80",marginLeft:4 }}>2ヶ月分お得</span>}
              </button>
            ))}
          </div>

          {/* Plan cards */}
          <div style={{ display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14 }}>
            {/* Free */}
            <div style={{ textAlign:"center",padding:"12px 6px",background:"rgba(255,255,255,0.03)",borderRadius:12,border:`2px solid ${plan==="free"?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.07)"}` }}>
              <div style={{ fontSize:10,color:"#9ca3af",marginBottom:3,fontWeight:600 }}>FREE</div>
              <div style={{ fontSize:20,fontWeight:900,color:"#9ca3af" }}>¥0</div>
              <div style={{ fontSize:9,color:"#6b7280",marginTop:2 }}>ずっと無料</div>
              {plan==="free" && <div style={{ fontSize:9,color:"#9ca3af",marginTop:6,background:"rgba(255,255,255,0.08)",borderRadius:8,padding:"2px 0" }}>現在のプラン</div>}
            </div>
            {/* PRO */}
            <div style={{ textAlign:"center",padding:"12px 6px",background:"rgba(245,158,11,0.08)",borderRadius:12,border:`2px solid ${plan==="pro"?"#f59e0b":"rgba(245,158,11,0.2)"}`,position:"relative",cursor:plan==="pro"?"default":"pointer",transition:"transform 0.15s" }}
              onClick={()=>plan!=="pro"&&plan!=="premium"&&handleProceed("pro")}
              onMouseEnter={e=>plan!=="pro"&&plan!=="premium"&&(e.currentTarget.style.transform="scale(1.03)")}
              onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
              {plan==="pro"&&<div style={{ position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",fontSize:9,background:"#f59e0b",color:"#000",borderRadius:10,padding:"1px 8px",fontWeight:800,whiteSpace:"nowrap" }}>現在のプラン</div>}
              <div style={{ fontSize:10,color:"#f59e0b",marginBottom:3,fontWeight:700 }}>👑 PRO</div>
              <div><span style={{ fontSize:20,fontWeight:900,color:"#f59e0b" }}>¥{billing==="monthly"?298:2980}</span></div>
              <div style={{ fontSize:9,color:"#6b7280",marginTop:2 }}>{billingLabel}</div>
              <div style={{ fontSize:9,color:"#f59e0b",marginTop:2 }}>学割 ¥{billing==="monthly"?198:1980}</div>
              {plan!=="pro"&&plan!=="premium"&&<div style={{ marginTop:6,fontSize:10,color:"#fff",background:"#f59e0b",borderRadius:8,padding:"3px 0",fontWeight:700 }}>選択 →</div>}
            </div>
            {/* Premium */}
            <div style={{ textAlign:"center",padding:"12px 6px",background:"linear-gradient(135deg,rgba(192,132,252,0.12),rgba(232,121,249,0.08))",borderRadius:12,border:`2px solid ${plan==="premium"?"#c084fc":"rgba(192,132,252,0.25)"}`,position:"relative",cursor:plan==="premium"?"default":"pointer",transition:"transform 0.15s" }}
              onClick={()=>plan!=="premium"&&handleProceed("premium")}
              onMouseEnter={e=>plan!=="premium"&&(e.currentTarget.style.transform="scale(1.03)")}
              onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
              {plan==="premium"&&<div style={{ position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",fontSize:9,background:"#c084fc",color:"#fff",borderRadius:10,padding:"1px 8px",fontWeight:800,whiteSpace:"nowrap" }}>現在のプラン</div>}
              <div style={{ fontSize:10,color:"#c084fc",marginBottom:3,fontWeight:700 }}>✨ PREMIUM</div>
              <div><span style={{ fontSize:20,fontWeight:900,color:"#c084fc" }}>¥{billing==="monthly"?498:4980}</span></div>
              <div style={{ fontSize:9,color:"#6b7280",marginTop:2 }}>{billingLabel}</div>
              <div style={{ fontSize:9,color:"#c084fc",marginTop:2 }}>学割 ¥{billing==="monthly"?348:3480}</div>
              {plan!=="premium"&&<div style={{ marginTop:6,fontSize:10,color:"#fff",background:"linear-gradient(135deg,#c084fc,#e879f9)",borderRadius:8,padding:"3px 0",fontWeight:700 }}>選択 →</div>}
            </div>
          </div>

          <div style={{ fontSize:10,color:"#4b5563",textAlign:"center",marginBottom:12 }}>学割は大学メールアドレス（ac.jp）で認証予定 · Stripe導入時に実装</div>

          {/* Feature table */}
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex",padding:"4px 0 8px",borderBottom:"1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ flex:1,fontSize:10,color:"#6b7280" }}></span>
              <span style={{ fontSize:10,color:"#9ca3af",width:52,textAlign:"center",fontWeight:600 }}>FREE</span>
              <span style={{ fontSize:10,color:"#f59e0b",width:60,textAlign:"center",fontWeight:700 }}>PRO</span>
              <span style={{ fontSize:10,color:"#c084fc",width:70,textAlign:"center",fontWeight:700 }}>PREMIUM</span>
            </div>
            {FEATURES.map(f=>(
              <div key={f.label} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <span style={{ fontSize:13,width:20,textAlign:"center" }}>{f.icon}</span>
                <span style={{ flex:1,fontSize:11,color:"#d1d5db" }}>{f.label}</span>
                <span style={{ fontSize:10,color:"#6b7280",width:52,textAlign:"center" }}>{f.free}</span>
                <span style={{ fontSize:10,color:"#4ade80",fontWeight:700,width:60,textAlign:"center" }}>{f.pro}</span>
                <span style={{ fontSize:10,color:"#c084fc",fontWeight:700,width:70,textAlign:"center" }}>{f.premium}</span>
              </div>
            ))}
          </div>
        </>)}

        {/* ── Step 2: Payment ── */}
        {step==="payment" && planData && (<>
          {/* Order summary */}
          <div style={{ background:`${planData.color}10`,border:`1px solid ${planData.color}33`,borderRadius:12,padding:"12px 14px",marginBottom:16 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
              <div>
                <div style={{ fontSize:13,fontWeight:800,color:planData.color }}>{planData.name}プラン</div>
                <div style={{ fontSize:11,color:"#9ca3af",marginTop:2 }}>{billing==="monthly"?"月払い":"年払い（2ヶ月分お得）"}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:22,fontWeight:900,color:planData.color }}>¥{displayPrice}</div>
                <div style={{ fontSize:10,color:"#6b7280" }}>{billingLabel}（税込）</div>
              </div>
            </div>
          </div>

          {/* Payment method selector */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11,color:"#7c6a9a",fontWeight:700,marginBottom:8 }}>お支払い方法</div>
            <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
              {[
                { id:"card",   icon:"💳", label:"クレジットカード" },
                { id:"apple",  icon:"",   label:"Apple Pay",  logo:true },
                { id:"google", icon:"",   label:"Google Pay", logo:true },
              ].map(pm=>(
                <button key={pm.id} onClick={()=>setPayMethod(pm.id)} style={{ flex:1,padding:"10px 6px",borderRadius:12,border:`2px solid ${payMethod===pm.id?"rgba(232,121,249,0.6)":"rgba(255,255,255,0.1)"}`,background:payMethod===pm.id?"rgba(232,121,249,0.12)":"rgba(255,255,255,0.03)",cursor:"pointer",textAlign:"center",transition:"all 0.15s" }}>
                  {pm.id==="apple" ? (
                    <div style={{ fontSize:11,fontWeight:800,color:payMethod===pm.id?"#e879f9":"#9ca3af",letterSpacing:"-0.5px" }}> Apple Pay</div>
                  ) : pm.id==="google" ? (
                    <div style={{ fontSize:11,fontWeight:800,color:payMethod===pm.id?"#e879f9":"#9ca3af" }}>G Pay</div>
                  ) : (
                    <>
                      <div style={{ fontSize:18 }}>{pm.icon}</div>
                      <div style={{ fontSize:10,color:payMethod===pm.id?"#e879f9":"#9ca3af",marginTop:2,fontWeight:600 }}>{pm.label}</div>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Card form */}
          {payMethod==="card" && (
            <div style={{ marginBottom:14 }}>
              <div style={S.fieldGroup}>
                <label style={S.label}>カード番号</label>
                <div style={{ position:"relative" }}>
                  <input value={cardNum} onChange={e=>setCardNum(formatCardNum(e.target.value))}
                    placeholder="1234 5678 9012 3456" style={{ ...S.input,paddingRight:60,fontFamily:"monospace",letterSpacing:1 }} maxLength={19}/>
                  <div style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",display:"flex",gap:3 }}>
                    {["VISA","MC"].map(b=><span key={b} style={{ fontSize:8,fontWeight:800,color:"#6b7280",background:"rgba(255,255,255,0.08)",padding:"1px 4px",borderRadius:3 }}>{b}</span>)}
                  </div>
                </div>
              </div>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8 }}>
                <div style={S.fieldGroup}>
                  <label style={S.label}>有効期限</label>
                  <input value={cardExp} onChange={e=>setCardExp(formatExp(e.target.value))}
                    placeholder="MM/YY" style={{ ...S.input,fontFamily:"monospace" }} maxLength={5}/>
                </div>
                <div style={S.fieldGroup}>
                  <label style={S.label}>セキュリティコード</label>
                  <input value={cardCvc} onChange={e=>setCardCvc(e.target.value.replace(/\D/g,"").slice(0,4))}
                    placeholder="CVC" style={{ ...S.input,fontFamily:"monospace" }} maxLength={4}/>
                </div>
              </div>
              <div style={S.fieldGroup}>
                <label style={S.label}>カード名義（ローマ字）</label>
                <input value={cardName} onChange={e=>setCardName(e.target.value.toUpperCase())}
                  placeholder="TARO YAMADA" style={{ ...S.input,fontFamily:"monospace",letterSpacing:1 }} maxLength={30}/>
              </div>
              {/* Stripe badge */}
              <div style={{ display:"flex",alignItems:"center",gap:6,padding:"8px 10px",background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:8 }}>
                <span style={{ fontSize:16 }}>🔒</span>
                <span style={{ fontSize:10,color:"#9ca3af",lineHeight:1.5 }}>
                  カード情報はStripeの暗号化サーバーで安全に処理されます。SAIDANはカード番号を保存しません。
                </span>
              </div>
            </div>
          )}

          {/* Apple / Google Pay */}
          {(payMethod==="apple"||payMethod==="google") && (
            <div style={{ textAlign:"center",padding:"20px 0",marginBottom:14 }}>
              <div style={{ fontSize:36,marginBottom:8 }}>{payMethod==="apple"?"":"G"}</div>
              <div style={{ fontSize:13,color:"#d1d5db",marginBottom:4 }}>
                {payMethod==="apple"?"Apple Pay":"Google Pay"}で支払う
              </div>
              <div style={{ fontSize:11,color:"#6b7280" }}>
                デバイスの認証（Face ID / Touch ID）で支払いが完了します
              </div>
            </div>
          )}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={!canSubmit||processing}
            style={{ width:"100%",padding:"13px",borderRadius:14,border:"none",background:canSubmit&&!processing?`linear-gradient(135deg,${planData.color},#e879f9)`:"rgba(255,255,255,0.08)",color:canSubmit&&!processing?"#fff":"#4b5563",fontSize:14,fontWeight:800,cursor:canSubmit&&!processing?"pointer":"default",transition:"all 0.2s",marginBottom:10 }}>
            {processing ? "処理中…" : `¥${displayPrice}${billingLabel} で始める`}
          </button>

          <div style={{ fontSize:10,color:"#4b5563",textAlign:"center",lineHeight:1.7 }}>
            ※ これはデモUIです。実際の課金は発生しません。<br/>
            本サービス実装時はStripeと連携予定です。<br/>
            いつでもキャンセル可能 · 解約後も期間終了まで利用できます
          </div>
        </>)}
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
  const [removingBg,setRemovingBg] = useState(false);
  const [autoBgRemove,setAutoBgRemove] = useState(true);
  const fileRef = useRef(null);

  // Free plan emoji picker options
  const EMOJI_PICKS = ["📦","🧸","🖼️","🪆","🎀","🎵","📚","🎮","☕","⭐","🌸","💎","🎪","🖊️","🎭","🏆","🃏","🔵","🎰","🌙","🔥","🐱","🦊","🐰","🌈"];

  const handleFile = async(e) => {
    const f=e.target.files[0]; if(!f) return;
    if(f.size>5*1024*1024){setError("5MB以下にしてください");return;}
    if (autoBgRemove) {
      setRemovingBg(true); setError("");
      try {
        const { removeBackground } = await import("@imgly/background-removal");
        const blob = await removeBackground(f, { output: { format:"image/png", quality:1 } });
        const dataUrl = await readFileAsDataURL(blob);
        setImage(dataUrl);
      } catch {
        // 失敗したら元の画像をそのまま使う
        setImage(await readFileAsDataURL(f));
        setError("背景除去に失敗しました。元の画像で登録します。");
      } finally {
        setRemovingBg(false);
      }
    } else {
      setImage(await readFileAsDataURL(f)); setError("");
    }
  };

  const resolvedEmoji = emojiInput || "📦";

  const submit = () => {
    if(!name.trim()){setError("グッズ名を入力してください");return;}
    if(imgMode==="url"&&officialUrl&&!/^https?:\/\/.+/.test(officialUrl)){setError("URLはhttpまたはhttpsで始めてください");return;}
    onAdd({
      id:newUid(), name:name.trim(), series:series.trim(), status, goodType,
      image: imgMode==="upload"?image:null,
      emoji: resolvedEmoji,
      officialUrl: officialUrl.trim()||null,
      purchaseDate, releaseDate, memo:memo.trim(), characterId,
      createdAt:new Date().toISOString(),
    });
    onClose();
  };

  // Image mode tabs: "欲しい"なら "emoji" と "url" を優先表示
  const imgTabs = status==="wanted"
    ? [["emoji","アイコン"],["url","公式URL"],["upload","画像"]]
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

        {/* Image mode tabs */}
        <div style={{ display:"flex",gap:6,marginBottom:12 }}>
          {imgTabs.map(([m,l])=>(
            <button key={m} onClick={()=>setImgMode(m)} style={{ flex:1,padding:"6px",borderRadius:10,border:`1px solid ${imgMode===m?"rgba(232,121,249,0.4)":"rgba(255,255,255,0.1)"}`,background:imgMode===m?"rgba(232,121,249,0.15)":"transparent",color:imgMode===m?"#e879f9":"#9ca3af",fontSize:11,fontWeight:600,cursor:"pointer" }}>{l}</button>
          ))}
        </div>

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
            <div style={{ background:"rgba(129,140,248,0.07)",border:"1px solid rgba(129,140,248,0.2)",borderRadius:10,padding:"8px 12px",marginBottom:14,fontSize:11,color:"#a5b4fc",lineHeight:1.7 }}>
              💡 <strong style={{ color:"#c7d2fe" }}>素材をお探しですか？</strong><br/>
              <a href="https://sozaino.site/" target="_blank" rel="noreferrer" style={{ color:"#818cf8",fontWeight:700 }}>OKUMONO（sozaino.site）</a> はVTuber向けフリー素材サイトです。商用利用可・登録不要でダウンロードして、こちらにアップロードして使えます。
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

        {status==="owned"&&<div style={S.fieldGroup}><label style={S.label}>購入日</label><input type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)} style={S.input}/></div>}
        {status==="reserved"&&<div style={S.fieldGroup}><label style={S.label}>発売予定日</label><input type="date" value={releaseDate} onChange={e=>setReleaseDate(e.target.value)} style={S.input}/></div>}
        <div style={S.fieldGroup}><label style={S.label}>メモ</label><textarea value={memo} onChange={e=>setMemo(e.target.value)} placeholder="イベント限定品など" style={{ ...S.input,height:48,resize:"none" }} maxLength={100}/></div>

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
function DecoLayer({ decoItems, isDark, viewingShared, draggingDeco, selectedDeco, onStartDrag, onSelect, onScale, onRemove }) {
  if (!decoItems?.length) return null;
  // Helper to render a bouquet deco item
  const BouquetDecoItem = ({item,isSel,isDragging}) => {
    const b = item.bouquetData;
    if (!b) return <div style={{ fontSize:36 }}>💐</div>;
    return <BouquetPreview bouquet={b} size={80}/>;
  };
  const DECO_ANIMS = {
    dc_ribbon: "decoRibbon 1.5s ease-in-out infinite alternate",
    dc_light:  "decoLight 1.2s ease-in-out infinite alternate",
    dc_music:  "decoMusic 1s ease-in-out infinite alternate",
    dc_fire2:  "decoFire 0.8s ease-in-out infinite alternate",
  };
  return (
    <>
      <style>{`
        @keyframes decoRibbon { from{transform:rotate(-8deg)} to{transform:rotate(8deg)} }
        @keyframes decoLight  { from{opacity:0.7;transform:scale(0.9)} to{opacity:1;transform:scale(1.1)} }
        @keyframes decoMusic  { from{transform:translateY(0) rotate(-5deg)} to{transform:translateY(-6px) rotate(5deg)} }
        @keyframes decoFire   { from{transform:scaleY(1) scaleX(1)} to{transform:scaleY(1.2) scaleX(0.9)} }
      `}</style>
      {decoItems.map(item=>{
        const isCustom  = item.materialId==="custom";
        const isBouquet = item.materialId==="bouquet";
        const mat = isBouquet ? {id:"bouquet",emoji:"💐",animated:false} : isCustom ? {id:"custom",emoji:"🖼️",animated:false} : MATERIALS.find(m=>m.id===item.materialId);
        if (!mat && !isCustom && !isBouquet) return null;
        const isSel = selectedDeco===item.id;
        const isDragging = draggingDeco===item.id;
        const anim = mat.animated ? DECO_ANIMS[mat.id] : undefined;
        return (
          <div key={item.id}
            onMouseDown={e=>{ if(viewingShared) return; e.stopPropagation(); onSelect(item.id); onStartDrag(e,item.id); }}
            onTouchStart={e=>{ if(viewingShared) return; e.stopPropagation(); onSelect(item.id); onStartDrag(e,item.id); }}
            onClick={e=>{ e.stopPropagation(); onSelect(item.id); }}
            style={{
              position:"absolute",
              left:item.x, top:item.y,
              transform:`translate(-50%,-50%) scale(${item.scale||1})`,
              zIndex:(item.zIndex||50)+200,
              cursor:isDragging?"grabbing":viewingShared?"default":"grab",
              fontSize:36,
              lineHeight:1,
              animation:anim,
              filter:isSel?"drop-shadow(0 0 8px rgba(232,121,249,0.9))":"drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
              transition:isDragging?"none":"filter 0.2s",
              userSelect:"none",
            }}>
            {isBouquet
              ? <BouquetDecoItem item={item} isSel={isSel} isDragging={isDragging}/>
              : isCustom && item.customImage
              ? <img src={item.customImage} alt={item.customName||"デコ"} style={{ width:64,height:64,objectFit:"contain",display:"block" }}/>
              : mat?.emoji||"🖼️"}
            {/* Controls */}
            {isSel && !viewingShared && (
              <div style={{ position:"absolute",top:-34,left:"50%",transform:"translateX(-50%)",display:"flex",gap:4,background:isDark?"rgba(10,5,20,0.95)":"rgba(255,255,255,0.95)",borderRadius:20,padding:"4px 8px",border:"1px solid rgba(232,121,249,0.3)",boxShadow:"0 4px 16px rgba(0,0,0,0.4)",whiteSpace:"nowrap" }}>
                {[{l:"−",a:()=>onScale(item.id,-0.2)},{l:"+",a:()=>onScale(item.id,+0.2)},{l:"🗑",a:()=>onRemove(item.id)}].map(b=>(
                  <button key={b.l} onMouseDown={e=>{e.stopPropagation();b.a();}}
                    style={{ width:22,height:22,border:"none",borderRadius:"50%",background:b.l==="🗑"?"rgba(239,68,68,0.2)":"rgba(232,121,249,0.2)",color:b.l==="🗑"?"#ef4444":"#e879f9",fontSize:11,cursor:"pointer",fontWeight:900,padding:0,display:"flex",alignItems:"center",justifyContent:"center" }}>{b.l}</button>
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
