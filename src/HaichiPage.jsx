import { useState } from "react";

const TYPES = ["アクスタ", "ぬいぐるみ", "缶バッジ", "フィギュア", "クリアファイル", "タペストリー", "色紙", "その他"];

const S = {
  page: {
    minHeight: "100vh",
    background: "#0c0a14",
    color: "#fff",
    padding: "20px 16px 100px",
    maxWidth: 480,
    margin: "0 auto",
    fontFamily: "'Hiragino Sans', sans-serif",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
    background: "linear-gradient(135deg,#a78bfa,#f472b6)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  sub: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 20,
  },
  modeRow: {
    display: "flex",
    gap: 8,
    marginBottom: 20,
  },
  modeBtn: (active) => ({
    flex: 1,
    padding: "10px",
    borderRadius: 12,
    border: active ? "1px solid #a78bfa" : "1px solid rgba(255,255,255,0.1)",
    background: active ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
    color: active ? "#a78bfa" : "#6b7280",
    fontWeight: active ? 700 : 400,
    fontSize: 13,
    cursor: "pointer",
    textAlign: "center",
  }),
  section: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: 16,
    padding: "16px",
    marginBottom: 16,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#a78bfa",
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    color: "#9ca3af",
    marginBottom: 4,
  },
  select: {
    width: "100%",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#fff",
    padding: "8px 12px",
    fontSize: 14,
    marginBottom: 12,
  },
  row: {
    display: "flex",
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    color: "#fff",
    padding: "8px 12px",
    fontSize: 14,
    outline: "none",
  },
  addBtn: {
    background: "linear-gradient(135deg,#a78bfa,#f472b6)",
    border: "none",
    borderRadius: 10,
    color: "#fff",
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  goodTag: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(167,139,250,0.1)",
    border: "1px solid rgba(167,139,250,0.2)",
    borderRadius: 10,
    padding: "6px 12px",
    marginBottom: 6,
    fontSize: 13,
  },
  removeBtn: {
    background: "none",
    border: "none",
    color: "#6b7280",
    cursor: "pointer",
    fontSize: 16,
    padding: 0,
    lineHeight: 1,
  },
  spaceRow: {
    display: "flex",
    gap: 8,
  },
  spaceField: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  submitBtn: {
    width: "100%",
    background: "linear-gradient(135deg,#a78bfa,#f472b6)",
    border: "none",
    borderRadius: 14,
    color: "#fff",
    padding: "14px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 16,
  },
  submitBtnDisabled: {
    width: "100%",
    background: "rgba(255,255,255,0.1)",
    border: "none",
    borderRadius: 14,
    color: "#6b7280",
    padding: "14px",
    fontSize: 15,
    fontWeight: 700,
    cursor: "not-allowed",
    marginBottom: 16,
  },
  result: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(167,139,250,0.3)",
    borderRadius: 16,
    padding: "16px",
    fontSize: 14,
    lineHeight: 1.8,
    color: "#e5e7eb",
    whiteSpace: "pre-wrap",
  },
  loading: {
    textAlign: "center",
    padding: "32px",
    color: "#9ca3af",
    fontSize: 14,
  },
};

export default function HaichiPage() {
  const [mode, setMode]     = useState("shelf"); // "shelf" | "flat"
  const [type, setType]     = useState("アクスタ");
  const [size, setSize]     = useState("");
  const [count, setCount]   = useState("1");
  const [goods, setGoods]   = useState([]);
  const [space, setSpace]   = useState({ width: "", depth: "", height: "" });
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  const addGood = () => {
    if (!size.trim()) return;
    setGoods(prev => [...prev, { id: Date.now(), type, size: Number(size), count: Number(count) || 1 }]);
    setSize("");
    setCount("1");
  };

  const removeGood = (id) => setGoods(prev => prev.filter(g => g.id !== id));

  const handleModeChange = (m) => {
    setMode(m);
    setSuggestion("");
    setError("");
    setSpace({ width: "", depth: "", height: "" });
  };

  const getSuggestion = async () => {
    if (!goods.length) return;
    setLoading(true);
    setError("");
    setSuggestion("");
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goods, space, mode }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); }
      else { setSuggestion(data.suggestion); }
    } catch {
      setError("通信エラーが発生しました。もう一度お試しください。");
    }
    setLoading(false);
  };

  const isShelf = mode === "shelf";

  return (
    <div style={S.page}>
      <div style={S.title}>📐 配置シミュレーター</div>
      <div style={S.sub}>グッズのサイズと個数を入力すると、最適な配置を提案します</div>

      {/* モード切り替え */}
      <div style={S.modeRow}>
        <button style={S.modeBtn(isShelf)} onClick={() => handleModeChange("shelf")}>
          🗄 棚に飾る
        </button>
        <button style={S.modeBtn(!isShelf)} onClick={() => handleModeChange("flat")}>
          📸 平置きで撮る
        </button>
      </div>

      {/* グッズ追加 */}
      <div style={S.section}>
        <div style={S.sectionTitle}>グッズを追加</div>
        <div style={S.label}>種類</div>
        <select style={S.select} value={type} onChange={e => setType(e.target.value)}>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={S.row}>
          <div style={{ flex: 1 }}>
            <div style={S.label}>サイズ（cm）</div>
            <input
              type="number"
              placeholder="例: 10"
              style={S.input}
              value={size}
              onChange={e => setSize(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addGood()}
              min="1"
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={S.label}>個数</div>
            <input
              type="number"
              placeholder="例: 3"
              style={S.input}
              value={count}
              onChange={e => setCount(e.target.value)}
              min="1"
            />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button style={S.addBtn} onClick={addGood}>追加</button>
          </div>
        </div>

        {goods.length > 0 && (
          <div style={{ marginTop: 4 }}>
            {goods.map(g => (
              <div key={g.id} style={S.goodTag}>
                <span>{g.type}（{g.size}cm）× {g.count}個</span>
                <button style={S.removeBtn} onClick={() => removeGood(g.id)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* スペースサイズ（任意） */}
      <div style={S.section}>
        <div style={S.sectionTitle}>
          {isShelf ? "棚のサイズ（任意）" : "撮影スペースのサイズ（任意）"}
        </div>
        <div style={S.spaceRow}>
          {(isShelf
            ? [["width","幅"],["depth","奥行き"],["height","高さ"]]
            : [["width","幅"],["depth","奥行き"]]
          ).map(([key, label]) => (
            <div key={key} style={S.spaceField}>
              <div style={S.label}>{label}（cm）</div>
              <input
                type="number"
                placeholder="—"
                style={S.input}
                value={space[key]}
                onChange={e => setSpace(prev => ({ ...prev, [key]: e.target.value }))}
                min="1"
              />
            </div>
          ))}
        </div>
        {!isShelf && (
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
            ※ A3用紙（42×30cm）、ポスター（60×40cm）など
          </div>
        )}
      </div>

      {/* 提案ボタン */}
      <button
        style={goods.length > 0 ? S.submitBtn : S.submitBtnDisabled}
        onClick={getSuggestion}
        disabled={goods.length === 0 || loading}
      >
        {loading ? "提案中…" : "✨ 配置を提案してもらう"}
      </button>

      {/* 結果 */}
      {loading && <div style={S.loading}>AIが考え中です…</div>}
      {error && <div style={{ ...S.result, borderColor: "rgba(244,114,182,0.3)", color: "#f472b6" }}>{error}</div>}
      {suggestion && <div style={S.result}>{suggestion}</div>}
    </div>
  );
}
