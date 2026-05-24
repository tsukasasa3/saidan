import { useState, useRef, useCallback, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────
const STORAGE_KEY = "saidan-v3";

const STATUS = {
  owned:    { label: "持ってる", color: "#22c55e", bg: "rgba(34,197,94,0.15)",  icon: "✓" },
  wanted:   { label: "欲しい",   color: "#f59e0b", bg: "rgba(245,158,11,0.15)", icon: "♡" },
  reserved: { label: "予約済み", color: "#60a5fa", bg: "rgba(96,165,250,0.15)", icon: "🔖" },
};

// ── Altar Templates ─────────────────────────────────────────
// Each template defines: name, description, bg style, layout hints
const TEMPLATES = [
  {
    id: "shrine",
    name: "神社",
    emoji: "⛩",
    desc: "厳かな赤と金の祭壇",
    bg: "linear-gradient(180deg, #1a0505 0%, #2d0a0a 40%, #1a0505 100%)",
    accent: "#dc2626",
    gold: "#f59e0b",
    floor: "rgba(220,38,38,0.12)",
    border: "rgba(220,38,38,0.4)",
    plank: "linear-gradient(180deg,#7c1a1a,#4a0d0d)",
    star: false,
    particles: "torii",
  },
  {
    id: "night",
    name: "星夜",
    emoji: "🌌",
    desc: "星空が広がる夜の部屋",
    bg: "linear-gradient(180deg, #020817 0%, #0f172a 50%, #020817 100%)",
    accent: "#818cf8",
    gold: "#e879f9",
    floor: "rgba(129,140,248,0.08)",
    border: "rgba(129,140,248,0.3)",
    plank: "linear-gradient(180deg,#1e1b4b,#0f0a2a)",
    star: true,
    particles: "stars",
  },
  {
    id: "pastel",
    name: "パステル",
    emoji: "🌸",
    desc: "やわらかいピンクで推しを飾る",
    bg: "linear-gradient(180deg, #fdf2f8 0%, #fce7f3 50%, #fdf2f8 100%)",
    accent: "#ec4899",
    gold: "#f472b6",
    floor: "rgba(236,72,153,0.07)",
    border: "rgba(236,72,153,0.25)",
    plank: "linear-gradient(180deg,#fbcfe8,#f9a8d4)",
    star: false,
    particles: "petals",
    dark: false,
  },
  {
    id: "ocean",
    name: "オーシャン",
    emoji: "🌊",
    desc: "深海のような青いステージ",
    bg: "linear-gradient(180deg, #020f1f 0%, #051c3a 50%, #020f1f 100%)",
    accent: "#38bdf8",
    gold: "#7dd3fc",
    floor: "rgba(56,189,248,0.08)",
    border: "rgba(56,189,248,0.3)",
    plank: "linear-gradient(180deg,#0c4a6e,#082f49)",
    star: false,
    particles: "bubbles",
  },
  {
    id: "forest",
    name: "フォレスト",
    emoji: "🌿",
    desc: "自然に囲まれた癒し空間",
    bg: "linear-gradient(180deg, #052e16 0%, #14532d 40%, #052e16 100%)",
    accent: "#4ade80",
    gold: "#86efac",
    floor: "rgba(74,222,128,0.08)",
    border: "rgba(74,222,128,0.25)",
    plank: "linear-gradient(180deg,#166534,#14532d)",
    star: false,
    particles: "leaves",
  },
  {
    id: "gold",
    name: "ゴールド",
    emoji: "👑",
    desc: "豪華絢爛な金のステージ",
    bg: "linear-gradient(180deg, #1c1000 0%, #2d1d00 50%, #1c1000 100%)",
    accent: "#f59e0b",
    gold: "#fcd34d",
    floor: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.4)",
    plank: "linear-gradient(180deg,#78350f,#451a03)",
    star: false,
    particles: "sparkles",
  },
];

const SHELF_ROWS = 3;
const SHELF_COLS = 6;
let uidCounter = Date.now();
const newUid = () => String(++uidCounter);

function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ── Share URL helpers ────────────────────────────────────────
// Encode altar data (no images — too large) into a compact base64 URL param
function encodeAltarToURL(altarName, templateId, altarMode, shelf, freeItems, goods) {
  // Strip images from goods for URL (too large), keep only id/name/emoji/series/status
  const goodsSlim = goods.map(g => ({
    id: g.id, name: g.name, emoji: g.emoji || "📦",
    series: g.series || "", status: g.status,
  }));
  const payload = { v:1, altarName, templateId, altarMode, shelf, freeItems, goods: goodsSlim };
  try {
    const json = JSON.stringify(payload);
    const b64  = btoa(unescape(encodeURIComponent(json)));
    return `${window.location.href.split("?")[0]}?saidan=${b64}`;
  } catch { return null; }
}

function decodeAltarFromURL() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("saidan");
    if (!raw) return null;
    const json = decodeURIComponent(escape(atob(raw)));
    return JSON.parse(json);
  } catch { return null; }
}

