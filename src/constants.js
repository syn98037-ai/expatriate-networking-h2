// ─── 상수 ───────────────────────────────────────────────
export const CONCERNS = [
  "자녀 교육","주거지 확보","현지 언어 적응","배우자 커리어",
  "건강 및 의료","치안/안전","외로움/네트워킹",
];
export const POST_TAGS = ["일상","정보공유","질문","모임","현지팁","고민상담"];

// ─── 아바타 색상 ─────────────────────────────────────────
const GRADS = [
  "#00aad2,#0088c8",  // 하늘색
  "#e84393,#c0176e",  // 핑크
  "#f59e0b,#d97706",  // 주황
  "#10b981,#059669",  // 초록
  "#8b5cf6,#7c3aed",  // 보라
  "#ef4444,#dc2626",  // 빨강
  "#06b6d4,#0891b2",  // 청록
  "#f97316,#ea580c",  // 오렌지
  "#84cc16,#65a30d",  // 라임
  "#ec4899,#db2777",  // 핫핑크
];
export const gradFor = (id = "") => {
  const g = GRADS[id.charCodeAt(0) % GRADS.length].split(",");
  return `${g[0]},${g[1]}`;
};

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

// ─── HMG 디자인 시스템 ───────────────────────────────────
// 현대자동차 앱 스타일
// 규칙: 네이비(#002c5f) 배경 → 흰 글씨 / 흰/회색 배경 → 네이비/진회색 글씨

export const S = {
  screen: { flex: 1, overflowY: "auto", paddingBottom: 80 },

  // 카드: 순백 + 연한 테두리 + 미세 그림자
  card: {
    background: "#ffffff",
    border: "1px solid #e0e3e8",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 2px 8px rgba(0,44,95,0.07)",
  },
  cardLg: {
    background: "#ffffff",
    border: "1px solid #e0e3e8",
    borderRadius: 20,
    padding: 24,
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 4px 16px rgba(0,44,95,0.09)",
  },

  // 입력창
  inp: {
    width: "100%",
    padding: "13px 16px",
    background: "#f5f6f8",
    border: "1.5px solid #d1d5db",
    borderRadius: 12,
    color: "#002c5f",
    fontFamily: "'Noto Sans KR', Inter, sans-serif",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },

  // 라벨
  lbl: {
    fontSize: 11,
    fontWeight: 700,
    color: "#002c5f",
    letterSpacing: "0.06em",
    display: "block",
    marginBottom: 6,
    marginLeft: 2,
  },

  // 주 버튼: 네이비 → 흰 글씨
  btnAmber: {
    background: "#002c5f",
    color: "#ffffff",
    fontWeight: 700,
    border: "none",
    borderRadius: 10,
    padding: "11px 18px",
    cursor: "pointer",
    fontFamily: "'Noto Sans KR', Inter, sans-serif",
    fontSize: 13,
    boxShadow: "0 3px 10px rgba(0,44,95,0.25)",
  },

  // 보조 버튼: 흰색 + 네이비 테두리 → 네이비 글씨
  btnGhost: {
    background: "#ffffff",
    border: "1.5px solid #c5d5e8",
    color: "#002c5f",
    fontWeight: 700,
    borderRadius: 10,
    padding: "9px 14px",
    cursor: "pointer",
    fontFamily: "'Noto Sans KR', Inter, sans-serif",
    fontSize: 12,
  },

  // 뱃지
  amberBadge: {
    background: "#e8f0f8",
    border: "1px solid #c5d5e8",
    color: "#002c5f",
    fontSize: 10,
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 8,
    display: "inline-block",
  },

  // 오버레이
  overlay:       { position: "absolute", inset: 0, background: "#f5f6f8", zIndex: 50, display: "flex", flexDirection: "column" },
  overlayHeader: { padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, borderBottom: "1px solid #e0e3e8", flexShrink: 0, background: "#ffffff" },
  overlayBody:   { flex: 1, overflowY: "auto", padding: 20, background: "#f5f6f8" },
  overlayFooter: { padding: "12px 16px", borderTop: "1px solid #e0e3e8", display: "flex", gap: 8, flexShrink: 0, background: "#ffffff" },
};

// 상태 뱃지
export const stBadge = (s) => ({
  background:
    s === "대기중" ? "#fff8e6" :
    s === "수락함" ? "#e6f7ee" : "#fde8e8",
  color:
    s === "대기중" ? "#9a6700" :
    s === "수락함" ? "#0a6640" : "#c0392b",
  fontSize: 10,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: 8,
  border: `1px solid ${
    s === "대기중" ? "#f0d080" :
    s === "수락함" ? "#85d4a8" : "#f5a5a5"
  }`,
});
