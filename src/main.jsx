import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// ─── Error Boundary ──────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("SAIDAN app error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight:"100vh", background:"#0c0a14", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24, fontFamily:"sans-serif", color:"#f0e8ff" }}>
          <div style={{ fontSize:64, marginBottom:16 }}>⛩</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#e879f9", marginBottom:10 }}>
            エラーが発生しました
          </div>
          <div style={{ fontSize:13, color:"#9ca3af", marginBottom:24, textAlign:"center", maxWidth:320, lineHeight:1.8 }}>
            申し訳ありません。予期しないエラーが発生しました。<br/>
            ページをリロードしてもう一度お試しください。
          </div>
          {this.state.error && (
            <div style={{ fontSize:10, color:"#4b5563", background:"rgba(255,255,255,0.05)", borderRadius:10, padding:"8px 14px", marginBottom:24, maxWidth:360, wordBreak:"break-all", lineHeight:1.6 }}>
              {this.state.error.message}
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{ padding:"11px 32px", borderRadius:14, border:"none", background:"linear-gradient(135deg,#e879f9,#818cf8)", color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer", boxShadow:"0 4px 20px rgba(232,121,249,0.3)" }}>
            🔄 リロードする
          </button>
          <div style={{ marginTop:20, fontSize:11, color:"#4b5563" }}>
            問題が続く場合は{" "}
            <a href="https://x.com/SAIDANdayo" target="_blank" rel="noreferrer" style={{ color:"#818cf8" }}>@SAIDANdayo</a>
            {" "}までご連絡ください
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