// ─── Root ─────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]             = useState("collection");
  const [goods, setGoods]           = useState([]);
  const [altarMode, setAltarMode]   = useState("shelf");
  const [shelf, setShelf]           = useState(Array.from({ length: SHELF_ROWS }, () => Array(SHELF_COLS).fill(null)));
  const [freeItems, setFreeItems]   = useState([]);
  const [altarName, setAltarName]   = useState("私の推し祭壇");
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput]   = useState("私の推し祭壇");
  const [templateId, setTemplateId] = useState("shrine");
  const [showAdd, setShowAdd]       = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showShare, setShowShare]   = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [loaded, setLoaded]         = useState(false);
  const [toast, setToast]           = useState(null);
  const [viewingShared, setViewingShared] = useState(false);
  const saveTimer = useRef(null);
  const nameRef   = useRef(null);

  // ── Load ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Check for shared URL first
      const shared = decodeAltarFromURL();
      if (shared) {
        if (shared.goods)      setGoods(shared.goods);
        if (shared.shelf)      setShelf(shared.shelf);
        if (shared.freeItems)  setFreeItems(shared.freeItems);
        if (shared.altarName)  { setAltarName(shared.altarName); setNameInput(shared.altarName); }
        if (shared.altarMode)  setAltarMode(shared.altarMode);
        if (shared.templateId) setTemplateId(shared.templateId);
        setViewingShared(true);
        setPage("altar");
        setLoaded(true);
        return;
      }
      // Normal load from storage
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const d = JSON.parse(raw);
          if (d.goods)      setGoods(d.goods);
          if (d.shelf)      setShelf(d.shelf);
          if (d.freeItems)  setFreeItems(d.freeItems);
          if (d.altarName)  { setAltarName(d.altarName); setNameInput(d.altarName); }
          if (d.altarMode)  setAltarMode(d.altarMode);
          if (d.templateId) setTemplateId(d.templateId);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  // ── Auto-save ─────────────────────────────────────────────
  const triggerSave = useCallback((g, s, f, n, m, t) => {
    if (!loaded) return;
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ goods: g, shelf: s, freeItems: f, altarName: n, altarMode: m, templateId: t }));
        setSaveStatus("saved"); setTimeout(() => setSaveStatus(null), 2000);
      } catch { setSaveStatus("error"); setTimeout(() => setSaveStatus(null), 3000); }
    }, 700);
  }, [loaded]);

  useEffect(() => {
    if (loaded) triggerSave(goods, shelf, freeItems, altarName, altarMode, templateId);
  }, [goods, shelf, freeItems, altarName, altarMode, templateId, loaded]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200); };

  // ── Goods CRUD ────────────────────────────────────────────
  const addGood    = (g) => { setGoods(prev => [g, ...prev]); showToast("グッズを追加しました ✓"); };
  const updateStatus = (id, status) => setGoods(prev => prev.map(g => g.id === id ? { ...g, status } : g));
  const deleteGood = (id) => {
    setGoods(prev => prev.filter(g => g.id !== id));
    setShelf(prev => prev.map(row => row.map(c => c === id ? null : c)));
    setFreeItems(prev => prev.filter(i => i.goodId !== id));
    showToast("削除しました");
  };

  const commitName = () => {
    const t = nameInput.trim(); if (t) setAltarName(t); else setNameInput(altarName);
    setEditingName(false);
  };

  const goodById = (id) => goods.find(g => g.id === id);
  const template = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  const counts = {
    total: goods.length,
    owned: goods.filter(g => g.status === "owned").length,
    wanted: goods.filter(g => g.status === "wanted").length,
    reserved: goods.filter(g => g.status === "reserved").length,
    onAltar: [...new Set([...shelf.flat().filter(Boolean), ...freeItems.map(i => i.goodId)])].length,
  };
  const saveLabel = { saving: "💾 保存中…", saved: "✓ 保存済み", error: "⚠ 失敗" }[saveStatus] || "";
  const saveColor = { saving: "#facc15", saved: "#4ade80", error: "#f87171" }[saveStatus];

  return (
    <div style={S.root}>
      {toast && <div style={S.toast}>{toast}</div>}

      {/* Shared view banner */}
      {viewingShared && (
        <div style={{ background:"linear-gradient(90deg,rgba(232,121,249,0.15),rgba(129,140,248,0.15))", borderBottom:"1px solid rgba(232,121,249,0.25)", padding:"8px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:12 }}>
          <span style={{ color:"#e879f9", fontWeight:700 }}>👁 シェアされた祭壇を閲覧中</span>
          <button onClick={() => { window.history.replaceState({}, "", window.location.pathname); setViewingShared(false); setGoods([]); setShelf(Array.from({length:SHELF_ROWS},()=>Array(SHELF_COLS).fill(null))); setFreeItems([]); setPage("collection"); }} style={{ fontSize:11, color:"#9ca3af", background:"rgba(255,255,255,0.08)", border:"none", borderRadius:10, padding:"3px 10px", cursor:"pointer" }}>
            自分の祭壇に戻る →
          </button>
        </div>
      )}

      <header style={S.header}>
        <div style={S.logo}>
          <span style={{ fontSize: 24 }}>⛩</span>
          <div>
            <div style={S.logoText}>SAIDAN</div>
            <div style={S.logoSub}>推しグッズ管理 & 祭壇メーカー</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saveLabel && !viewingShared && <span style={{ fontSize: 11, fontWeight: 700, color: saveColor }}>{saveLabel}</span>}
          <nav style={{ display: "flex", gap: 6 }}>
            {[["collection","📦 コレクション"],["altar","⛩ 祭壇"]].map(([p,l]) => (
              <button key={p} onClick={() => setPage(p)} style={{ ...S.navBtn, ...(page===p?S.navBtnOn:{}) }}>{l}</button>
            ))}
          </nav>
        </div>
      </header>

      {page === "collection"
        ? <CollectionPage goods={goods} counts={counts} onAdd={() => setShowAdd(true)} onUpdateStatus={updateStatus} onDelete={deleteGood} loaded={loaded} />
        : <AltarPage
            goods={goods} shelf={shelf} setShelf={setShelf}
            freeItems={freeItems} setFreeItems={setFreeItems}
            altarMode={altarMode} setAltarMode={setAltarMode}
            altarName={altarName} editingName={editingName}
            nameInput={nameInput} nameRef={nameRef}
            template={template}
            viewingShared={viewingShared}
            onStartEdit={() => { setNameInput(altarName); setEditingName(true); setTimeout(() => nameRef.current?.focus(), 30); }}
            onNameChange={setNameInput} onCommitName={commitName}
            onNameKey={e => { if(e.key==="Enter") commitName(); if(e.key==="Escape"){ setNameInput(altarName); setEditingName(false); } }}
            goodById={goodById} showToast={showToast}
            onOpenTemplates={() => setShowTemplates(true)}
            onOpenShare={() => setShowShare(true)}
          />
      }

      {showAdd && !viewingShared && <AddModal onClose={() => setShowAdd(false)} onAdd={addGood} />}
      {showTemplates && <TemplateModal current={templateId} onSelect={id => { setTemplateId(id); setShowTemplates(false); showToast("テンプレートを変更しました ✓"); }} onClose={() => setShowTemplates(false)} />}
      {showShare && <ShareModal altarName={altarName} template={template} shelf={shelf} freeItems={freeItems} altarMode={altarMode} goodById={goodById} goods={goods} templateId={templateId} onClose={() => setShowShare(false)} />}
    </div>
  );
}

