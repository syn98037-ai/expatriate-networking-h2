// ─── 상수 ───────────────────────────────────────────────
export const CONCERNS = [
  "자녀 교육","주거지 확보","현지 언어 적응","배우자 커리어",
  "건강 및 의료","치안/안전","외로움/네트워킹",
];
export const POST_TAGS = ["일상","정보공유","질문","모임","현지팁","고민상담"];

// ─── 아바타 그라데이션 ────────────────────────────────
const GRADS = [
  "#4f1c9f,#7c3aed,#c084fc",
  "#0ea5e9,#06b6d4,#0891b2",
  "#ec4899,#f472b6,#e879f9",
  "#10b981,#34d399,#059669",
  "#f59e0b,#f97316,#ea580c",
  "#8b5cf6,#6366f1,#4f46e5",
];
export const gradFor = (id = "") => {
  const g = GRADS[id.charCodeAt(0) % GRADS.length].split(",");
  return `${g[0]},${g[1]},${g[2]}`;
};

// ─── 시간 표시 ───────────────────────────────────────
export const timeAgo = (iso) => {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1)  return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};

// ─── Canva 스타일 공통 스타일 ────────────────────────
// 규칙: 어두운 배경 → 흰 글씨 / 밝은 배경 → 어두운 글씨
// 모든 요소에 그라데이션 적용

export const S = {
  screen:  { flex: 1, overflowY: "auto", paddingBottom: 80 },

  // 카드: 밝은 배경 → 어두운 글씨
  card:    {
    background: "linear-gradient(135deg,#ffffff 0%,#f5f0ff 100%)",
    border: "1.5px solid #c4b5fd",
    borderRadius: 20,
    padding: 16,
    boxShadow: "0 4px 16px rgba(124,58,237,0.1)",
  },
  cardLg:  {
    background: "linear-gradient(135deg,#ffffff 0%,#f0ebff 100%)",
    border: "1.5px solid #c4b5fd",
    borderRadius: 28,
    padding: 24,
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 6px 24px rgba(124,58,237,0.12)",
  },

  // 입력창: 밝은 배경 → 어두운 글씨
  inp: {
    width: "100%",
    padding: "13px 16px",
    background: "linear-gradient(135deg,#faf8ff,#f3efff)",
    border: "1.5px solid #c4b5fd",
    borderRadius: 16,
    color: "#1e1b4b",
    fontFamily: "Pretendard,sans-serif",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },

  // 라벨: 보라 그라데이션 텍스트
  lbl: {
    fontSize: 10,
    fontWeight: 700,
    background: "linear-gradient(90deg,#7c3aed,#a855f7)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    letterSpacing: "0.08em",
    display: "block",
    marginBottom: 6,
    marginLeft: 2,
  },

  // 주 버튼: 어두운 보라 그라데이션 → 흰 글씨
  btnAmber: {
    background: "linear-gradient(135deg,#4f1c9f,#7c3aed,#a855f7)",
    color: "#ffffff",
    fontWeight: 700,
    border: "none",
    borderRadius: 14,
    padding: "11px 18px",
    cursor: "pointer",
    fontFamily: "Pretendard,sans-serif",
    fontSize: 13,
    boxShadow: "0 4px 14px rgba(124,58,237,0.4)",
  },

  // 보조 버튼: 밝은 연보라 → 어두운 보라 글씨
  btnGhost: {
    background: "linear-gradient(135deg,#ede9fe,#ddd6fe)",
    border: "1.5px solid #c4b5fd",
    color: "#4c1d95",
    fontWeight: 700,
    borderRadius: 12,
    padding: "9px 14px",
    cursor: "pointer",
    fontFamily: "Pretendard,sans-serif",
    fontSize: 12,
  },

  // 뱃지: 밝은 배경 → 어두운 글씨
  amberBadge: {
    background: "linear-gradient(135deg,#ede9fe,#ddd6fe)",
    border: "1px solid #c4b5fd",
    color: "#4c1d95",
    fontSize: 10,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 10,
    display: "inline-block",
  },

  // 오버레이: 밝은 배경
  overlay:       { position: "absolute", inset: 0, background: "linear-gradient(160deg,#f3f0ff,#faf5ff)", zIndex: 50, display: "flex", flexDirection: "column" },
  overlayHeader: { padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1.5px solid #ddd6fe", flexShrink: 0, background: "linear-gradient(135deg,#fff,#faf5ff)" },
  overlayBody:   { flex: 1, overflowY: "auto", padding: 20, background: "linear-gradient(160deg,#f3f0ff,#faf5ff)" },
  overlayFooter: { padding: "12px 16px", borderTop: "1.5px solid #ddd6fe", display: "flex", gap: 8, flexShrink: 0, background: "linear-gradient(135deg,#fff,#faf5ff)" },
};

// 상태 뱃지
export const stBadge = (s) => ({
  background:
    s === "대기중" ? "linear-gradient(135deg,#fef9c3,#fef08a)" :
    s === "수락함" ? "linear-gradient(135deg,#d1fae5,#a7f3d0)" :
                    "linear-gradient(135deg,#fee2e2,#fecaca)",
  color:
    s === "대기중" ? "#854d0e" :
    s === "수락함" ? "#065f46" : "#991b1b",
  fontSize: 10,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 8,
  border: `1.5px solid ${
    s === "대기중" ? "#fde68a" :
    s === "수락함" ? "#6ee7b7" : "#fca5a5"
  }`,
});
