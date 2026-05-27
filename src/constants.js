// ─── 상수 ───────────────────────────────────────────────
export const CONCERNS = [
  "자녀 교육","주거지 확보","현지 언어 적응","배우자 커리어",
  "건강 및 의료","치안/안전","외로움/네트워킹",
];
export const POST_TAGS = ["일상","정보공유","질문","모임","현지팁","고민상담"];

// ─── 아바타 색상 ─────────────────────────────────────────
const GRADS = [
  "#7c3aed,#a855f7","#06b6d4,#3b82f6","#f472b6,#e879f9",
  "#10b981,#059669","#f59e0b,#f97316","#8b5cf6,#6366f1",
];
export const gradFor = (id = "") => GRADS[id.charCodeAt(0) % GRADS.length];

// ─── 시간 표시 ───────────────────────────────────────────
export const timeAgo = (iso) => {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1)  return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};

// ─── Canva 스타일 색상 시스템 ────────────────────────────
export const C = {
  // 배경
  bgPage:    "linear-gradient(160deg,#f3f0ff 0%,#ede9fe 40%,#faf5ff 70%,#f0f9ff 100%)",
  bgCard:    "linear-gradient(135deg,#ffffff 0%,#faf5ff 100%)",
  bgCardAlt: "linear-gradient(135deg,#ffffff 0%,#f5f3ff 100%)",
  bgHeader:  "linear-gradient(135deg,#7c3aed 0%,#9333ea 50%,#a855f7 100%)",
  bgTabBar:  "linear-gradient(180deg,rgba(243,240,255,0.97) 0%,#ffffff 100%)",
  bgInput:   "#f8f6ff",
  bgOverlay: "#faf8ff",

  // 포인트 컬러
  primary:      "#7c3aed",
  primaryLight: "#a855f7",
  primaryBg:    "#ede9fe",
  primaryBg2:   "#f3f0ff",

  // 텍스트
  textPrimary:   "#1e1b4b",
  textSecondary: "#6b7280",
  textMuted:     "#a78bfa",
  textOnPurple:  "#ffffff",

  // 테두리
  border:        "#ddd6fe",
  borderLight:   "#e8e5ff",
  borderMid:     "#c4b5fd",

  // 상태 색상
  success:    "#10b981",
  successBg:  "#d1fae5",
  warning:    "#f59e0b",
  warningBg:  "#fef3c7",
  danger:     "#ef4444",
  dangerBg:   "#fee2e2",
  info:       "#3b82f6",
  infoBg:     "#dbeafe",
};

// ─── 공통 스타일 ─────────────────────────────────────────
export const S = {
  screen:        { flex: 1, overflowY: "auto", paddingBottom: 80 },
  card:          { background: "linear-gradient(135deg,#fff 0%,#faf5ff 100%)", border: "1.5px solid #ddd6fe", borderRadius: 20, padding: 16, boxShadow: "0 2px 12px rgba(124,58,237,0.08)" },
  cardLg:        { background: "linear-gradient(135deg,#fff 0%,#faf5ff 100%)", border: "1.5px solid #ddd6fe", borderRadius: 28, padding: 24, position: "relative", overflow: "hidden", boxShadow: "0 4px 20px rgba(124,58,237,0.1)" },
  inp:           { width: "100%", padding: "13px 16px", background: "#f8f6ff", border: "1.5px solid #ddd6fe", borderRadius: 16, color: "#1e1b4b", fontFamily: "Pretendard,sans-serif", fontSize: 14, outline: "none", boxSizing: "border-box" },
  lbl:           { fontSize: 10, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.08em", display: "block", marginBottom: 6, marginLeft: 2 },
  btnAmber:      { background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#ffffff", fontWeight: 700, border: "none", borderRadius: 14, padding: "11px 18px", cursor: "pointer", fontFamily: "Pretendard,sans-serif", fontSize: 13, boxShadow: "0 4px 12px rgba(124,58,237,0.3)" },
  btnGhost:      { background: "#f3f0ff", border: "1.5px solid #ddd6fe", color: "#7c3aed", fontWeight: 700, borderRadius: 12, padding: "9px 14px", cursor: "pointer", fontFamily: "Pretendard,sans-serif", fontSize: 12 },
  amberBadge:    { background: "#ede9fe", border: "1px solid #ddd6fe", color: "#7c3aed", fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 10, display: "inline-block" },
  overlay:       { position: "absolute", inset: 0, background: "#faf8ff", zIndex: 50, display: "flex", flexDirection: "column" },
  overlayHeader: { padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1.5px solid #e8e5ff", flexShrink: 0, background: "#fff" },
  overlayBody:   { flex: 1, overflowY: "auto", padding: 20, background: "linear-gradient(160deg,#f3f0ff,#faf5ff)" },
  overlayFooter: { padding: "12px 16px", borderTop: "1.5px solid #e8e5ff", display: "flex", gap: 8, flexShrink: 0, background: "#fff" },
};

export const stBadge = (s) => ({
  background: s === "대기중" ? "#fef3c7" : s === "수락함" ? "#d1fae5" : "#fee2e2",
  color:      s === "대기중" ? "#d97706" : s === "수락함" ? "#059669" : "#dc2626",
  fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 8,
  border: `1px solid ${s === "대기중" ? "#fde68a" : s === "수락함" ? "#a7f3d0" : "#fecaca"}`,
});