// ─── Collection Page ──────────────────────────────────────────
function CollectionPage({ goods, counts, onAdd, onUpdateStatus, onDelete, loaded }) {
  const [filter, setFilter] = useState("all");
  const [confirmId, setConfirmId] = useState(null);
  const visible = goods.filter(g => filter==="all" || g.status===filter);

  return (
    <main style={S.main}>
      <div style={S.statsRow}>
        {[
          { label:"総グッズ数", val:counts.total,    color:"#e879f9" },
          { label:"持ってる",   val:counts.owned,    color:"#22c55e" },
          { label:"予約済み",   val:counts.reserved, color:"#60a5fa" },
          { label:"欲しい",     val:counts.wanted,   color:"#f59e0b" },
          { label:"祭壇に飾中", val:counts.onAltar,  color:"#a78bfa" },
        ].map(s => (
          <div key={s.label} style={S.statCard}>
            <div style={{ fontSize:22, fontWeight:900, color:s.color }}>{s.val}</div>
            <div style={{ fontSize:10, color:"#7c6a9a", marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={S.toolbar}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {[["all","すべて"],["owned","持ってる"],["reserved","予約済み"],["wanted","欲しい"]].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ ...S.filterBtn, ...(filter===v?S.filterBtnOn:{}) }}>{l}</button>
          ))}
        </div>
        <button onClick={onAdd} style={S.addBtn}>＋ グッズ追加</button>
      </div>
      {!loaded ? <div style={S.emptyMsg}>読み込み中…</div>
      : visible.length===0 ? (
        <div style={S.emptyState}>
          <div style={{ fontSize:52, marginBottom:10 }}>📦</div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>{goods.length===0?"まだグッズが登録されていません":"該当グッズなし"}</div>
          {goods.length===0 && <div style={{ fontSize:12, opacity:0.5 }}>「＋ グッズ追加」から登録しよう</div>}
        </div>
      ) : (
        <div style={S.grid}>
          {visible.map(g => <GoodCard key={g.id} good={g} onStatusChange={s => onUpdateStatus(g.id,s)} onDelete={() => setConfirmId(g.id)} />)}
        </div>
      )}
      {confirmId && (
        <div style={S.overlay} onClick={() => setConfirmId(null)}>
          <div style={S.confirmBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:17, fontWeight:800, marginBottom:6 }}>グッズを削除しますか？</div>
            <div style={{ fontSize:12, opacity:0.5, marginBottom:20 }}>祭壇からも取り除かれます</div>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={() => setConfirmId(null)} style={S.btnGhost}>キャンセル</button>
              <button onClick={() => { onDelete(confirmId); setConfirmId(null); }} style={S.btnDanger}>削除する</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function GoodCard({ good, onStatusChange, onDelete }) {
  const st = STATUS[good.status];
  const [open, setOpen] = useState(false);
  return (
    <div style={S.card}>
      <div style={S.cardImgWrap}>
        {good.image ? <img src={good.image} alt={good.name} style={S.cardImg} /> : <div style={S.cardEmoji}>{good.emoji||"📦"}</div>}
        <div style={{ ...S.badge, background:st.bg, color:st.color }}>{st.icon} {st.label}</div>
      </div>
      <div style={S.cardBody}>
        <div style={S.cardName}>{good.name}</div>
        {good.series && <div style={S.cardSeries}>{good.series}</div>}
        {good.purchaseDate && <div style={S.cardMeta}>📅 {good.purchaseDate}</div>}
        {good.releaseDate  && <div style={S.cardMeta}>🔖 発売: {good.releaseDate}</div>}
      </div>
      <div style={S.cardActions}>
        <div style={{ position:"relative" }}>
          <button onClick={() => setOpen(o=>!o)} style={{ ...S.iconBtn, color:st.color }}>⇄</button>
          {open && (
            <div style={S.statusMenu} onMouseLeave={() => setOpen(false)}>
              {Object.entries(STATUS).map(([k,v]) => (
                <button key={k} onClick={() => { onStatusChange(k); setOpen(false); }}
                  style={{ ...S.statusMenuItem, color:v.color, background:good.status===k?v.bg:"transparent" }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onDelete} style={{ ...S.iconBtn, color:"#ef4444" }}>🗑</button>
      </div>
    </div>
  );
}

// ─── Altar Page ───────────────────────────────────────────────
function AltarPage({ goods, shelf, setShelf, freeItems, setFreeItems, altarMode, setAltarMode, altarName, editingName, nameInput, nameRef, template, onStartEdit, onNameChange, onCommitName, onNameKey, goodById, showToast, onOpenTemplates, onOpenShare }) {
  const ownedGoods = goods.filter(g => g.status==="owned" || g.status==="reserved");
  const onShelf = new Set(shelf.flat().filter(Boolean));
  const onFree  = new Set(freeItems.map(i => i.goodId));
  const isDark  = template.dark !== false;

  // shelf drag
  const [dragSrcGood, setDragSrcGood] = useState(null);
  const [dragSrcCell, setDragSrcCell] = useState(null);
  const [hoverCell, setHoverCell]     = useState(null);

  // free drag
  const [draggingFree, setDraggingFree]   = useState(null);
  const [dragOffsetFree, setDragOffsetFree] = useState({ x:0, y:0 });
  const [selectedFree, setSelectedFree]   = useState(null);
  const freeRef  = useRef(null);
  const maxZFree = useRef(10);

  const placeOnShelf = (goodId, r, c) => {
    setShelf(prev => {
      const n = prev.map(row=>[...row]);
      for (let ri=0;ri<SHELF_ROWS;ri++) for (let ci=0;ci<SHELF_COLS;ci++) if(n[ri][ci]===goodId) n[ri][ci]=null;
      n[r][c]=goodId; return n;
    });
  };
  const swapShelf = (r1,c1,r2,c2) => setShelf(prev=>{ const n=prev.map(r=>[...r]); [n[r1][c1],n[r2][c2]]=[n[r2][c2],n[r1][c1]]; return n; });
  const removeShelf = (r,c) => setShelf(prev=>{ const n=prev.map(row=>[...row]); n[r][c]=null; return n; });

  const handleShelfDrop = (r,c) => {
    if (dragSrcGood) { placeOnShelf(dragSrcGood,r,c); showToast("棚に配置しました ✓"); setDragSrcGood(null); }
    else if (dragSrcCell) { const [sr,sc]=dragSrcCell; if(sr!==r||sc!==c) swapShelf(sr,sc,r,c); setDragSrcCell(null); }
    setHoverCell(null);
  };

  const addFreeItem = (goodId) => {
    if (onFree.has(goodId)) return;
    maxZFree.current++;
    setFreeItems(prev=>[...prev,{ id:newUid(), goodId, x:80+Math.random()*320, y:80+Math.random()*160, scale:1, zIndex:maxZFree.current }]);
    showToast("自由配置に追加しました ✓");
  };
  const removeFreeItem = (id) => setFreeItems(prev=>prev.filter(i=>i.id!==id));
  const scaleFreeItem  = (id,d) => setFreeItems(prev=>prev.map(i=>i.id===id?{...i,scale:Math.max(0.5,Math.min(2.5,i.scale+d))}:i));

  const startFreeDrag = useCallback((e,id) => {
    e.preventDefault(); e.stopPropagation();
    const rect=freeRef.current.getBoundingClientRect();
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const cy=e.touches?e.touches[0].clientY:e.clientY;
    const item=freeItems.find(i=>i.id===id);
    maxZFree.current++;
    setFreeItems(prev=>prev.map(i=>i.id===id?{...i,zIndex:maxZFree.current}:i));
    setDraggingFree(id); setDragOffsetFree({x:cx-rect.left-item.x, y:cy-rect.top-item.y});
  },[freeItems]);

  const onFreeMove = useCallback((e) => {
    if(!draggingFree) return;
    const rect=freeRef.current?.getBoundingClientRect(); if(!rect) return;
    const cx=e.touches?e.touches[0].clientX:e.clientX;
    const cy=e.touches?e.touches[0].clientY:e.clientY;
    setFreeItems(prev=>prev.map(i=>i.id===draggingFree?{...i,x:cx-rect.left-dragOffsetFree.x,y:cy-rect.top-dragOffsetFree.y}:i));
  },[draggingFree,dragOffsetFree]);

  const endFreeDrag = useCallback(()=>setDraggingFree(null),[]);

  useEffect(()=>{
    window.addEventListener("mousemove",onFreeMove);
    window.addEventListener("mouseup",endFreeDrag);
    window.addEventListener("touchmove",onFreeMove,{passive:false});
    window.addEventListener("touchend",endFreeDrag);
    return ()=>{
      window.removeEventListener("mousemove",onFreeMove);
      window.removeEventListener("mouseup",endFreeDrag);
      window.removeEventListener("touchmove",onFreeMove);
      window.removeEventListener("touchend",endFreeDrag);
    };
  },[onFreeMove,endFreeDrag]);

  const textColor = isDark ? "#f0e8ff" : "#1a0030";
  const mutedColor = isDark ? "#7c6a9a" : "#9966aa";

  return (
    <main style={S.main}>
      {/* Name row */}
      <div style={{ marginBottom:12 }}>
        {editingName ? (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input ref={nameRef} value={nameInput} onChange={e=>onNameChange(e.target.value)} onBlur={onCommitName} onKeyDown={onNameKey} maxLength={30}
              style={{ flex:1, fontSize:20, fontWeight:800, background:"transparent", border:"none", borderBottom:"2px solid #e879f9", color:textColor, outline:"none", padding:"2px 4px" }} />
            <button onClick={onCommitName} style={S.nameSaveBtn}>完了</button>
          </div>
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={onStartEdit}>
            <span style={{ fontSize:20, fontWeight:900, color:textColor, borderBottom:"2px dashed rgba(232,121,249,0.3)", paddingBottom:2 }}>{altarName}</span>
            <span style={{ fontSize:11, color:mutedColor, background:"rgba(232,121,249,0.1)", padding:"2px 8px", borderRadius:10, border:"1px solid rgba(232,121,249,0.2)" }}>✏ 編集</span>
          </div>
        )}
      </div>

      {/* Action row */}
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", gap:6 }}>
          {[["shelf","🗄 棚"],["free","✦ 自由配置"]].map(([m,l])=>(
            <button key={m} onClick={()=>setAltarMode(m)} style={{ ...S.modeBtn, ...(altarMode===m?S.modeBtnOn:{}) }}>{l}</button>
          ))}
        </div>
        <button onClick={onOpenTemplates} style={{ ...S.modeBtn, border:`1px solid ${template.border}`, color:template.accent }}>
          {template.emoji} テンプレ変更
        </button>
        <button onClick={onOpenShare} style={{ ...S.shareBtn }}>
          📸 画像を保存
        </button>
        <div style={{ fontSize:11, color:mutedColor, marginLeft:"auto" }}>
          {altarMode==="shelf"?"ドラッグ→棚へ":"クリックで配置"}
        </div>
      </div>

      {/* ── Shelf Mode ── */}
      {altarMode==="shelf" && (
        <AltarShelf shelf={shelf} template={template} altarName={altarName} goodById={goodById}
          dragSrcGood={dragSrcGood} dragSrcCell={dragSrcCell} hoverCell={hoverCell}
          setDragSrcGood={setDragSrcGood} setDragSrcCell={setDragSrcCell}
          setHoverCell={setHoverCell} onDrop={handleShelfDrop} onRemove={removeShelf}
          isDark={isDark}
        />
      )}

      {/* ── Free Mode ── */}
      {altarMode==="free" && (
        <div ref={freeRef} onClick={()=>setSelectedFree(null)}
          style={{ ...S.altarBg, background:template.bg, border:`1px solid ${template.border}`, height:380, position:"relative", overflow:"hidden", cursor:draggingFree?"grabbing":"default" }}>
          <AltarTopBar template={template} altarName={altarName} />
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:"30%", background:template.floor, borderTop:`1px solid ${template.border}` }} />
          {template.star && <StarField />}
          {freeItems.length===0 && (
            <div style={{ position:"absolute", top:"55%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center", color:`${template.accent}44`, pointerEvents:"none" }}>
              <div style={{ fontSize:32, marginBottom:6 }}>✦</div>
              <div style={{ fontSize:12 }}>下のグッズをクリックして配置しよう</div>
            </div>
          )}
          {freeItems.map(item=>{
            const good=goodById(item.goodId); if(!good) return null;
            const isSel=selectedFree===item.id;
            return (
              <div key={item.id}
                onMouseDown={e=>{e.stopPropagation();setSelectedFree(item.id);startFreeDrag(e,item.id);}}
                onTouchStart={e=>{e.stopPropagation();setSelectedFree(item.id);startFreeDrag(e,item.id);}}
                onClick={e=>{e.stopPropagation();setSelectedFree(item.id);}}
                style={{ position:"absolute", left:item.x, top:item.y, transform:`translate(-50%,-50%) scale(${item.scale})`, zIndex:item.zIndex, cursor:draggingFree===item.id?"grabbing":"grab", filter:isSel?`drop-shadow(0 0 10px ${template.accent})`:"drop-shadow(0 3px 8px rgba(0,0,0,0.5))", transition:draggingFree===item.id?"none":"filter 0.2s" }}>
                {good.image?<img src={good.image} alt={good.name} style={{ width:56, height:72, objectFit:"contain" }}/>:<div style={{ fontSize:46, lineHeight:1 }}>{good.emoji||"📦"}</div>}
                <div style={{ fontSize:8, textAlign:"center", color:isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.35)", whiteSpace:"nowrap", marginTop:1 }}>{good.name}</div>
                {isSel && (
                  <div style={{ position:"absolute", top:-34, left:"50%", transform:"translateX(-50%)", display:"flex", gap:4, background:isDark?"rgba(10,5,20,0.95)":"rgba(255,255,255,0.95)", borderRadius:20, padding:"4px 8px", border:`1px solid ${template.border}`, boxShadow:"0 4px 16px rgba(0,0,0,0.4)" }}>
                    {[{l:"−",a:()=>scaleFreeItem(item.id,-0.15)},{l:"+",a:()=>scaleFreeItem(item.id,+0.15)},{l:"🗑",a:()=>{removeFreeItem(item.id);setSelectedFree(null);}}].map(b=>(
                      <button key={b.l} onMouseDown={e=>{e.stopPropagation();b.a();}} style={{ width:22,height:22,border:"none",borderRadius:"50%",background:b.l==="🗑"?"rgba(239,68,68,0.2)":`${template.accent}22`,color:b.l==="🗑"?"#ef4444":template.accent,fontSize:11,cursor:"pointer",fontWeight:900,padding:0,display:"flex",alignItems:"center",justifyContent:"center" }}>{b.l}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tray */}
      <div style={S.trayWrap}>
        <div style={S.trayTitle}>📦 持ってる・予約済みグッズ <span style={{ fontSize:11, opacity:0.4, marginLeft:6 }}>{altarMode==="shelf"?"ドラッグして棚へ":"クリックで配置"}</span></div>
        {ownedGoods.length===0 ? (
          <div style={{ padding:"18px", textAlign:"center", opacity:0.4, fontSize:13 }}>「持ってる」か「予約済み」のグッズを登録すると表示されます</div>
        ) : (
          <div style={S.tray}>
            {ownedGoods.map(g=>{
              const placed=altarMode==="shelf"?onShelf.has(g.id):onFree.has(g.id);
              return (
                <div key={g.id}
                  draggable={altarMode==="shelf"&&!placed}
                  onDragStart={()=>altarMode==="shelf"&&!placed&&setDragSrcGood(g.id)}
                  onDragEnd={()=>setDragSrcGood(null)}
                  onClick={()=>altarMode==="free"&&!placed&&addFreeItem(g.id)}
                  style={{ ...S.trayItem, opacity:placed?0.3:1, cursor:placed?"default":altarMode==="free"?"pointer":"grab", outline:dragSrcGood===g.id?"2px solid #e879f9":"none" }}
                  title={placed?"配置済み":g.name}
                >
                  {g.image?<img src={g.image} alt={g.name} style={S.trayItemImg}/>:<div style={S.trayItemEmoji}>{g.emoji||"📦"}</div>}
                  <div style={S.trayItemLabel}>{g.name}</div>
                  <div style={{ ...S.badge, fontSize:8, padding:"1px 5px", background:STATUS[g.status].bg, color:STATUS[g.status].color, position:"static", marginTop:2 }}>{STATUS[g.status].label}</div>
                  {placed && <div style={S.trayCheckBadge}>✓</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

// ── AltarShelf (extracted for reuse in Share) ─────────────────
function AltarShelf({ shelf, template, altarName, goodById, dragSrcGood, dragSrcCell, hoverCell, setDragSrcGood, setDragSrcCell, setHoverCell, onDrop, onRemove, isDark, forExport=false }) {
  return (
    <div style={{ ...S.altarBg, background:template.bg, border:`1px solid ${template.border}`, marginBottom:forExport?0:16, position:"relative", overflow:"hidden" }}>
      {template.star && <StarField />}
      <AltarTopBar template={template} altarName={altarName} />
      {shelf.map((row,rIdx)=>(
        <div key={rIdx} style={{ ...S.shelfRow, pointerEvents:forExport?"none":"auto" }}>
          <div style={{ ...S.shelfPlank, background:template.plank }} />
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${SHELF_COLS},1fr)`, gap:6, paddingBottom:14 }}>
            {row.map((cellId,cIdx)=>{
              const good=cellId?goodById(cellId):null;
              const isHov=hoverCell?.[0]===rIdx&&hoverCell?.[1]===cIdx;
              const isDragSrc=dragSrcCell?.[0]===rIdx&&dragSrcCell?.[1]===cIdx;
              return (
                <div key={cIdx}
                  style={{ ...S.shelfCell, background:isHov?`${template.accent}28`:"transparent", outline:isHov?`2px dashed ${template.accent}`:isDragSrc?"2px dashed rgba(255,255,255,0.2)":"none", opacity:isDragSrc?0.4:1 }}
                  onDragOver={e=>{if(!forExport){e.preventDefault();setHoverCell([rIdx,cIdx]);}}}
                  onDragLeave={()=>!forExport&&setHoverCell(null)}
                  onDrop={()=>!forExport&&onDrop(rIdx,cIdx)}
                >
                  {good?(
                    <div style={S.shelfItem} draggable={!forExport} onDragStart={()=>!forExport&&setDragSrcCell([rIdx,cIdx])} onDragEnd={()=>!forExport&&setDragSrcCell(null)}>
                      {good.image?<img src={good.image} alt={good.name} style={S.shelfItemImg}/>:<div style={S.shelfItemEmoji}>{good.emoji||"📦"}</div>}
                      <div style={{ ...S.shelfItemLabel, color:isDark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)" }}>{good.name}</div>
                      {!forExport&&<button style={S.removeCellBtn} onClick={()=>onRemove(rIdx,cIdx)}>×</button>}
                    </div>
                  ):(
                    !forExport&&<div style={{ ...S.emptyCellHint, color:`${template.accent}33` }}>{isHov?"ここへ":"+"}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AltarTopBar({ template, altarName }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, padding:"10px 20px", borderBottom:`1px solid ${template.border}`, color:template.accent, background:`${template.accent}08`, fontSize:14 }}>
      <span>{template.emoji}</span>
      <span style={{ fontSize:13, fontWeight:700, letterSpacing:2 }}>{altarName}</span>
      <span>{template.emoji}</span>
    </div>
  );
}

function StarField() {
  return <>
    {[...Array(24)].map((_,i)=>(
      <div key={i} style={{ position:"absolute", width:i%4===0?3:2, height:i%4===0?3:2, borderRadius:"50%", background:"#fff", opacity:0.15+(i*0.02)%0.4, left:`${5+(i*43)%90}%`, top:`${3+(i*29)%60}%`, animation:`twinkle ${2+i%3}s ease-in-out ${i*0.2}s infinite alternate`, pointerEvents:"none" }}/>
    ))}
    <style>{`@keyframes twinkle{from{opacity:0.1;}to{opacity:0.6;}}`}</style>
  </>;
}

// ─── Template Modal ───────────────────────────────────────────
function TemplateModal({ current, onSelect, onClose }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth:520 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#e879f9" }}>テンプレートを選ぶ</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:18, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {TEMPLATES.map(t=>(
            <button key={t.id} onClick={()=>onSelect(t.id)} style={{ background:t.bg, border:`2px solid ${current===t.id?t.accent:"transparent"}`, borderRadius:14, padding:"16px 10px", cursor:"pointer", textAlign:"center", transition:"all 0.2s", position:"relative", overflow:"hidden" }}>
              {current===t.id && <div style={{ position:"absolute", top:6, right:6, fontSize:10, background:t.accent, color:"#fff", borderRadius:20, padding:"1px 6px", fontWeight:700 }}>✓ 選択中</div>}
              <div style={{ fontSize:28, marginBottom:6 }}>{t.emoji}</div>
              <div style={{ fontSize:13, fontWeight:800, color:t.dark===false?"#1a0030":"#f0e8ff" }}>{t.name}</div>
              <div style={{ fontSize:10, color:t.accent, marginTop:3 }}>{t.desc}</div>
              <div style={{ marginTop:8, display:"flex", gap:4, justifyContent:"center" }}>
                {[t.accent, t.gold, t.border].map((c,i)=>(
                  <div key={i} style={{ width:12, height:12, borderRadius:"50%", background:c, opacity:0.8 }}/>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────
function ShareModal({ altarName, template, shelf, freeItems, altarMode, goodById, goods, templateId, onClose }) {
  const canvasRef = useRef(null);
  const [generating, setGenerating] = useState(true);
  const [imgSrc, setImgSrc] = useState(null);
  const [shareUrl, setShareUrl] = useState(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("image"); // "image" | "url"
  const isDark = template.dark !== false;

  useEffect(() => {
    // Generate share URL
    const url = encodeAltarToURL(altarName, templateId, altarMode, shelf, freeItems, goods || []);
    setShareUrl(url);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      generateImage();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const generateImage = async () => {
    setGenerating(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const W = 800, H = 500;
      canvas.width = W; canvas.height = H;

      // Background gradient
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      const bgColors = template.bg.match(/#[0-9a-f]{3,6}/gi) || ["#0c0a14","#1a0f2e"];
      grd.addColorStop(0, bgColors[0]);
      grd.addColorStop(1, bgColors[bgColors.length-1]);
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      // Floor
      ctx.fillStyle = template.floor;
      ctx.fillRect(0, H*0.68, W, H*0.32);

      // Top bar
      ctx.fillStyle = `${template.accent}18`;
      ctx.fillRect(0, 0, W, 52);
      ctx.strokeStyle = template.border;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0,52); ctx.lineTo(W,52); ctx.stroke();
      // Top bar text
      ctx.fillStyle = template.accent;
      ctx.font = "bold 15px 'Hiragino Sans',sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${template.emoji}  ${altarName}  ${template.emoji}`, W/2, 34);

      // Stars for night theme
      if (template.star) {
        ctx.fillStyle = "#ffffff";
        for (let i=0;i<30;i++) {
          const x=(i*137)%W, y=60+(i*89)%(H*0.5);
          const r=i%5===0?2:1;
          ctx.globalAlpha=0.2+(i*0.02)%0.4;
          ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
        }
        ctx.globalAlpha=1;
      }

      if (altarMode==="shelf") {
        // Draw shelves
        const shelfTop = 60, shelfH = (H-80-60)/SHELF_ROWS;
        const itemW = 64, itemH = 80;
        const cellW = (W-40)/SHELF_COLS;

        for (let r=0;r<SHELF_ROWS;r++) {
          const rowY = shelfTop + r*shelfH;
          // Plank
          const plankGrd = ctx.createLinearGradient(0, rowY+shelfH-12, 0, rowY+shelfH);
          const plankColors = template.plank.match(/#[0-9a-f]{3,6}/gi)||["#3d2060","#2a1540"];
          plankGrd.addColorStop(0, plankColors[0]);
          plankGrd.addColorStop(1, plankColors[plankColors.length-1]);
          ctx.fillStyle = plankGrd;
          ctx.beginPath();
          ctx.roundRect(20, rowY+shelfH-10, W-40, 10, 3);
          ctx.fill();

          for (let c=0;c<SHELF_COLS;c++) {
            const goodId = shelf[r][c];
            if (!goodId) continue;
            const good = goodById(goodId);
            if (!good) continue;
            const cx = 20 + c*cellW + cellW/2;
            const cy = rowY + shelfH - 12;
            const x = cx - itemW/2;
            const y = cy - itemH;

            if (good.image) {
              await new Promise(res => {
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                  ctx.drawImage(img, x, y, itemW, itemH);
                  // label
                  ctx.fillStyle = isDark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)";
                  ctx.font = "9px 'Hiragino Sans',sans-serif";
                  ctx.textAlign = "center";
                  ctx.fillText(good.name.substring(0,8), cx, cy+10);
                  res();
                };
                img.onerror = res;
                img.src = good.image;
              });
            } else {
              ctx.font = `${itemH*0.65}px serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(good.emoji||"📦", cx, y+itemH/2);
              ctx.textBaseline = "alphabetic";
              ctx.fillStyle = isDark?"rgba(255,255,255,0.5)":"rgba(0,0,0,0.4)";
              ctx.font = "9px sans-serif";
              ctx.fillText(good.name.substring(0,8), cx, cy+10);
            }
          }
        }
      } else {
        // Free mode
        for (const item of freeItems) {
          const good = goodById(item.goodId);
          if (!good) continue;
          const sc = item.scale;
          const iw=56*sc, ih=72*sc;
          const x=item.x-iw/2, y=item.y-ih/2;
          if (good.image) {
            await new Promise(res => {
              const img = new Image();
              img.crossOrigin="anonymous";
              img.onload=()=>{ ctx.drawImage(img,x,y,iw,ih); res(); };
              img.onerror=res;
              img.src=good.image;
            });
          } else {
            ctx.font = `${ih*0.7}px serif`;
            ctx.textAlign="center"; ctx.textBaseline="middle";
            ctx.fillText(good.emoji||"📦", x+iw/2, y+ih/2);
            ctx.textBaseline="alphabetic";
          }
          ctx.fillStyle=isDark?"rgba(255,255,255,0.4)":"rgba(0,0,0,0.35)";
          ctx.font="9px sans-serif"; ctx.textAlign="center";
          ctx.fillText(good.name.substring(0,8), item.x, item.y+ih/2+12);
        }
      }

      // Watermark
      ctx.fillStyle = isDark?"rgba(232,121,249,0.3)":"rgba(150,0,200,0.25)";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("⛩ SAIDAN", W-16, H-12);

      setImgSrc(canvas.toDataURL("image/png"));
    } catch(e) {
      console.error(e);
    }
    setGenerating(false);
  };

  const download = () => {
    const a = document.createElement("a");
    a.href = imgSrc;
    a.download = `${altarName}.png`;
    a.click();
  };

  const copyToClipboard = async () => {
    try {
      const blob = await (await fetch(imgSrc)).blob();
      await navigator.clipboard.write([new ClipboardItem({"image/png":blob})]);
    } catch { alert("コピーに失敗しました。ダウンロードをお試しください。"); }
  };

  const copyUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2500);
    } catch { alert("コピーに失敗しました"); }
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth:500 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#e879f9" }}>祭壇をシェア</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:18, cursor:"pointer" }}>✕</button>
        </div>

        {/* Tab switcher */}
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {[["image","📸 画像保存"],["url","🔗 URLシェア"]].map(([t,l])=>(
            <button key={t} onClick={()=>setActiveTab(t)} style={{ flex:1, padding:"8px", borderRadius:10, border:`1px solid ${activeTab===t?"rgba(232,121,249,0.4)":"rgba(255,255,255,0.08)"}`, background:activeTab===t?"rgba(232,121,249,0.15)":"transparent", color:activeTab===t?"#e879f9":"#9ca3af", fontSize:13, fontWeight:700, cursor:"pointer" }}>{l}</button>
          ))}
        </div>

        <canvas ref={canvasRef} style={{ display:"none" }} />

        {/* ── Image tab ── */}
        {activeTab==="image" && (<>
          <div style={{ borderRadius:12, overflow:"hidden", border:"1px solid rgba(232,121,249,0.2)", marginBottom:16, minHeight:180, display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0414" }}>
            {generating ? (
              <div style={{ textAlign:"center", color:"#7c6a9a", padding:40 }}>
                <div style={{ fontSize:32, marginBottom:8, animation:"spin 1s linear infinite" }}>⛩</div>
                <div style={{ fontSize:13 }}>画像を生成中…</div>
                <style>{`@keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}`}</style>
              </div>
            ) : imgSrc ? (
              <img src={imgSrc} alt="祭壇プレビュー" style={{ width:"100%", borderRadius:12 }} />
            ) : (
              <div style={{ color:"#f87171", padding:20, fontSize:13 }}>生成に失敗しました</div>
            )}
          </div>
          {!generating && imgSrc && (
            <>
              <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                <button onClick={download} style={{ flex:1, padding:"11px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#e879f9,#818cf8)", color:"#fff", fontSize:13, fontWeight:800, cursor:"pointer" }}>⬇ ダウンロード</button>
                <button onClick={copyToClipboard} style={{ flex:1, padding:"11px", borderRadius:12, border:"1px solid rgba(232,121,249,0.3)", background:"rgba(232,121,249,0.1)", color:"#e879f9", fontSize:13, fontWeight:700, cursor:"pointer" }}>📋 クリップボードへ</button>
              </div>
              <div style={{ fontSize:11, color:"#5c4d7a", textAlign:"center" }}>XやInstagramにそのまま投稿できます 🎉</div>
            </>
          )}
        </>)}

        {/* ── URL tab ── */}
        {activeTab==="url" && (<>
          <div style={{ background:"rgba(232,121,249,0.06)", border:"1px solid rgba(232,121,249,0.2)", borderRadius:12, padding:"16px", marginBottom:14 }}>
            <div style={{ fontSize:12, color:"#9ca3af", marginBottom:8, fontWeight:600 }}>シェアURL</div>
            <div style={{ fontSize:10, color:"#e879f9", wordBreak:"break-all", lineHeight:1.6, fontFamily:"monospace", background:"rgba(0,0,0,0.3)", padding:"10px", borderRadius:8, maxHeight:80, overflowY:"auto" }}>
              {shareUrl || "URLを生成中…"}
            </div>
          </div>

          <button onClick={copyUrl} style={{ width:"100%", padding:"12px", borderRadius:14, background: urlCopied ? "rgba(34,197,94,0.2)" : "linear-gradient(135deg,#e879f9,#818cf8)", color: urlCopied ? "#22c55e" : "#fff", fontSize:14, fontWeight:800, cursor:"pointer", marginBottom:12, border: urlCopied ? "1px solid #22c55e" : "none" }}>
            {urlCopied ? "✓ コピーしました！" : "🔗 URLをコピー"}
          </button>

          <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, padding:"12px 14px", fontSize:11, color:"#fbbf24", lineHeight:1.7 }}>
            <div style={{ fontWeight:700, marginBottom:4 }}>⚠ 注意事項</div>
            <div>• 画像アップロードしたグッズはURLに含まれません（絵文字グッズのみ共有されます）</div>
            <div>• URLを受け取った人は祭壇を閲覧できますが、編集はできません</div>
            <div>• URLが長くなる場合があります（グッズが多いほど長くなります）</div>
          </div>

          <div style={{ marginTop:14, display:"flex", gap:8 }}>
            <button onClick={() => { const text = `${altarName} の推し祭壇を見てね⛩✨ #SAIDAN ${shareUrl}`; navigator.clipboard.writeText(text).then(()=>alert("Xポスト用テキストをコピーしました！")); }} style={{ flex:1, padding:"9px", borderRadius:12, border:"1px solid rgba(129,140,248,0.3)", background:"rgba(129,140,248,0.1)", color:"#818cf8", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              𝕏 ポスト用テキストをコピー
            </button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ─── Add Modal ────────────────────────────────────────────────
function AddModal({ onClose, onAdd }) {
  const [name, setName]           = useState("");
  const [series, setSeries]       = useState("");
  const [status, setStatus]       = useState("owned");
  const [image, setImage]         = useState(null);
  const [emoji, setEmoji]         = useState("📦");
  const [imgMode, setImgMode]     = useState("emoji");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [releaseDate, setReleaseDate]   = useState("");
  const [memo, setMemo]           = useState("");
  const [error, setError]         = useState("");
  const fileRef = useRef(null);
  const EMOJIS  = ["📦","🧸","🖼️","🪆","🎀","🎵","📚","🎮","☕","⭐","🌸","💎","🎪","🖊️","🎭","🏆"];

  const handleFile = async (e) => {
    const file=e.target.files[0]; if(!file) return;
    if(file.size>5*1024*1024){setError("画像は5MB以下にしてください");return;}
    setImage(await readFileAsDataURL(file)); setError("");
  };

  const submit = () => {
    if(!name.trim()){setError("グッズ名を入力してください");return;}
    onAdd({ id:newUid(), name:name.trim(), series:series.trim(), status, image:imgMode==="upload"?image:null, emoji:imgMode==="emoji"?emoji:"📦", purchaseDate, releaseDate, memo:memo.trim(), createdAt:new Date().toISOString() });
    onClose();
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
          <div style={{ fontSize:18, fontWeight:800, color:"#e879f9" }}>グッズを追加</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#9ca3af", fontSize:18, cursor:"pointer" }}>✕</button>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          {Object.entries(STATUS).map(([k,v])=>(
            <button key={k} onClick={()=>setStatus(k)} style={{ flex:1, padding:"8px 4px", borderRadius:12, fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.2s", background:status===k?v.bg:"transparent", color:status===k?v.color:"#666", border:`2px solid ${status===k?v.color:"transparent"}` }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {[["emoji","絵文字"],["upload","画像アップロード"]].map(([m,l])=>(
            <button key={m} onClick={()=>setImgMode(m)} style={{ flex:1, padding:"7px", borderRadius:10, border:`1px solid ${imgMode===m?"rgba(232,121,249,0.4)":"rgba(255,255,255,0.1)"}`, background:imgMode===m?"rgba(232,121,249,0.15)":"transparent", color:imgMode===m?"#e879f9":"#9ca3af", fontSize:12, fontWeight:600, cursor:"pointer" }}>{l}</button>
          ))}
        </div>
        {imgMode==="emoji"?(
          <div style={{ display:"flex", flexWrap:"wrap", gap:7, marginBottom:16, justifyContent:"center" }}>
            {EMOJIS.map(e=>(
              <button key={e} onClick={()=>setEmoji(e)} style={{ fontSize:24, background:"rgba(255,255,255,0.05)", border:`2px solid ${emoji===e?"#e879f9":"transparent"}`, borderRadius:10, width:42, height:42, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>{e}</button>
            ))}
          </div>
        ):(
          <div style={{ border:"2px dashed rgba(232,121,249,0.3)", borderRadius:12, height:120, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", marginBottom:16, color:"#7c6a9a", overflow:"hidden" }} onClick={()=>fileRef.current?.click()}>
            {image?<img src={image} alt="preview" style={{ width:"100%", height:"100%", objectFit:"contain" }}/>:<><div style={{ fontSize:28, marginBottom:6 }}>📷</div><div style={{ fontSize:12 }}>タップして画像を選択（5MB以下）</div></>}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:"none" }}/>
          </div>
        )}
        <div style={S.fieldGroup}><label style={S.label}>グッズ名 *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="例: 月ノ美兎 アクリルスタンド" style={S.input} maxLength={60}/></div>
        <div style={S.fieldGroup}><label style={S.label}>シリーズ / タグ</label><input value={series} onChange={e=>setSeries(e.target.value)} placeholder="例: にじさんじ" style={S.input} maxLength={40}/></div>
        {status==="owned" && <div style={S.fieldGroup}><label style={S.label}>購入日</label><input type="date" value={purchaseDate} onChange={e=>setPurchaseDate(e.target.value)} style={S.input}/></div>}
        {status==="reserved" && <div style={S.fieldGroup}><label style={S.label}>発売予定日</label><input type="date" value={releaseDate} onChange={e=>setReleaseDate(e.target.value)} style={S.input}/></div>}
        <div style={S.fieldGroup}><label style={S.label}>メモ</label><textarea value={memo} onChange={e=>setMemo(e.target.value)} placeholder="イベント限定品など" style={{ ...S.input, height:52, resize:"none" }} maxLength={100}/></div>
        <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)", borderRadius:10, padding:"10px 14px", fontSize:11, color:"#fbbf24", marginBottom:14, lineHeight:1.6 }}>
          ⚠ 実際に所持・購入・予約したグッズのみ登録してください。将来的にはECショップの購入履歴と自動連携予定です。
        </div>
        {error && <div style={{ color:"#f87171", fontSize:12, marginBottom:10, fontWeight:600 }}>{error}</div>}
        <button onClick={submit} style={{ width:"100%", padding:"12px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#e879f9,#818cf8)", color:"#fff", fontSize:15, fontWeight:800, cursor:"pointer" }}>追加する</button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────
const S = {
  root: { fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif", minHeight:"100vh", background:"#0c0a14", color:"#f0e8ff", display:"flex", flexDirection:"column", userSelect:"none" },
  toast: { position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", background:"#1e1535", color:"#e9d5ff", padding:"10px 22px", borderRadius:30, fontSize:13, fontWeight:700, boxShadow:"0 4px 20px rgba(0,0,0,0.5)", zIndex:9999, border:"1px solid rgba(232,121,249,0.3)" },
  header: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", background:"rgba(12,10,20,0.97)", borderBottom:"1px solid rgba(232,121,249,0.12)", position:"sticky", top:0, zIndex:100 },
  logo: { display:"flex", alignItems:"center", gap:10 },
  logoText: { fontSize:18, fontWeight:900, letterSpacing:3, background:"linear-gradient(90deg,#e879f9,#818cf8)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" },
  logoSub: { fontSize:10, color:"#7c6a9a" },
  navBtn: { padding:"6px 13px", borderRadius:20, border:"1px solid rgba(232,121,249,0.18)", background:"transparent", color:"#9ca3af", fontSize:12, fontWeight:600, cursor:"pointer" },
  navBtnOn: { background:"rgba(232,121,249,0.15)", color:"#e879f9", border:"1px solid rgba(232,121,249,0.4)" },
  main: { flex:1, padding:"18px 16px", maxWidth:780, width:"100%", margin:"0 auto" },
  statsRow: { display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8, marginBottom:16 },
  statCard: { background:"rgba(255,255,255,0.04)", borderRadius:12, padding:"12px 8px", textAlign:"center", border:"1px solid rgba(255,255,255,0.06)" },
  toolbar: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 },
  filterBtn: { padding:"5px 12px", borderRadius:20, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"#9ca3af", fontSize:12, fontWeight:600, cursor:"pointer" },
  filterBtnOn: { background:"rgba(232,121,249,0.15)", color:"#e879f9", border:"1px solid rgba(232,121,249,0.3)" },
  addBtn: { padding:"8px 18px", borderRadius:20, border:"none", background:"linear-gradient(135deg,#e879f9,#818cf8)", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer", boxShadow:"0 2px 12px rgba(232,121,249,0.3)" },
  grid: { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))", gap:10 },
  card: { background:"rgba(255,255,255,0.04)", borderRadius:14, border:"1px solid rgba(255,255,255,0.07)", overflow:"hidden", display:"flex", flexDirection:"column" },
  cardImgWrap: { position:"relative", aspectRatio:"1", background:"rgba(0,0,0,0.3)" },
  cardImg: { width:"100%", height:"100%", objectFit:"contain" },
  cardEmoji: { width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:52 },
  badge: { position:"absolute", top:8, left:8, padding:"3px 8px", borderRadius:20, fontSize:10, fontWeight:700 },
  cardBody: { padding:"10px 12px", flex:1 },
  cardName: { fontSize:13, fontWeight:700, marginBottom:3, lineHeight:1.3 },
  cardSeries: { fontSize:11, color:"#818cf8", marginBottom:2 },
  cardMeta: { fontSize:10, color:"#6b7280" },
  cardActions: { display:"flex", justifyContent:"flex-end", padding:"7px 10px", gap:6, borderTop:"1px solid rgba(255,255,255,0.05)" },
  iconBtn: { background:"none", border:"none", fontSize:15, cursor:"pointer", padding:"2px 6px", borderRadius:6 },
  statusMenu: { position:"absolute", right:0, top:28, background:"#1a1230", border:"1px solid rgba(232,121,249,0.2)", borderRadius:10, overflow:"hidden", zIndex:50, minWidth:100, boxShadow:"0 8px 24px rgba(0,0,0,0.5)" },
  statusMenuItem: { display:"block", width:"100%", padding:"8px 12px", border:"none", textAlign:"left", fontSize:12, fontWeight:600, cursor:"pointer" },
  modeBtn: { padding:"7px 14px", borderRadius:20, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#9ca3af", fontSize:12, fontWeight:600, cursor:"pointer" },
  modeBtnOn: { background:"rgba(232,121,249,0.15)", color:"#e879f9", border:"1px solid rgba(232,121,249,0.35)" },
  shareBtn: { padding:"7px 16px", borderRadius:20, border:"none", background:"linear-gradient(135deg,#e879f9,#818cf8)", color:"#fff", fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"0 2px 10px rgba(232,121,249,0.3)" },
  altarBg: { background:"linear-gradient(180deg,#170d2e,#100820)", borderRadius:18, border:"1px solid rgba(232,121,249,0.18)", boxShadow:"0 8px 40px rgba(0,0,0,0.5)", marginBottom:16, overflow:"hidden" },
  shelfRow: { position:"relative", padding:"10px 12px 0" },
  shelfPlank: { position:"absolute", bottom:0, left:8, right:8, height:8, borderRadius:"0 0 4px 4px", boxShadow:"0 4px 12px rgba(0,0,0,0.4)" },
  shelfCell: { aspectRatio:"0.7", borderRadius:8, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", transition:"all 0.15s" },
  shelfItem: { width:"100%", height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-end", position:"relative", cursor:"grab", padding:"0 2px 2px" },
  shelfItemImg: { width:"80%", flex:1, objectFit:"contain", minHeight:0 },
  shelfItemEmoji: { fontSize:30, flex:1, display:"flex", alignItems:"center", justifyContent:"center" },
  shelfItemLabel: { fontSize:8, textAlign:"center", width:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  removeCellBtn: { position:"absolute", top:-4, right:-4, width:15, height:15, borderRadius:"50%", border:"none", background:"#ef4444", color:"#fff", fontSize:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900, padding:0 },
  emptyCellHint: { fontSize:16, pointerEvents:"none" },
  trayWrap: { background:"rgba(255,255,255,0.03)", borderRadius:14, border:"1px solid rgba(255,255,255,0.06)", overflow:"hidden" },
  trayTitle: { padding:"11px 16px", fontSize:13, fontWeight:700, borderBottom:"1px solid rgba(255,255,255,0.05)", color:"#c084fc" },
  tray: { display:"flex", gap:10, padding:"12px 16px", overflowX:"auto", flexWrap:"wrap" },
  trayItem: { width:68, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:3, position:"relative", background:"rgba(255,255,255,0.04)", borderRadius:10, padding:"8px 4px", border:"1px solid rgba(255,255,255,0.07)", transition:"all 0.15s" },
  trayItemImg: { width:48, height:58, objectFit:"contain" },
  trayItemEmoji: { fontSize:32, height:58, display:"flex", alignItems:"center", justifyContent:"center" },
  trayItemLabel: { fontSize:9, color:"rgba(255,255,255,0.45)", textAlign:"center", width:"100%", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  trayCheckBadge: { position:"absolute", top:4, right:4, width:14, height:14, borderRadius:"50%", background:"#22c55e", color:"#fff", fontSize:8, display:"flex", alignItems:"center", justifyContent:"center", fontWeight:900 },
  nameSaveBtn: { background:"#e879f9", color:"#fff", border:"none", borderRadius:12, padding:"4px 14px", fontSize:12, fontWeight:700, cursor:"pointer" },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.78)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:16 },
  modal: { background:"#110d20", borderRadius:20, padding:"22px 20px", width:"100%", maxWidth:440, maxHeight:"90vh", overflowY:"auto", border:"1px solid rgba(232,121,249,0.22)", boxShadow:"0 20px 60px rgba(0,0,0,0.8)" },
  confirmBox: { background:"#110d20", borderRadius:16, padding:"28px 24px", maxWidth:320, width:"100%", border:"1px solid rgba(239,68,68,0.3)", textAlign:"center" },
  btnGhost: { padding:"8px 20px", borderRadius:12, border:"1px solid rgba(255,255,255,0.15)", background:"transparent", color:"#9ca3af", fontSize:13, fontWeight:700, cursor:"pointer" },
  btnDanger: { padding:"8px 20px", borderRadius:12, border:"none", background:"#ef4444", color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" },
  fieldGroup: { marginBottom:11 },
  label: { display:"block", fontSize:11, color:"#7c6a9a", fontWeight:700, marginBottom:4, letterSpacing:0.5 },
  input: { width:"100%", background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:10, padding:"9px 12px", color:"#f0e8ff", fontSize:13, outline:"none", boxSizing:"border-box", fontFamily:"inherit" },
  emptyMsg: { textAlign:"center", padding:40, color:"#6b7280" },
  emptyState: { textAlign:"center", padding:"60px 20px", color:"#6b7280" },
};
