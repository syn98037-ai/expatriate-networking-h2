import { useState, useEffect, useRef, useCallback } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  collection, doc, setDoc, getDoc, getDocs, onSnapshot, query,
  addDoc, updateDoc, deleteDoc, orderBy, serverTimestamp, where,
} from "firebase/firestore";
import {
  ref as storageRef, uploadString, getDownloadURL,
} from "firebase/storage";
import { auth, db, storage } from "./firebase";
import { CONCERNS, POST_TAGS, gradFor, timeAgo, S, stBadge } from "./constants";

// ─── Firestore 컬렉션 헬퍼 ──────────────────────────────
const col  = (...segs) => collection(db, ...segs);
const docR = (...segs) => doc(db, ...segs);

// ─── 전역 사진 업로드 헬퍼 ──────────────────────────────
async function uploadPhotoGlobal(base64, path) {
  if (!base64 || !base64.startsWith("data:")) return base64;
  try {
    const r = storageRef(storage, path);
    await uploadString(r, base64, "data_url");
    return await getDownloadURL(r);
  } catch(e) {
    console.warn("upload failed, using base64 fallback:", e.message);
    return base64; // Storage 규칙 오류 시 base64 그대로 사용
  }
}

// ─── 아바타 ─────────────────────────────────────────────
function Avatar({ profile, size = 44 }) {
  const [c1, c2] = gradFor(profile?.id || "x").split(",");
  const br = size >= 50 ? 14 : size >= 40 ? 12 : size >= 32 ? 10 : 8;
  const base = { width: size, height: size, borderRadius: br, flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)" };
  if (profile?.photoUrl)
    return <img src={profile.photoUrl} alt="" style={{ ...base, objectFit: "cover" }} />;
  return (
    <div style={{ ...base, background: `linear-gradient(135deg,${c1}22,${c2}44)`, border: `1px solid ${c1}55`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: c1, fontSize: Math.round(size * 0.38) }}>
      {(profile?.name || "?")[0]}
    </div>
  );
}

// ─── 네비 아이콘 ─────────────────────────────────────────
function NavIcon({ id, active }) {
  const c = active ? "#f59e0b" : "#475569";
  const w = 20; const sw = active ? 2 : 1.6;
  if (id === "dashboard")  return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/><path d="M4.93 4.93l2.12 2.12m9.9 9.9 2.12 2.12M4.93 19.07l2.12-2.12m9.9-9.9 2.12-2.12" strokeOpacity="0.5"/></svg>;
  if (id === "directory")  return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7"/><path d="M21 21l-4.35-4.35"/></svg>;
  if (id === "community")  return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
  if (id === "meetings")   return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
  if (id === "missions")   return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>;
  if (id === "calendar")   return <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
  return null;
}

// ══════════════════════════════════════════════════════════
//  루트 앱
// ══════════════════════════════════════════════════════════
export default function App() {
  const [authStatus, setAuthStatus] = useState("loading"); // loading | unauth | auth
  const [myProfile,  setMyProfile]  = useState(null);
  const [view,       setView]       = useState("dashboard");
  const [overlay,    setOverlay]    = useState(null);
  const [profiles,   setProfiles]   = useState([]);
  const [meetings,   setMeetings]   = useState([]);
  const [posts,      setPosts]      = useState([]);
  const [events,     setEvents]     = useState([]);
  const [chats,      setChats]      = useState({});
  const [comments,   setComments]   = useState({});
  const [missions,   setMissions]   = useState({});
  const [rooms,      setRooms]      = useState([]);
  const [isAdmin,    setIsAdmin]    = useState(false);
  const [isMobile,   setIsMobile]   = useState(typeof window !== "undefined" ? window.innerWidth < 768 : true);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const uid = myProfile?.id;

  // ── Firebase Auth 상태 감지 ──────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const snap = await getDoc(docR("profiles", user.uid));
        if (snap.exists()) {
          setMyProfile({ id: user.uid, ...snap.data() });
          setAuthStatus("auth");
        } else {
          // 계정은 있지만 프로필 미완성
          setAuthStatus("needProfile");
          setMyProfile({ id: user.uid });
        }
      } else {
        setAuthStatus("unauth");
        setMyProfile(null);
      }
    });
    return () => unsub();
  }, []);

  // ── adminOverrides 상태 ───────────────────────────────
  const [adminOverrides, setAdminOverrides] = useState({});

  // ── Firestore 실시간 리스너 (로그인 후 또는 관리자) ──
  useEffect(() => {
    if (authStatus !== "auth" && !isAdmin) return;
    const unsubs = [
      onSnapshot(query(col("profiles")), s => setProfiles(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(col("meetings")), s => setMeetings(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(col("posts"), orderBy("createdAt", "desc")), s => setPosts(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(col("events"), orderBy("date")), s => setEvents(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(col("rooms")), s => setRooms(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(query(col("missions")), s => {
        const obj = {};
        s.docs.forEach(d => { obj[d.id] = d.data(); });
        setMissions(obj);
      }),
      // 관리자 오버라이드 실시간 반영
      onSnapshot(query(col("adminOverrides")), s => {
        const obj = {};
        s.docs.forEach(d => { obj[d.id] = d.data(); });
        setAdminOverrides(obj);
      }),
    ];
    return () => unsubs.forEach(u => u());
  }, [authStatus, isAdmin]);

  // profiles + adminOverrides 합성 → 매칭에 반영
  const mergedProfiles = profiles.map(p => {
    const ov = adminOverrides[p.id];
    if (!ov) return p;
    // updatedAt 같은 불필요 필드 제외하고 매칭 필드만 덮어쓰기
    const { updatedAt, ...ovFields } = ov;
    return { ...p, ...ovFields };
  });

  // ── 사진 업로드 헬퍼 ─────────────────────────────────
  const uploadPhoto = async (base64, path) => {
    if (!base64 || !base64.startsWith("data:")) return base64;
    const r = storageRef(storage, path);
    await uploadString(r, base64, "data_url");
    return await getDownloadURL(r);
  };

  // ── 회원가입 ─────────────────────────────────────────
  const handleRegister = async (username, password, profileData) => {
    try {
      // deletedAccounts 확인
      const deletedSnap = await getDoc(docR("deletedAccounts", username));
      const isDeleted = deletedSnap.exists();

      let id;
      if (isDeleted) {
        // 관리자가 삭제한 계정 → 새 타임스탬프 suffix로 완전히 새 Auth 계정 생성
        // username은 Firestore profile에만 저장되므로 내부 email만 달라지면 OK
        const newEmail = `${username}_new${Date.now()}@globalconnect.hmg`;
        const cred = await createUserWithEmailAndPassword(auth, newEmail, password);
        id = cred.user.uid;
        // deletedAccounts 제거
        try { await deleteDoc(docR("deletedAccounts", username)); } catch(e) {}
      } else {
        // 일반 신규 가입
        const email = `${username}@globalconnect.hmg`;
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        id = cred.user.uid;
      }

      let photoUrl = "";
      if (profileData.photoUrl) {
        photoUrl = await uploadPhoto(profileData.photoUrl, `avatars/${id}`);
      }
      const profile = { ...profileData, photoUrl, username, id, createdAt: new Date().toISOString() };
      await setDoc(docR("profiles", id), profile);
      setMyProfile(profile);
      setAuthStatus("auth");
      return null;
    } catch (e) {
      if (e.code === "auth/email-already-in-use") return "이미 사용 중인 아이디입니다.";
      if (e.code === "auth/weak-password") return "비밀번호는 6자 이상이어야 합니다.";
      return e.message;
    }
  };

  // ── 로그인 ───────────────────────────────────────────
  const handleLogin = async (username, password) => {
    try {
      const email = `${username}@globalconnect.hmg`;
      await signInWithEmailAndPassword(auth, email, password);
      return null;
    } catch {
      return "아이디 또는 비밀번호가 잘못되었습니다.";
    }
  };

  // ── 로그아웃 ─────────────────────────────────────────
  const handleLogout = async () => {
    try {
      setOverlay(null);
      setView("dashboard");
      setMyProfile(null);
      setProfiles([]);
      setMeetings([]);
      setPosts([]);
      setEvents([]);
      setRooms([]);
      setMissions({});
      setChats({});
      setComments({});
      setAuthStatus("unauth");
      await signOut(auth);
    } catch(e) {
      console.error("logout error", e);
      setAuthStatus("unauth");
    }
  };

  // ── 프로필 저장 ──────────────────────────────────────
  const saveProfile = async (formData) => {
    if (!uid) return;
    let photoUrl = formData.photoUrl;
    if (photoUrl && photoUrl.startsWith("data:")) {
      photoUrl = await uploadPhoto(photoUrl, `avatars/${uid}`);
    }
    const updated = { ...formData, photoUrl, id: uid, updatedAt: new Date().toISOString() };
    await setDoc(docR("profiles", uid), updated, { merge: true });
    setMyProfile(updated);
    setOverlay(null);
  };

  // ── 채팅 메시지 전송 ─────────────────────────────────
  const addMsg = async (roomId, text) => {
    await addDoc(col("chats", roomId, "messages"), {
      text, senderId: uid, senderName: myProfile?.name || "나",
      createdAt: serverTimestamp(),
    });
  };

  // ── 댓글 추가 ────────────────────────────────────────
  const addComment = async (postId, text) => {
    await addDoc(col("posts", postId, "comments"), {
      text, authorId: uid, authorName: myProfile?.name || "나",
      createdAt: new Date().toISOString(),
    });
    await updateDoc(docR("posts", postId), { commentCount: (posts.find(p => p.id === postId)?.commentCount || 0) + 1 });
  };

  // ── 게시글 좋아요 ────────────────────────────────────
  const likePost = async (postId) => {
    const post = posts.find(p => p.id === postId);
    await updateDoc(docR("posts", postId), { likeCount: (post?.likeCount || 0) + 1 });
  };

  // ── 게시글 작성 ──────────────────────────────────────
  const addPost = async (postData) => {
    let imageUrl = postData.imageUrl;
    if (imageUrl && imageUrl.startsWith("data:")) {
      imageUrl = await uploadPhoto(imageUrl, `posts/${uid}_${Date.now()}`);
    }
    await addDoc(col("posts"), {
      ...postData, imageUrl, authorId: uid, authorName: myProfile?.name || "나",
      commentCount: 0, likeCount: 0, createdAt: new Date().toISOString(),
    });
  };

  // ── 티미팅 신청 ──────────────────────────────────────
  const sendReq = async (target) => {
    if (meetings.find(m => m.fromId === uid && m.toId === target.id && m.status === "대기중"))
      return alert("이미 신청을 보냈습니다.");
    await addDoc(col("meetings"), {
      fromId: uid, fromName: myProfile.name, fromOrg: myProfile.org || "",
      toId: target.id, toName: target.name, toOrg: target.org || "",
      status: "대기중", timestamp: new Date().toISOString(),
    });
    setView("meetings");
  };

  // ── 티미팅 상태 변경 ─────────────────────────────────
  const updateMtg = async (id, status) => {
    await updateDoc(docR("meetings", id), { status });
  };

  // ── 일정 추가 ────────────────────────────────────────
  const addEvent = async (ev) => {
    await addDoc(col("events"), { ...ev, creatorId: uid, creatorName: myProfile?.name || "나", createdAt: new Date().toISOString() });
  };

  // ── 미션 업데이트 ────────────────────────────────────
  const updateMission = async (key, value) => {
    const ref = docR("missions", uid);
    await setDoc(ref, { [key]: value }, { merge: true });
  };

  // ── 채팅방 생성 ──────────────────────────────────────
  const createRoom = async (roomData) => {
    await addDoc(col("rooms"), { ...roomData, creatorId: uid, createdAt: new Date().toISOString() });
  };

  // ── 채팅방 나가기 ─────────────────────────────────────
  const leaveRoom = async (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const newMembers = (room.members || []).filter(m => m !== uid);
    if (newMembers.length === 0) {
      // 멤버가 없으면 방 삭제
      try { await deleteDoc(docR("rooms", roomId)); } catch(e) {}
    } else {
      await updateDoc(docR("rooms", roomId), { members: newMembers });
    }
  };

  // ── 채팅방 초대 ──────────────────────────────────────
  const inviteToRoom = async (roomId, inviteeIds) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    const newMembers = [...new Set([...(room.members || []), ...inviteeIds])];
    await updateDoc(docR("rooms", roomId), { members: newMembers });
  };

  // ── 관리자: 프로필 수정 ──────────────────────────────
  const adminUpdateProfile = async (id, changes) => {
    // adminOverrides에는 매칭용 필드만 저장 (updatedAt 등 불필요 필드 제외)
    const matchFields = {};
    if (changes.city    !== undefined) matchFields.city    = changes.city;
    if (changes.country !== undefined) matchFields.country = changes.country;
    if (changes.concern !== undefined) matchFields.concern = changes.concern;
    try {
      await setDoc(docR("adminOverrides", id), matchFields, { merge: true });
    } catch(e) {
      console.warn("adminOverrides write err:", e.message);
    }
    // 로컬 profiles 상태 즉시 반영
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...matchFields } : p));
    // adminOverrides 로컬 상태도 즉시 반영
    setAdminOverrides(prev => ({ ...prev, [id]: { ...(prev[id] || {}), ...matchFields } }));
  };

  // ── 관리자: 게시글 삭제 ─────────────────────────────
  const adminDeletePost = async (postId) => {
    try { await deleteDoc(docR("posts", postId)); } catch(e) { console.warn(e.message); }
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  // ── 관리자: 계정 삭제 ────────────────────────────────
  // Firebase Auth는 Admin SDK 없이 클라이언트에서 삭제 불가
  // → deletedAccounts 컬렉션에 username 기록 → 재가입 시 Auth 계정 덮어쓰기 허용
  const adminDeleteAccount = async (targetId) => {
    const targetProfile = profiles.find(p => p.id === targetId);
    // deletedAccounts에 username + oldId 기록 (재가입 허용용)
    if (targetProfile?.username) {
      try {
        await setDoc(docR("deletedAccounts", targetProfile.username), {
          deletedAt: new Date().toISOString(),
          oldId: targetId,
          username: targetProfile.username,
        });
      } catch(e) { console.warn("deletedAccounts 기록 실패:", e.message); }
    }
    // profile 삭제
    try { await deleteDoc(docR("profiles", targetId)); } catch(e) { console.warn(e.message); }
    // adminOverrides 삭제
    try { await deleteDoc(docR("adminOverrides", targetId)); } catch(e) {}
    // 관련 meetings 삭제
    const relatedMtgs = meetings.filter(m => m.fromId === targetId || m.toId === targetId);
    for (const m of relatedMtgs) {
      try { await deleteDoc(docR("meetings", m.id)); } catch(e) {}
    }
    // 미션 삭제
    try { await deleteDoc(docR("missions", targetId)); } catch(e) {}
    // 로컬 상태 즉시 반영
    setProfiles(prev => prev.filter(p => p.id !== targetId));
    setMeetings(prev => prev.filter(m => m.fromId !== targetId && m.toId !== targetId));
  };

  const roomFor   = (otherId) => [uid, otherId].sort().join("_");
  const openChat  = (roomId, name) => setOverlay({ type: "chat", data: { roomId, name } });

  const myMissions = missions[uid] || {};
  const sentCount  = meetings.filter(m => m.fromId === uid).length;

  const NAV = [
    { id: "dashboard", label: "추천"    },
    { id: "directory", label: "검색"    },
    { id: "community", label: "커뮤니티" },
    { id: "meetings",  label: "티미팅"  },
    { id: "missions",  label: "미션"    },
    { id: "calendar",  label: "일정"    },
  ];

  const renderMain = () => {
    switch (view) {
      case "dashboard":  return <Dashboard profiles={mergedProfiles} myProfile={mergedProfiles.find(p => p.id === uid) || myProfile} uid={uid} onRequest={sendReq} onChat={p => openChat(roomFor(p.id), p.name)} />;
      case "directory":  return <Directory profiles={mergedProfiles} uid={uid} onRequest={sendReq} onChat={p => openChat(roomFor(p.id), p.name)} onViewProfile={p => setOverlay({ type: "profileView", data: p })} />;
      case "community":  return <Community posts={posts} profiles={mergedProfiles} rooms={rooms} uid={uid} onOpenPost={p => setOverlay({ type: "post", data: p })} onNewPost={() => setOverlay({ type: "newPost" })} onOpenChat={(id, name) => openChat(id, name)} onCreateRoom={createRoom} onLeaveRoom={leaveRoom} onInviteToRoom={inviteToRoom} />;
      case "meetings":   return <Meetings meetings={meetings} profiles={mergedProfiles} uid={uid} onUpdate={updateMtg} onChat={m => { const oid = m.fromId === uid ? m.toId : m.fromId; openChat(roomFor(oid), m.fromId === uid ? m.toName : m.fromName); }} />;
      case "missions":   return <MissionView myMissions={myMissions} sentCount={sentCount} uid={uid} onUpdate={updateMission} />;
      case "calendar":   return <CalView meetings={meetings} events={events} uid={uid} onAdd={addEvent} />;
      default: return null;
    }
  };

  // ── 로딩 ─────────────────────────────────────────────
  if (authStatus === "loading") return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#020617", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 48, height: 48, border: "3px solid #f59e0b", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <p style={{ color: "#f59e0b", fontSize: 12, fontWeight: 700, letterSpacing: "0.18em" }}>GLOBAL CONNECT</p>
    </div>
  );

  // PC 레이아웃
  if (!isMobile) {
    return (
      <div style={{ width: "100vw", height: "100dvh", background: "#020617", color: "#f1f5f9", fontFamily: "Pretendard,sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <style>{`@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css'); ::-webkit-scrollbar{width:6px;} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(245,158,11,0.3);border-radius:3px} *{box-sizing:border-box;} select option{background:#020617;}`}</style>

        {/* PC 미인증 */}
        {(authStatus === "unauth" || authStatus === "needProfile") && (
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#020617 0%,#0a1628 100%)" }}>
            <div style={{ width: 420, height: "90vh", maxHeight: 780, flexShrink: 0, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 40px 80px rgba(0,0,0,0.6)" }}>
              <AuthView onLogin={handleLogin} onRegister={handleRegister} onAdmin={() => setOverlay({ type: "adminAuth" })} />
            </div>
          </div>
        )}

        {/* PC 메인 */}
        {authStatus === "auth" && (
          <>
            {/* PC 상단 헤더 */}
            <header style={{ padding: "0 32px", height: 60, display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, background: "rgba(2,6,23,0.95)", backdropFilter: "blur(12px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
                <div>
                  <span style={{ fontSize: 18, fontWeight: 900, background: "linear-gradient(90deg,#fde68a,#f59e0b,#d97706)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Global Connect</span>
                  <span style={{ fontSize: 10, color: "rgba(251,191,36,0.4)", letterSpacing: "0.15em", marginLeft: 12 }}>HMG 주재원 네트워크</span>
                </div>
                {/* PC 상단 탭 네비 */}
                <nav style={{ display: "flex", gap: 4 }}>
                  {NAV.map(n => (
                    <button key={n.id} onClick={() => setView(n.id)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 14px", borderRadius: 10, background: view === n.id ? "rgba(245,158,11,0.12)" : "none", border: view === n.id ? "1px solid rgba(245,158,11,0.25)" : "1px solid transparent", color: view === n.id ? "#f59e0b" : "#64748b", cursor: "pointer", fontFamily: "Pretendard,sans-serif", fontSize: 13, fontWeight: 600, transition: "all 0.2s" }}>
                      <NavIcon id={n.id} active={view === n.id} />
                      <span>{n.label}</span>
                    </button>
                  ))}
                </nav>
              </div>
              <div onClick={() => setOverlay({ type: "profile" })} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{myProfile?.name}</p>
                  <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>{myProfile?.city} · {myProfile?.country}</p>
                </div>
                <Avatar profile={myProfile} size={36} />
              </div>
            </header>

            {/* PC 메인 콘텐츠 - 3컬럼 */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden", padding: "24px 32px", gap: 24, alignItems: "flex-start", width: "100%" }}>
              {/* 왼쪽 사이드바 - 내 프로필 */}
              <aside style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", maxHeight: "100%" }}>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                    <Avatar profile={myProfile} size={52} />
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: 0 }}>{myProfile?.name}</p>
                      <p style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{myProfile?.org}</p>
                      <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 2, fontWeight: 600 }}>{myProfile?.city} · {myProfile?.country}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.22)", color: "#f59e0b", fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 10 }}>{myProfile?.concern}</span>
                    {myProfile?.interest && <span style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 10 }}>{myProfile?.interest}</span>}
                  </div>
                </div>
                {/* 미션 요약 */}
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", margin: "0 0 12px", letterSpacing: "0.08em" }}>MISSIONS</p>
                  {[
                    ["티미팅 발송", Math.min(meetings.filter(m => m.fromId === uid).length, 2), 2],
                    ["티미팅 인증샷", Math.min((missions[uid]?.m2Photos||[]).length, 2), 2],
                    ["조별 식사 인증", Math.min((missions[uid]?.m3Photos||[]).length, 1), 1],
                  ].map(([label, cur, tot]) => (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{label}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: cur >= tot ? "#4ade80" : "#f59e0b" }}>{cur}/{tot}</span>
                      </div>
                      <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(cur/tot)*100}%`, background: cur >= tot ? "#4ade80" : "#f59e0b", borderRadius: 2, transition: "width 0.4s" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

              {/* 메인 콘텐츠 영역 */}
              <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
                {renderMain()}
              </main>

              {/* 오른쪽 사이드바 - 최근 게시글 */}
              <aside style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16, overflowY: "auto", maxHeight: "100%" }}>
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", margin: 0, letterSpacing: "0.08em" }}>최근 게시글</p>
                    <button onClick={() => setView("community")} style={{ background: "none", border: "none", color: "#64748b", fontSize: 11, cursor: "pointer", fontFamily: "Pretendard,sans-serif" }}>더보기</button>
                  </div>
                  {posts.slice(0, 5).map(post => (
                    <div key={post.id} onClick={() => setOverlay({ type: "post", data: post })} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>{post.tag}</span>
                        <span style={{ fontSize: 9, color: "#4b5563" }}>{timeAgo(post.createdAt)}</span>
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</p>
                      <p style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{post.authorName} · 댓글 {post.commentCount||0}</p>
                    </div>
                  ))}
                  {posts.length === 0 && <p style={{ fontSize: 12, color: "#4b5563", fontStyle: "italic" }}>게시글이 없어요.</p>}
                </div>
                {/* 수락된 티미팅 */}
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 20, padding: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b", margin: "0 0 12px", letterSpacing: "0.08em" }}>수락된 티미팅</p>
                  {meetings.filter(m => (m.fromId===uid||m.toId===uid) && m.status==="수락함").length === 0
                    ? <p style={{ fontSize: 12, color: "#4b5563", fontStyle: "italic" }}>아직 없어요.</p>
                    : meetings.filter(m => (m.fromId===uid||m.toId===uid) && m.status==="수락함").map(m => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "8px 10px", background: "rgba(34,197,94,0.06)", borderRadius: 12, border: "1px solid rgba(34,197,94,0.15)" }}>
                        <span style={{ color: "#4ade80", fontSize: 14 }}>✓</span>
                        <div><p style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{m.fromId===uid?m.toName:m.fromName}</p><p style={{ fontSize: 10, color: "#64748b" }}>{m.fromId===uid?m.toOrg:m.fromOrg}</p></div>
                      </div>
                    ))
                  }
                </div>
              </aside>
            </div>
          </>
        )}

        {/* 오버레이 (PC에서도 동일) */}
        {overlay?.type === "profile"     && <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}><div style={{ width:480,maxHeight:"90vh",background:"#020617",borderRadius:24,overflow:"hidden",display:"flex",flexDirection:"column",border:"1px solid rgba(255,255,255,0.1)" }}><ProfileForm initialData={myProfile} onSave={saveProfile} onBack={() => setOverlay(null)} onLogout={handleLogout} /></div></div>}
        {overlay?.type === "adminAuth"   && <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}><div style={{ width:420,background:"#020617",borderRadius:24,overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)" }}><AdminAuth onSuccess={() => { setIsAdmin(true); setOverlay({ type: "admin" }); }} onBack={() => setOverlay(null)} /></div></div>}
        {overlay?.type === "admin"       && <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}><div style={{ width:640,height:"85vh",background:"#020617",borderRadius:24,overflow:"hidden",display:"flex",flexDirection:"column",border:"1px solid rgba(255,255,255,0.1)" }}><AdminView profiles={mergedProfiles} posts={posts} missions={missions} meetings={meetings} onBack={() => { setIsAdmin(false); setOverlay(null); }} onUpdateProfile={adminUpdateProfile} onDeleteAccount={adminDeleteAccount} onDeletePost={adminDeletePost} /></div></div>}
        {overlay?.type === "chat"        && <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}><div style={{ width:480,height:"75vh",background:"#020617",borderRadius:24,overflow:"hidden",display:"flex",flexDirection:"column",border:"1px solid rgba(255,255,255,0.1)" }}><ChatRoom roomId={overlay.data.roomId} name={overlay.data.name} myProfile={myProfile} uid={uid} profiles={mergedProfiles} chats={chats} setChats={setChats} onSend={addMsg} onBack={() => setOverlay(null)} db={db} rooms={rooms} onLeaveRoom={leaveRoom} onInviteToRoom={inviteToRoom} /></div></div>}
        {overlay?.type === "post"        && <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}><div style={{ width:560,height:"80vh",background:"#020617",borderRadius:24,overflow:"hidden",display:"flex",flexDirection:"column",border:"1px solid rgba(255,255,255,0.1)" }}><PostDetail post={overlay.data} profiles={mergedProfiles} uid={uid} myProfile={myProfile} onAddComment={t => addComment(overlay.data.id, t)} onLike={() => likePost(overlay.data.id)} onBack={() => setOverlay(null)} db={db} /></div></div>}
        {overlay?.type === "newPost"     && <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}><div style={{ width:560,height:"85vh",background:"#020617",borderRadius:24,overflow:"hidden",display:"flex",flexDirection:"column",border:"1px solid rgba(255,255,255,0.1)" }}><NewPost onSubmit={async p => { await addPost(p); setOverlay(null); }} onBack={() => setOverlay(null)} /></div></div>}
        {overlay?.type === "profileView" && <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100 }}><div style={{ width:420,height:"70vh",background:"#020617",borderRadius:24,overflow:"hidden",display:"flex",flexDirection:"column",border:"1px solid rgba(255,255,255,0.1)" }}><ProfileView profile={overlay.data} onBack={() => setOverlay(null)} onRequest={() => { sendReq(overlay.data); setOverlay(null); }} onChat={() => { openChat(roomFor(overlay.data.id), overlay.data.name); setOverlay(null); }} /></div></div>}
      </div>
    );
  }

  // ── 모바일 레이아웃 ──────────────────────────────────
  return (
    <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", height: "100dvh", display: "flex", flexDirection: "column", background: "#020617", color: "#f1f5f9", fontFamily: "Pretendard,sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{`@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css'); ::-webkit-scrollbar{display:none;} *{box-sizing:border-box;} select option{background:#020617;} html,body,#root{height:100%;height:100dvh;overflow:hidden;}`}</style>

      {/* 미인증 → 로그인/회원가입 */}
      {(authStatus === "unauth" || authStatus === "needProfile") && (
        <AuthView
          onLogin={handleLogin}
          onRegister={handleRegister}
          onAdmin={() => setOverlay({ type: "adminAuth" })}
          needProfile={authStatus === "needProfile"}
          onSaveProfile={saveProfile}
          myProfile={myProfile}
        />
      )}

      {/* 인증 완료 → 메인 앱 */}
      {authStatus === "auth" && (
        <>
          <header style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 900, background: "linear-gradient(90deg,#fde68a,#f59e0b,#d97706)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Global Connect</div>
              <div style={{ fontSize: 9, color: "rgba(251,191,36,0.4)", letterSpacing: "0.18em" }}>HMG 주재원 네트워크</div>
            </div>
            <div onClick={() => setOverlay({ type: "profile" })} style={{ cursor: "pointer" }}><Avatar profile={myProfile} size={36} /></div>
          </header>

          <div style={S.screen}>{renderMain()}</div>

          <nav style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(2,6,23,0.96)", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-around", padding: "8px 2px 12px" }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => setView(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", color: view === n.id ? "#f59e0b" : "#4b5563", cursor: "pointer", fontFamily: "Pretendard,sans-serif", transform: view === n.id ? "scale(1.08)" : "scale(1)", transition: "all 0.2s", padding: "0 4px" }}>
                <NavIcon id={n.id} active={view === n.id} />
                <span style={{ fontSize: 8, fontWeight: 600 }}>{n.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {/* 오버레이 */}
      {overlay?.type === "profile"     && <ProfileForm initialData={myProfile} onSave={saveProfile} onBack={() => setOverlay(null)} onLogout={handleLogout} />}
      {overlay?.type === "adminAuth"   && <AdminAuth onSuccess={() => { setIsAdmin(true); setOverlay({ type: "admin" }); }} onBack={() => setOverlay(null)} />}
      {overlay?.type === "admin"       && <AdminView profiles={mergedProfiles} posts={posts} missions={missions} meetings={meetings} onBack={() => { setIsAdmin(false); setOverlay(null); }} onUpdateProfile={adminUpdateProfile} onDeleteAccount={adminDeleteAccount} onDeletePost={adminDeletePost} />}
      {overlay?.type === "chat"        && <ChatRoom roomId={overlay.data.roomId} name={overlay.data.name} myProfile={myProfile} uid={uid} profiles={mergedProfiles} chats={chats} setChats={setChats} onSend={addMsg} onBack={() => setOverlay(null)} db={db} rooms={rooms} onLeaveRoom={leaveRoom} onInviteToRoom={inviteToRoom} />}
      {overlay?.type === "post"        && <PostDetail post={overlay.data} profiles={mergedProfiles} uid={uid} myProfile={myProfile} onAddComment={t => addComment(overlay.data.id, t)} onLike={() => likePost(overlay.data.id)} onBack={() => setOverlay(null)} db={db} />}
      {overlay?.type === "newPost"     && <NewPost onSubmit={async p => { await addPost(p); setOverlay(null); }} onBack={() => setOverlay(null)} />}
      {overlay?.type === "profileView" && <ProfileView profile={overlay.data} onBack={() => setOverlay(null)} onRequest={() => { sendReq(overlay.data); setOverlay(null); }} onChat={() => { openChat(roomFor(overlay.data.id), overlay.data.name); setOverlay(null); }} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  로그인 / 회원가입
// ══════════════════════════════════════════════════════════
function AuthView({ onLogin, onRegister, onAdmin }) {
  const [mode,   setMode]   = useState("login");
  const [step,   setStep]   = useState(1);
  const [uname,  setUname]  = useState("");
  const [pw,     setPw]     = useState("");
  const [pw2,    setPw2]    = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [prof, setProf] = useState({ name:"", org:"", country:"", city:"", concern: CONCERNS[0], interest:"", personality:"사교적인", targetPartner:"", photoUrl:"" });
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  const doLogin = async () => {
    setErrMsg(""); setLoading(true);
    if (!uname.trim() || !pw) { setErrMsg("아이디와 비밀번호를 입력해주세요."); setLoading(false); return; }
    const err = await onLogin(uname.trim(), pw);
    if (err) setErrMsg(err);
    setLoading(false);
  };

  const doNext = async () => {
    setErrMsg("");
    if (!uname.trim())              return setErrMsg("아이디를 입력해주세요.");
    if (uname.trim().length < 4)   return setErrMsg("아이디는 4자 이상이어야 합니다.");
    if (pw.length < 6)             return setErrMsg("비밀번호는 6자 이상이어야 합니다.");
    if (pw !== pw2)                return setErrMsg("비밀번호가 일치하지 않습니다.");
    setLoading(true);
    try {
      // deletedAccounts 확인 (삭제된 계정이면 재가입 허용)
      const deletedSnap = await getDoc(docR("deletedAccounts", uname.trim()));
      if (deletedSnap.exists()) {
        // 삭제된 계정 → 재가입 허용
        setLoading(false);
        setStep(2);
        return;
      }
      // profiles 컬렉션에서 username 중복 확인
      const profileSnap = await getDocs(
        query(col("profiles"), where("username", "==", uname.trim()))
      );
      if (!profileSnap.empty) {
        setLoading(false);
        return setErrMsg("이미 사용 중인 아이디입니다.");
      }
      setLoading(false);
      setStep(2);
    } catch(e) {
      // Firestore 접근 실패 시 일단 다음 단계로 (가입 시 최종 확인)
      console.warn("중복확인 오류:", e.message);
      setLoading(false);
      setStep(2);
    }
  };

  const doRegister = async () => {
    setErrMsg("");
    if (!prof.name.trim())    return setErrMsg("이름을 입력해주세요.");
    if (!prof.country.trim()) return setErrMsg("부임 국가를 입력해주세요.");
    if (!prof.city.trim())    return setErrMsg("부임 도시를 입력해주세요.");
    setLoading(true);
    const err = await onRegister(uname.trim(), pw, prof);
    if (err) setErrMsg(err);
    setLoading(false);
  };

  const handlePhoto = e => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => { setPreview(ev.target.result); setProf(f => ({ ...f, photoUrl: ev.target.result })); };
    r.readAsDataURL(file);
  };

  const inp = { ...S.inp };
  const lbl = { ...S.lbl };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#020617", position: "relative", overflow: "hidden" }}>
      {/* 배경 */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.12 }} viewBox="0 0 400 750" preserveAspectRatio="xMidYMid slice">
        <defs><radialGradient id="ag" cx="50%" cy="30%" r="50%"><stop offset="0%" stopColor="#f59e0b" stopOpacity="0.9"/><stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/></radialGradient></defs>
        {[[60,120,200,200],[200,200,340,140],[200,200,130,350],[200,200,290,380],[340,140,370,80],[130,350,80,480],[290,380,350,500]].map(([x1,y1,x2,y2],i)=>(
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f59e0b" strokeWidth="0.8" strokeOpacity="0.6"/>
        ))}
        {[[200,200,5],[60,120,3],[340,140,3],[130,350,2.5],[290,380,2.5],[370,80,2]].map(([cx,cy,r],i)=>(
          <circle key={i} cx={cx} cy={cy} r={r} fill="#f59e0b"/>
        ))}
        <circle cx="200" cy="200" r="22" fill="url(#ag)" opacity="0.4"/>
      </svg>

      {/* 헤더 */}
      <div style={{ padding: "48px 32px 0", textAlign: "center", position: "relative" }}>
        <div style={{ fontSize: 22, fontWeight: 900, background: "linear-gradient(90deg,#fde68a,#f59e0b,#d97706)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>Global Connect</div>
        <div style={{ fontSize: 9, color: "rgba(251,191,36,0.4)", letterSpacing: "0.18em", marginBottom: 28 }}>HMG 주재원 부임전 정규교육</div>
      </div>

      {/* 탭 */}
      <div style={{ padding: "0 24px", position: "relative" }}>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
          {[["login","로그인"],["register","회원가입"]].map(([id, label]) => (
            <button key={id} onClick={() => { setMode(id); setStep(1); setErrMsg(""); }} style={{ flex: 1, padding: 10, borderRadius: 12, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "Pretendard,sans-serif", background: mode === id ? "#f59e0b" : "none", color: mode === id ? "#020617" : "#64748b", transition: "all 0.2s" }}>{label}</button>
          ))}
        </div>
      </div>

      {/* 폼 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 40px", position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>

        {mode === "login" && (
          <>
            <div><label style={lbl}>아이디</label><input style={inp} placeholder="아이디를 입력하세요" value={uname} onChange={e => setUname(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} /></div>
            <div><label style={lbl}>비밀번호</label><input type="password" style={inp} placeholder="비밀번호를 입력하세요" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && doLogin()} /></div>
            {errMsg && <p style={{ color: "#f87171", fontSize: 12, fontWeight: 700, margin: 0, textAlign: "center" }}>{errMsg}</p>}
            <button onClick={doLogin} disabled={loading} style={{ ...S.btnAmber, width: "100%", padding: 16, fontSize: 15, borderRadius: 18, opacity: loading ? 0.6 : 1 }}>
              {loading ? "로그인 중..." : "로그인"}
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "#64748b", margin: 0 }}>아직 계정이 없으신가요? <button onClick={() => { setMode("register"); setErrMsg(""); }} style={{ background: "none", border: "none", color: "#f59e0b", fontWeight: 700, cursor: "pointer", fontFamily: "Pretendard,sans-serif", fontSize: 12 }}>회원가입</button></p>
          </>
        )}

        {mode === "register" && step === 1 && (
          <>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>사용할 아이디와 비밀번호를 설정해주세요.</p>
            <div><label style={lbl}>아이디</label><input style={inp} placeholder="영문, 숫자 조합 (예: gildong83)" value={uname} onChange={e => setUname(e.target.value)} /></div>
            <div><label style={lbl}>비밀번호</label><input type="password" style={inp} placeholder="4자 이상" value={pw} onChange={e => setPw(e.target.value)} /></div>
            <div><label style={lbl}>비밀번호 확인</label><input type="password" style={inp} placeholder="비밀번호를 다시 입력하세요" value={pw2} onChange={e => setPw2(e.target.value)} onKeyDown={e => e.key === "Enter" && doNext()} /></div>
            {errMsg && <p style={{ color: "#f87171", fontSize: 12, fontWeight: 700, margin: 0, textAlign: "center" }}>{errMsg}</p>}
            <button onClick={doNext} style={{ ...S.btnAmber, width: "100%", padding: 16, fontSize: 15, borderRadius: 18 }}>다음 → 프로필 입력</button>
          </>
        )}

        {mode === "register" && step === 2 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setStep(1)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18, padding: 0 }}>←</button>
              <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>프로필 정보를 입력해주세요.</p>
            </div>
            {/* 사진 */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, overflow: "hidden", border: "2px solid rgba(245,158,11,0.3)", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {preview ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "rgba(245,158,11,0.4)", fontSize: 28 }}>👤</span>}
                </div>
                <label htmlFor="regPhoto" style={{ position: "absolute", bottom: -4, right: -4, width: 24, height: 24, background: "#f59e0b", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12 }}>📷</label>
                <input ref={fileRef} id="regPhoto" type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
              </div>
              <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>프로필 사진 (선택)</p>
            </div>
            <div><label style={lbl}>이름 *</label><input style={inp} placeholder="성함을 입력하세요" value={prof.name} onChange={e => setProf(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label style={lbl}>소속</label><input style={inp} placeholder="예: 경영지원팀, 미주법인" value={prof.org} onChange={e => setProf(f => ({ ...f, org: e.target.value }))} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div><label style={lbl}>부임 국가 *</label><input style={inp} placeholder="예: 미국" value={prof.country} onChange={e => setProf(f => ({ ...f, country: e.target.value }))} /></div>
              <div><label style={lbl}>부임 도시 *</label><input style={inp} placeholder="예: 어바인" value={prof.city} onChange={e => setProf(f => ({ ...f, city: e.target.value }))} /></div>
            </div>
            <div>
              <label style={lbl}>주요 고민</label>
              <select style={{ ...inp, cursor: "pointer" }} value={prof.concern} onChange={e => setProf(f => ({ ...f, concern: e.target.value }))}>
                {CONCERNS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={lbl}>관심사</label><input style={inp} placeholder="예: 골프, 테니스, 맛집 탐방" value={prof.interest} onChange={e => setProf(f => ({ ...f, interest: e.target.value }))} /></div>
            {errMsg && <p style={{ color: "#f87171", fontSize: 12, fontWeight: 700, margin: 0, textAlign: "center" }}>{errMsg}</p>}
            <button onClick={doRegister} disabled={loading} style={{ ...S.btnAmber, width: "100%", padding: 16, fontSize: 15, borderRadius: 18, opacity: loading ? 0.6 : 1 }}>
              {loading ? "가입 중..." : "가입 완료 및 시작하기"}
            </button>
          </>
        )}

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, textAlign: "center" }}>
          <button onClick={onAdmin} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.2)", cursor: "pointer", fontFamily: "Pretendard,sans-serif", fontSize: 11, letterSpacing: "0.08em" }}>관리자 로그인</button>
        </div>
        <p style={{ textAlign: "center", color: "rgba(255,255,255,0.12)", fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", margin: 0 }}>HYUNDAI MOTOR GROUP</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  프로필 폼 (설정에서 수정)
// ══════════════════════════════════════════════════════════
function ProfileForm({ initialData, onSave, onBack, onLogout }) {
  const [form, setForm]       = useState(initialData || { name: "", org: "", country: "", city: "", concern: CONCERNS[0], interest: "", personality: "사교적인", targetPartner: "", photoUrl: "" });
  const [preview, setPreview] = useState(initialData?.photoUrl || null);
  const [saving, setSaving]   = useState(false);
  const fileRef = useRef();

  const handlePhoto = e => {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader();
    r.onload = ev => { setPreview(ev.target.result); setForm(f => ({ ...f, photoUrl: ev.target.result })); };
    r.readAsDataURL(file);
  };

  const doSave = async () => {
    if (!form.name.trim()) return alert("이름을 입력해주세요.");
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <div style={S.overlay}>
      <div style={S.overlayHeader}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9", flex: 1 }}>내 프로필</span>
        <button onClick={onLogout} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 11, fontWeight: 700, padding: "6px 12px", borderRadius: 10, cursor: "pointer", fontFamily: "Pretendard,sans-serif" }}>로그아웃</button>
      </div>
      <div style={{ ...S.overlayBody, paddingBottom: 40 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ position: "relative" }}>
            <div style={{ width: 88, height: 88, borderRadius: 24, overflow: "hidden", border: "2px solid rgba(245,158,11,0.3)", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {preview ? <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "rgba(245,158,11,0.4)", fontSize: 36 }}>👤</span>}
            </div>
            <label htmlFor="editPhoto" style={{ position: "absolute", bottom: -6, right: -6, width: 30, height: 30, background: "#f59e0b", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14 }}>📷</label>
            <input ref={fileRef} id="editPhoto" type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[["name","이름","성함을 입력하세요"],["org","소속","예: 경영지원팀, 미주법인"]].map(([k,l,ph]) => (
            <div key={k}><label style={S.lbl}>{l}</label><input style={S.inp} placeholder={ph} value={form[k]||""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[["country","부임 국가","예: 미국"],["city","부임 도시","예: 어바인"]].map(([k,l,ph]) => (
              <div key={k}><label style={S.lbl}>{l}</label><input style={S.inp} placeholder={ph} value={form[k]||""} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))} /></div>
            ))}
          </div>
          <div>
            <label style={S.lbl}>주요 고민</label>
            <select style={{ ...S.inp, cursor: "pointer" }} value={form.concern} onChange={e => setForm(f => ({ ...f, concern: e.target.value }))}>
              {CONCERNS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={S.lbl}>관심사</label><input style={S.inp} placeholder="예: 골프, 테니스, 맛집 탐방" value={form.interest||""} onChange={e => setForm(f => ({ ...f, interest: e.target.value }))} /></div>
          <div>
            <label style={S.lbl}>네트워킹 희망 사항</label>
            <textarea style={{ ...S.inp, minHeight: 80, resize: "none" }} placeholder="어떤 분을 만나고 싶으신가요?" value={form.targetPartner||""} onChange={e => setForm(f => ({ ...f, targetPartner: e.target.value }))} />
          </div>
          <button onClick={doSave} disabled={saving} style={{ ...S.btnAmber, width: "100%", padding: 16, fontSize: 15, borderRadius: 18, opacity: saving ? 0.6 : 1 }}>
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  관리자
// ══════════════════════════════════════════════════════════
function AdminAuth({ onSuccess, onBack }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(false);
  const go = () => { if (pw === "06080910") onSuccess(); else { setErr(true); setPw(""); setTimeout(() => setErr(false), 2000); } };
  return (
    <div style={{ ...S.overlay, alignItems: "center", justifyContent: "center" }}>
      <div style={{ padding: 40, textAlign: "center", width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
        <div style={{ width: 80, height: 80, background: "rgba(245,158,11,0.1)", borderRadius: 24, border: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>🛡️</div>
        <div><h2 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>관리자 로그인</h2><p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>기획자 전용 비밀번호를 입력해주세요.</p></div>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="password" style={{ ...S.inp, textAlign: "center", fontSize: 24, letterSpacing: "0.5em" }} maxLength={8} placeholder="••••••••" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === "Enter" && go()} />
          {err && <p style={{ color: "#f87171", fontSize: 12, fontWeight: 700, margin: 0 }}>비밀번호가 일치하지 않습니다.</p>}
          <button onClick={go} style={{ ...S.btnAmber, width: "100%", padding: 16 }}>확인</button>
          <button onClick={onBack} style={{ ...S.btnGhost, width: "100%", padding: 14 }}>뒤로</button>
        </div>
      </div>
    </div>
  );
}

function AdminView({ profiles, posts, missions, meetings, onBack, onUpdateProfile, onDeleteAccount, onDeletePost }) {
  const [tab, setTab]       = useState("users");
  const [editId, setEditId] = useState(null);
  const [editForm, setEF]   = useState({});
  const [saving, setSaving] = useState(false);

  const startEdit = p => { setEditId(p.id); setEF({ city: p.city||"", country: p.country||"", concern: p.concern||CONCERNS[0] }); };
  const saveEdit  = async () => { setSaving(true); await onUpdateProfile(editId, editForm); setEditId(null); setSaving(false); };

  return (
    <div style={S.overlay}>
      <div style={S.overlayHeader}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>관리자 대시보드</div>
          <div style={{ fontSize: 9, color: "#f59e0b", letterSpacing: "0.1em" }}>ADMIN PANEL</div>
        </div>
      </div>
      <div style={{ padding: "12px 16px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 14, border: "1px solid rgba(255,255,255,0.08)" }}>
          {[["users","사용자 관리"],["missions","미션 현황"],["posts","게시글 현황"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "8px 4px", borderRadius: 10, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "Pretendard,sans-serif", background: tab === id ? "#f59e0b" : "none", color: tab === id ? "#020617" : "#64748b", transition: "all 0.2s" }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={S.overlayBody}>

        {tab === "users" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 14, padding: "12px 14px" }}>
              <p style={{ fontSize: 11, color: "#fde68a", lineHeight: 1.6, fontStyle: "italic", margin: 0 }}>🔧 도시·국가·고민 수정 시 추천 매칭에 반영됩니다.</p>
            </div>
            <p style={{ fontSize: 12, color: "#64748b" }}>가입 사용자 <strong style={{ color: "#f1f5f9" }}>{profiles.length}명</strong></p>
            {profiles.map(p => (
              <div key={p.id} style={{ ...S.card, borderRadius: 18 }}>
                {editId === p.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{p.name} — 매칭 정보 수정</p>
                    {[["city","도시"],["country","국가"]].map(([k, l]) => (
                      <div key={k}><label style={S.lbl}>{l}</label><input style={S.inp} value={editForm[k]||""} onChange={e => setEF(f => ({ ...f, [k]: e.target.value }))} /></div>
                    ))}
                    <div>
                      <label style={S.lbl}>주요 고민</label>
                      <select style={{ ...S.inp, cursor: "pointer" }} value={editForm.concern||""} onChange={e => setEF(f => ({ ...f, concern: e.target.value }))}>
                        {CONCERNS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={saveEdit} disabled={saving} style={{ ...S.btnAmber, flex: 1, padding: 10 }}>{saving ? "저장 중..." : "저장"}</button>
                      <button onClick={() => setEditId(null)} style={{ ...S.btnGhost, flex: 1, padding: 10 }}>취소</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar profile={p} size={40} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{p.name} <span style={{ fontSize: 10, color: "#64748b", fontWeight: 400 }}>({p.org})</span></p>
                      <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{p.city} · {p.country}</p>
                      <p style={{ fontSize: 10, color: "#64748b" }}>{p.concern}</p>
                      {p.username && <p style={{ fontSize: 9, color: "#4ade80", marginTop: 2, fontWeight: 700 }}>● {p.username}</p>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
                      <button onClick={() => startEdit(p)} style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b", fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "Pretendard,sans-serif" }}>수정</button>
                      <button onClick={() => { if (window.confirm(`${p.name} (${p.username||"샘플"}) 계정을 삭제하시겠습니까?\n삭제 시 재가입이 필요합니다.`)) onDeleteAccount(p.id); }} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 9, cursor: "pointer", fontFamily: "Pretendard,sans-serif" }}>삭제</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === "missions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>전체 미션 현황</p>
            {profiles.map(p => {
              const ms     = missions[p.id] || {};
              // 티미팅 발송: missions의 m1Count 대신 실제 meetings에서 계산
              const sentCnt = (meetings || []).filter(m => m.fromId === p.id).length;
              const m1done = sentCnt >= 2;
              const m2done = (ms.m2Photos || []).length >= 2;
              const m3done = (ms.m3Photos || []).length >= 1;
              const allDone = m1done && m2done && m3done;
              return (
                <div key={p.id} style={{ ...S.card, borderRadius: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <Avatar profile={p} size={36} />
                    <div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{p.name}</p><p style={{ fontSize: 10, color: "#64748b" }}>{p.org}</p></div>
                    {allDone && <span style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 8 }}>완료</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["티미팅 발송 "+sentCnt+"/2", m1done],["티미팅 인증 "+(ms.m2Photos||[]).length+"/2", m2done],["식사 인증 "+(ms.m3Photos||[]).length+"/1", m3done]].map(([label, done]) => (
                      <div key={label} style={{ flex: 1, background: done ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${done ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, padding: "6px 4px", textAlign: "center" }}>
                        <p style={{ fontSize: 9, color: done ? "#4ade80" : "#64748b", fontWeight: 700, margin: 0 }}>{done ? "✓ " : ""}{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "posts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>전체 게시글 <strong style={{ color: "#f1f5f9" }}>{posts.length}개</strong></p>
            {posts.map(post => (
              <div key={post.id} style={{ ...S.card, borderRadius: 18 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ ...S.amberBadge, fontSize: 9 }}>{post.tag}</span>
                  <p style={{ fontSize: 10, color: "#64748b", margin: 0, marginLeft: "auto" }}>{timeAgo(post.createdAt)}</p>
                  <button
                    onClick={() => { if (window.confirm(`"${post.title}" 게시글을 삭제하시겠습니까?`)) onDeletePost(post.id); }}
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 10, fontWeight: 700, padding: "4px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "Pretendard,sans-serif", flexShrink: 0 }}>
                    삭제
                  </button>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{post.title}</p>
                <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>작성자: {post.authorName} · 댓글 {post.commentCount || 0} · 공감 {post.likeCount || 0}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  대시보드 / 검색 / 채팅 / 티미팅 / 커뮤니티 / 미션 / 일정
//  (이하 컴포넌트들은 Artifact 버전과 동일한 UI,
//   데이터 접근만 Firebase 기반으로 동작)
// ══════════════════════════════════════════════════════════

function Dashboard({ profiles, myProfile, uid, onRequest, onChat }) {
  if (!myProfile) return null;
  const others      = profiles.filter(p => p.id !== uid);
  const sameCity    = others.filter(p => p.city    === myProfile.city);
  const sameCountry = others.filter(p => p.country === myProfile.country && p.city !== myProfile.city);
  const sameConcern = others.filter(p => p.concern === myProfile.concern);
  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={S.cardLg}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, background: "rgba(245,158,11,0.06)", borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <Avatar profile={myProfile} size={56} />
          <div>
            <p style={{ fontSize: 10, color: "#f59e0b", fontWeight: 700, letterSpacing: "0.12em", marginBottom: 4 }}>HMG 주재원</p>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>안녕하세요, {myProfile.name} 님!</h3>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{myProfile.city} · {myProfile.country}</p>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 16 }}>
          <span style={S.amberBadge}>{myProfile.concern}</span>
          {myProfile.interest && <span style={{ ...S.amberBadge, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>{myProfile.interest}</span>}
        </div>
        <p style={{ fontSize: 12, color: "#64748b", marginTop: 14 }}>{myProfile.city}에 <strong style={{ color: "#fff" }}>{sameCity.length}명</strong>이 함께 부임 예정이에요.</p>
      </div>
      {[["같은 도시", `${myProfile.city} 부임 예정`, sameCity],["같은 나라", `${myProfile.country} 부임 예정`, sameCountry],["비슷한 고민", "공통 관심사", sameConcern]].map(([title, sub, list]) => (
        <section key={title}>
          <div style={{ marginBottom: 12, padding: "0 2px" }}>
            <h4 style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>{title}</h4>
            <p style={{ fontSize: 9, color: "#64748b", margin: 0 }}>{sub}</p>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12 }}>
            {list.length > 0 ? list.map(p => (
              <div key={p.id} style={{ minWidth: 164, maxWidth: 164, ...S.card, borderRadius: 22, display: "flex", flexDirection: "column", gap: 10 }}>
                <Avatar profile={p} size={50} />
                <div><p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p><p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>{p.org}</p></div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.1)", padding: "5px 8px", borderRadius: 10, textAlign: "center" }}>{p.city} · {p.country}</div>
                <p style={{ fontSize: 10, color: "#94a3b8", background: "rgba(255,255,255,0.05)", padding: "6px 8px", borderRadius: 10, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.concern}</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onChat(p)} style={{ ...S.btnGhost, flex: 1, padding: "7px 6px", fontSize: 10, borderRadius: 10 }}>💬 채팅</button>
                  <button onClick={() => onRequest(p)} style={{ ...S.btnAmber, flex: 1, padding: "7px 6px", fontSize: 10, borderRadius: 10 }}>신청</button>
                </div>
              </div>
            )) : <div style={{ width: "100%", padding: 28, border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 20, textAlign: "center", color: "#4b5563", fontSize: 12, fontStyle: "italic" }}>아직 매칭되는 분이 없어요.</div>}
          </div>
        </section>
      ))}
    </div>
  );
}

function Directory({ profiles, uid, onRequest, onChat, onViewProfile }) {
  const [term, setTerm] = useState("");
  const filtered = profiles.filter(p => p.id !== uid && (!term || p.name?.includes(term) || p.city?.includes(term) || p.country?.includes(term) || p.concern?.includes(term) || p.org?.includes(term)));
  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <input style={S.inp} placeholder="이름, 도시, 국가, 고민, 관심사로 검색..." value={term} onChange={e => setTerm(e.target.value)} />
      <p style={{ fontSize: 12, color: "#64748b" }}><strong style={{ color: "#fff" }}>{filtered.length}명</strong> 검색됨</p>
      {filtered.map(p => (
        <div key={p.id} style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, borderRadius: 20, cursor: "pointer" }} onClick={() => onViewProfile(p)}>
          <Avatar profile={p} size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{p.name}</p>
            <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>{p.org}</p>
            <p style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600, marginTop: 2 }}>{p.city} · {p.country}</p>
            <p style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>{p.concern}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button onClick={e => { e.stopPropagation(); onChat(p); }} style={{ ...S.btnGhost, padding: "7px 10px", fontSize: 10, borderRadius: 10 }}>💬</button>
            <button onClick={e => { e.stopPropagation(); onRequest(p); }} style={{ ...S.btnAmber, padding: "7px 10px", fontSize: 10, borderRadius: 10 }}>신청</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfileView({ profile, onBack, onRequest, onChat }) {
  return (
    <div style={S.overlay}>
      <div style={S.overlayHeader}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 15, color: "#f1f5f9" }}>프로필</span>
      </div>
      <div style={{ ...S.overlayBody, paddingBottom: 40 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 28, paddingTop: 8 }}>
          <Avatar profile={profile} size={80} />
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>{profile.name}</h2>
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{profile.org}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onChat}    style={{ ...S.btnGhost, padding: "10px 20px", borderRadius: 12 }}>💬 채팅하기</button>
            <button onClick={onRequest} style={{ ...S.btnAmber, padding: "10px 20px", borderRadius: 12 }}>티미팅 신청</button>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[["🌏 부임지", `${profile.city} · ${profile.country}`],["😟 주요 고민", profile.concern],["⭐ 관심사", profile.interest||"—"],["💡 네트워킹 희망", profile.targetPartner||"—"]].map(([label, value]) => (
            <div key={label} style={{ ...S.card, borderRadius: 16 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", margin: 0, marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 14, color: "#f1f5f9", margin: 0, lineHeight: 1.5 }}>{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatRoom({ roomId, name, myProfile, uid, profiles, chats, setChats, onSend, onBack, db, rooms, onLeaveRoom, onInviteToRoom }) {
  const [msgs,      setMsgs]      = useState([]);
  const [input,     setInput]     = useState("");
  const [showPanel, setShowPanel] = useState(null); // null | "members" | "invite"
  const [invitees,  setInvitees]  = useState([]);
  const isGroup = roomId.startsWith("city_") || roomId === "global" || roomId.startsWith("room");
  const currentRoom = rooms?.find(r => r.id === roomId);
  const memberProfiles = (currentRoom?.members || []).map(mid => profiles.find(p => p.id === mid)).filter(Boolean);
  const nonMembers = profiles.filter(p => p.id !== uid && !(currentRoom?.members || []).includes(p.id));

  useEffect(() => {
    const q = query(collection(db, "chats", roomId, "messages"), orderBy("createdAt"));
    return onSnapshot(q, snap => setMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [roomId]);

  const send = () => { if (!input.trim()) return; onSend(roomId, input.trim()); setInput(""); };

  return (
    <div style={S.overlay}>
      <div style={S.overlayHeader}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4 }}>←</button>
        <div style={{ width: 36, height: 36, background: "rgba(245,158,11,0.1)", borderRadius: 12, border: "1px solid rgba(245,158,11,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{isGroup ? "👥" : "💬"}</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{name}</p>
          <p style={{ fontSize: 10, color: "#64748b", margin: 0 }}>{isGroup ? `그룹 채팅 · ${memberProfiles.length}명` : "1:1 채팅"}</p>
        </div>
        {currentRoom && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowPanel(showPanel === "members" ? null : "members")} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 11, fontWeight: 700, padding: "5px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "Pretendard,sans-serif" }}>멤버</button>
            <button onClick={() => setShowPanel(showPanel === "invite" ? null : "invite")} style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b", fontSize: 11, fontWeight: 700, padding: "5px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "Pretendard,sans-serif" }}>초대</button>
            <button onClick={() => { if(window.confirm("채팅방을 나가시겠습니까?")) { onLeaveRoom(roomId); onBack(); } }} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 11, fontWeight: 700, padding: "5px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "Pretendard,sans-serif" }}>나가기</button>
          </div>
        )}
      </div>
      {/* 멤버 패널 */}
      {showPanel === "members" && (
        <div style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 200, overflowY: "auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", margin: 0 }}>참여 멤버 {memberProfiles.length}명</p>
          {memberProfiles.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar profile={p} size={28} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{p.name} {p.id === uid ? <span style={{ fontSize: 10, color: "#f59e0b" }}>(나)</span> : ""}</p>
                <p style={{ fontSize: 10, color: "#64748b" }}>{p.org}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* 초대 패널 */}
      {showPanel === "invite" && (
        <div style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", margin: 0 }}>초대할 멤버 선택</p>
          {nonMembers.length === 0 ? <p style={{ fontSize: 12, color: "#4b5563", fontStyle: "italic" }}>초대할 수 있는 멤버가 없어요.</p> :
            nonMembers.map(p => {
              const sel = invitees.includes(p.id);
              return (
                <div key={p.id} onClick={() => setInvitees(prev => sel ? prev.filter(id => id !== p.id) : [...prev, p.id])} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 10, background: sel ? "rgba(245,158,11,0.08)" : "none", cursor: "pointer" }}>
                  <Avatar profile={p} size={28} />
                  <p style={{ fontSize: 12, color: "#f1f5f9", margin: 0, flex: 1 }}>{p.name}</p>
                  <div style={{ width: 16, height: 16, borderRadius: 5, border: `2px solid ${sel ? "#f59e0b" : "rgba(255,255,255,0.2)"}`, background: sel ? "#f59e0b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#020617" }}>{sel ? "✓" : ""}</div>
                </div>
              );
            })
          }
          {invitees.length > 0 && (
            <button onClick={async () => { await onInviteToRoom(roomId, invitees); setInvitees([]); setShowPanel(null); }} style={{ ...S.btnAmber, padding: 10, fontSize: 12, borderRadius: 10 }}>
              {invitees.length}명 초대하기
            </button>
          )}
        </div>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {msgs.length === 0 && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#4b5563", fontSize: 13, fontStyle: "italic" }}>첫 메시지를 보내보세요 👋</div>}
        {msgs.map((m, i) => {
          const mine   = m.senderId === uid;
          const sender = profiles.find(p => p.id === m.senderId) || { name: m.senderName, id: m.senderId };
          const ts     = m.createdAt?.toDate ? m.createdAt.toDate().toISOString() : m.createdAt;
          const showHead = !mine && (i === 0 || msgs[i-1].senderId !== m.senderId);
          return (
            <div key={m.id} style={{ display: "flex", gap: 8, flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-end" }}>
              {!mine && <div style={{ width: 28, flexShrink: 0 }}>{showHead && <Avatar profile={sender} size={28} />}</div>}
              <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 3, alignItems: mine ? "flex-end" : "flex-start" }}>
                {!mine && showHead && <span style={{ fontSize: 10, color: "#64748b", marginLeft: 2 }}>{m.senderName}</span>}
                <div style={{ padding: "10px 14px", borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px", fontSize: 13, background: mine ? "#f59e0b" : "rgba(255,255,255,0.08)", color: mine ? "#020617" : "#f1f5f9", fontWeight: mine ? 600 : 400, border: mine ? "none" : "1px solid rgba(255,255,255,0.1)" }}>{m.text}</div>
                <span style={{ fontSize: 9, color: "#374151", margin: "0 4px" }}>{timeAgo(ts)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div style={S.overlayFooter}>
        <input style={{ ...S.inp, flex: 1 }} placeholder="메시지를 입력하세요..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} />
        <button onClick={send} style={{ ...S.btnAmber, width: 46, height: 46, borderRadius: 14, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>↑</button>
      </div>
    </div>
  );
}

function Meetings({ meetings, profiles, uid, onUpdate, onChat }) {
  const [tab, setTab] = useState("received");
  const received = meetings.filter(m => m.toId   === uid);
  const sent     = meetings.filter(m => m.fromId === uid);
  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
        {[["received","받은 신청"],["sent","보낸 신청"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: 10, borderRadius: 12, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "Pretendard,sans-serif", background: tab === id ? "#f59e0b" : "none", color: tab === id ? "#020617" : "#64748b", transition: "all 0.2s" }}>{label}</button>
        ))}
      </div>
      {tab === "received" && (received.length === 0 ? <div style={{ padding: 36, border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 20, textAlign: "center", color: "#4b5563", fontSize: 12, fontStyle: "italic" }}>아직 받은 신청이 없어요.</div> : received.map(m => {
        const sender = profiles.find(p => p.id === m.fromId) || { name: m.fromName, id: m.fromId };
        return (
          <div key={m.id} style={{ ...S.card, display: "flex", flexDirection: "column", gap: 14, borderRadius: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar profile={sender} size={44} />
                <div><p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{m.fromName} <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b" }}>({m.fromOrg})</span></p><p style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>티미팅 신청이 도착했어요</p></div>
              </div>
              <span style={stBadge(m.status)}>{m.status}</span>
            </div>
            {m.status === "대기중" && <div style={{ display: "flex", gap: 8 }}><button onClick={() => onUpdate(m.id, "수락함")} style={{ ...S.btnAmber, flex: 1, padding: 10 }}>수락</button><button onClick={() => onUpdate(m.id, "거절함")} style={{ ...S.btnGhost, flex: 1, padding: 10 }}>거절</button></div>}
            {m.status === "수락함" && <button onClick={() => onChat(m)} style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", color: "#4ade80", fontWeight: 700, borderRadius: 12, padding: 10, cursor: "pointer", fontFamily: "Pretendard,sans-serif", fontSize: 12, width: "100%" }}>💬 채팅 시작하기</button>}
          </div>
        );
      }))}
      {tab === "sent" && (sent.length === 0 ? <p style={{ textAlign: "center", padding: 20, color: "#4b5563", fontSize: 12, fontStyle: "italic" }}>먼저 동료에게 신청을 보내보세요!</p> : sent.map(m => {
        const receiver = profiles.find(p => p.id === m.toId) || { name: m.toName, id: m.toId };
        return (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, ...S.card, borderRadius: 16 }}>
            <Avatar profile={receiver} size={36} />
            <div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{m.toName}</p><p style={{ fontSize: 10, color: "#64748b" }}>{m.toOrg}</p></div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {m.status === "수락함" && <button onClick={() => onChat(m)} style={{ padding: 6, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>💬</button>}
              <span style={stBadge(m.status)}>{m.status}</span>
            </div>
          </div>
        );
      }))}
    </div>
  );
}

function Community({ posts, profiles, rooms, uid, onOpenPost, onNewPost, onOpenChat, onCreateRoom, onLeaveRoom, onInviteToRoom }) {
  const [tab, setTab]           = useState("board");
  const [showCreate, setCreate] = useState(false);
  const [newRoom, setNewRoom]   = useState({ name: "", invitees: [] });

  // 내가 참여한 방만 필터링 (전체 채팅방 제외, rooms 중 members에 uid 포함)
  const myRooms = rooms.filter(r => (r.members || []).includes(uid));

  const handleCreate = async () => {
    if (!newRoom.name.trim()) return alert("채팅방 이름을 입력해주세요.");
    await onCreateRoom({ name: newRoom.name, members: [uid, ...newRoom.invitees] });
    setNewRoom({ name: "", invitees: [] }); setCreate(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", padding: 4, borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)" }}>
          {[["board","📋 게시판"],["groups","💬 채팅"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: 10, borderRadius: 12, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", fontFamily: "Pretendard,sans-serif", background: tab === id ? "#f59e0b" : "none", color: tab === id ? "#020617" : "#64748b", transition: "all 0.2s" }}>{label}</button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {tab === "board" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><p style={{ fontSize: 12, color: "#64748b", margin: 0 }}><strong style={{ color: "#fff" }}>{posts.length}개</strong>의 게시글</p><button onClick={onNewPost} style={{ ...S.btnAmber, padding: "8px 14px", fontSize: 12, borderRadius: 12 }}>+ 글쓰기</button></div>
            {posts.map(post => {
              const author = profiles.find(p => p.id === post.authorId) || { name: post.authorName, id: post.authorId };
              return (
                <div key={post.id} onClick={() => onOpenPost(post)} style={{ ...S.card, borderRadius: 22, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{post.tag && <span style={S.amberBadge}>{post.tag}</span>}<p style={{ fontSize: 10, color: "#64748b", margin: 0, marginLeft: "auto" }}>{timeAgo(post.createdAt)}</p></div>
                  <div><p style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: 0, marginBottom: 6, lineHeight: 1.4 }}>{post.title}</p><p style={{ fontSize: 13, color: "#94a3b8", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", lineHeight: 1.6 }}>{post.content}</p></div>
                  {post.imageUrl && <img src={post.imageUrl} alt="" style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 14 }} />}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 8 }}>
                    <Avatar profile={author} size={20} /><p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{post.authorName}</p>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "#64748b" }}>💬 {post.commentCount||0}  ❤️ {post.likeCount||0}</span>
                  </div>
                </div>
              );
            })}
          </>
        )}
        {tab === "groups" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={() => onOpenChat("global", "전체 채팅방")} style={{ display: "flex", alignItems: "center", gap: 14, background: "linear-gradient(135deg,rgba(245,158,11,0.1),transparent)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 18, padding: 16, cursor: "pointer", width: "100%", textAlign: "left" }}>
              <div style={{ width: 44, height: 44, background: "rgba(245,158,11,0.15)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🌐</div>
              <div style={{ flex: 1 }}><p style={{ fontSize: 14, fontWeight: 700, color: "#f59e0b", margin: 0 }}>전체 채팅방</p><p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>모든 참여자 {profiles.length}명</p></div>
              <span style={{ color: "#f59e0b", opacity: 0.5 }}>→</span>
            </button>
            {myRooms.length === 0 && (
              <p style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>참여 중인 채팅방이 없어요.<br/>새 채팅방을 만들어보세요!</p>
            )}
            {myRooms.map(room => (
              <button key={room.id} onClick={() => onOpenChat(room.id, room.name)} style={{ display: "flex", alignItems: "center", gap: 14, ...S.card, borderRadius: 18, cursor: "pointer", width: "100%", textAlign: "left" }}>
                <div style={{ width: 44, height: 44, background: "rgba(255,255,255,0.05)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>💬</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>{room.name}</p>
                  <p style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>멤버 {room.members?.length || 0}명</p>
                </div>
                <span style={{ color: "#64748b" }}>→</span>
              </button>
            ))}
            {!showCreate ? (
              <button onClick={() => setCreate(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, border: "2px dashed rgba(255,255,255,0.12)", borderRadius: 18, background: "none", color: "#64748b", cursor: "pointer", fontFamily: "Pretendard,sans-serif", fontSize: 13, fontWeight: 700, width: "100%" }}>+ 채팅방 만들기</button>
            ) : (
              <div style={{ ...S.card, borderRadius: 18, display: "flex", flexDirection: "column", gap: 12, border: "1px solid rgba(245,158,11,0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>새 채팅방</p>
                  <button onClick={() => setCreate(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button>
                </div>
                <div><label style={S.lbl}>채팅방 이름</label><input style={S.inp} placeholder="예: 어바인 육아 모임" value={newRoom.name} onChange={e => setNewRoom(r => ({ ...r, name: e.target.value }))} /></div>
                <div>
                  <label style={S.lbl}>멤버 초대</label>
                  {profiles.filter(p => p.id !== uid).map(p => {
                    const sel = newRoom.invitees.includes(p.id);
                    return (
                      <div key={p.id} onClick={() => setNewRoom(r => ({ ...r, invitees: sel ? r.invitees.filter(id => id !== p.id) : [...r.invitees, p.id] }))} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 12, background: sel ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${sel ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", marginBottom: 6 }}>
                        <Avatar profile={p} size={30} />
                        <p style={{ fontSize: 13, color: "#f1f5f9", margin: 0, flex: 1 }}>{p.name}</p>
                        <div style={{ width: 18, height: 18, borderRadius: 6, border: `2px solid ${sel ? "#f59e0b" : "rgba(255,255,255,0.2)"}`, background: sel ? "#f59e0b" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#020617" }}>{sel ? "✓" : ""}</div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={handleCreate} style={{ ...S.btnAmber, width: "100%", padding: 12 }}>채팅방 개설하기</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PostDetail({ post, profiles, uid, myProfile, onAddComment, onLike, onBack, db }) {
  const [comments, setComments] = useState([]);
  const [input,    setInput]    = useState("");
  const [liked,    setLiked]    = useState(false);

  useEffect(() => {
    const q = query(collection(db, "posts", post.id, "comments"), orderBy("createdAt"));
    return onSnapshot(q, snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [post.id]);

  const doLike    = () => { if (!liked) { setLiked(true); onLike(); } };
  const doComment = async () => { if (!input.trim()) return; await onAddComment(input.trim()); setInput(""); };
  const author    = profiles.find(p => p.id === post.authorId) || { name: post.authorName, id: post.authorId };

  return (
    <div style={S.overlay}>
      <div style={S.overlayHeader}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4 }}>←</button>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{post.title}</p>
        {post.tag && <span style={S.amberBadge}>{post.tag}</span>}
      </div>
      <div style={{ ...S.overlayBody, paddingBottom: 40 }}>
        <p style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 4, lineHeight: 1.4 }}>{post.title}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}><Avatar profile={author} size={28} /><p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{post.authorName}</p><p style={{ fontSize: 10, color: "#4b5563", margin: 0, marginLeft: "auto" }}>{timeAgo(post.createdAt)}</p></div>
        <p style={{ fontSize: 14, color: "#e2e8f0", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 14 }}>{post.content}</p>
        {post.imageUrl && <img src={post.imageUrl} alt="" style={{ width: "100%", borderRadius: 16, maxHeight: 260, objectFit: "cover", marginBottom: 14 }} />}
        <div style={{ display: "flex", gap: 14, paddingTop: 4, marginBottom: 20 }}>
          <button onClick={doLike} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "8px 14px", borderRadius: 12, border: `1px solid ${liked ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.1)"}`, background: liked ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.05)", color: liked ? "#f87171" : "#64748b", cursor: "pointer", fontFamily: "Pretendard,sans-serif" }}>❤️ 공감 {(post.likeCount || 0) + (liked ? 1 : 0)}</button>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4b5563" }}>💬 댓글 {comments.length}개</span>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", margin: 0 }}>댓글 {comments.length}개</p>
          {comments.map(c => {
            const cp = profiles.find(p => p.id === c.authorId) || { name: c.authorName, id: c.authorId };
            const ts = c.createdAt?.toDate ? c.createdAt.toDate().toISOString() : c.createdAt;
            return (
              <div key={c.id} style={{ display: "flex", gap: 10 }}>
                <Avatar profile={cp} size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.05)", padding: "10px 14px", borderRadius: 16 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginBottom: 4 }}>{c.authorName}</p>
                    <p style={{ fontSize: 13, color: "#f1f5f9", margin: 0 }}>{c.text}</p>
                  </div>
                  <p style={{ fontSize: 9, color: "#374151", marginTop: 3, marginLeft: 4 }}>{timeAgo(ts)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={S.overlayFooter}>
        <input style={{ ...S.inp, flex: 1 }} placeholder="댓글을 남겨보세요..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && doComment()} />
        <button onClick={doComment} style={{ ...S.btnAmber, width: 46, height: 46, borderRadius: 14, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>↑</button>
      </div>
    </div>
  );
}

function NewPost({ onSubmit, onBack }) {
  const [form,    setForm]    = useState({ tag: "일상", title: "", content: "", imageUrl: "" });
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();
  const handleImg = e => { const file = e.target.files?.[0]; if (!file) return; const r = new FileReader(); r.onload = ev => { setPreview(ev.target.result); setForm(f => ({ ...f, imageUrl: ev.target.result })); }; r.readAsDataURL(file); };
  const submit = async () => {
    if (!form.title.trim() || !form.content.trim()) return alert("제목과 내용을 입력해주세요.");
    setLoading(true); await onSubmit(form); setLoading(false);
  };
  return (
    <div style={S.overlay}>
      <div style={S.overlayHeader}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 20, padding: 4 }}>✕</button>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", flex: 1, margin: 0 }}>글쓰기</p>
        <button onClick={submit} disabled={loading} style={{ ...S.btnAmber, padding: "8px 14px", fontSize: 12, borderRadius: 10, opacity: loading ? 0.6 : 1 }}>{loading ? "게시 중..." : "게시"}</button>
      </div>
      <div style={{ ...S.overlayBody, paddingBottom: 40 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div><label style={S.lbl}>태그</label><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{POST_TAGS.map(t => <button key={t} onClick={() => setForm(f => ({ ...f, tag: t }))} style={{ padding: "6px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700, border: form.tag === t ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.1)", background: form.tag === t ? "#f59e0b" : "rgba(255,255,255,0.05)", color: form.tag === t ? "#020617" : "#94a3b8", cursor: "pointer", fontFamily: "Pretendard,sans-serif" }}>{t}</button>)}</div></div>
          <div><label style={S.lbl}>제목</label><input style={S.inp} placeholder="제목을 입력하세요" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div><label style={S.lbl}>내용</label><textarea style={{ ...S.inp, minHeight: 160, resize: "none" }} placeholder="내용을 자유롭게 작성하세요..." value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} /></div>
          <div>
            <label style={S.lbl}>사진 첨부 (선택)</label>
            {preview ? <div style={{ position: "relative" }}><img src={preview} alt="" style={{ width: "100%", borderRadius: 14, maxHeight: 200, objectFit: "cover" }} /><button onClick={() => { setPreview(null); setForm(f => ({ ...f, imageUrl: "" })); }} style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, background: "rgba(2,6,23,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff", cursor: "pointer", fontSize: 14 }}>✕</button></div>
              : <label htmlFor="newPostImg" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 32, border: "2px dashed rgba(255,255,255,0.1)", borderRadius: 18, cursor: "pointer", color: "#4b5563", fontSize: 12 }}>🖼️<span>사진을 첨부하려면 여기를 탭하세요</span></label>}
            <input type="file" id="newPostImg" accept="image/*" style={{ display: "none" }} onChange={handleImg} />
          </div>
        </div>
      </div>
    </div>
  );
}

function MissionView({ myMissions, sentCount, uid, onUpdate }) {
  const m1Count  = Math.min(sentCount, 2);
  const m1Done   = m1Count >= 2;
  const m2Photos = myMissions.m2Photos || [];
  const m2Done   = m2Photos.length >= 2;
  const m3Photos = myMissions.m3Photos || [];
  const m3Done   = m3Photos.length >= 1;
  const allDone  = m1Done && m2Done && m3Done;

  const addPhoto = async (key, e) => {
    const file = e.target.files?.[0]; if (!file) return;
    // 업로드 중 표시
    const tempId = Date.now();
    const current = myMissions[key] || [];
    // 로컬 미리보기 먼저 표시
    const reader = new FileReader();
    reader.onload = async ev => {
      const base64 = ev.target.result;
      // Storage에 업로드
      const path = `missions/${uid}/${key}_${tempId}`;
      const url = await uploadPhotoGlobal(base64, path);
      // Firestore에는 URL만 저장 (base64 직접 저장하면 1MB 초과)
      const updated = [...current, { img: url, date: new Date().toISOString() }];
      await onUpdate(key, updated);
    };
    reader.readAsDataURL(file);
  };

  const missions = [
    { id:"m1", num:"01", title:"티미팅 발송", desc:"다른 주재원 동료에게 티미팅을 신청해보세요. (2회)", target:2, current:m1Count, done:m1Done, color:"#f59e0b",
      icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="12" y1="7" x2="12" y2="13"/></svg> },
    { id:"m2", num:"02", title:"티미팅 인증샷", desc:"티미팅을 진행한 후 인증샷을 남겨주세요. (2회)", target:2, current:m2Photos.length, done:m2Done, color:"#38bdf8", photos:m2Photos, photoKey:"m2Photos",
      icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> },
    { id:"m3", num:"03", title:"조별 식사 인증샷", desc:"조원들과 함께 식사 후 인증샷을 남겨주세요.", target:1, current:m3Photos.length, done:m3Done, color:"#4ade80", photos:m3Photos, photoKey:"m3Photos",
      icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  ];

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...S.cardLg, background: "linear-gradient(135deg,rgba(245,158,11,0.12),rgba(56,189,248,0.06))", border: "1px solid rgba(245,158,11,0.2)", textAlign: "center" }}>
        {allDone ? (
          <><div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div><h2 style={{ fontSize: 20, fontWeight: 800, color: "#f59e0b", margin: 0 }}>네트워크 미션 완료!</h2><p style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>모든 미션을 완료하셨습니다. 수고하셨어요!</p></>
        ) : (
          <>
            <div style={{ width: 56, height: 56, background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 18, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", color: "#f59e0b" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>네트워크 미션</h2>
            <p style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>미션을 완료하고 연결을 넓혀보세요</p>
            <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${([m1Done,m2Done,m3Done].filter(Boolean).length / 3) * 100}%`, background: "linear-gradient(90deg,#f59e0b,#fde68a)", borderRadius: 3, transition: "width 0.6s ease" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#f59e0b" }}>{[m1Done,m2Done,m3Done].filter(Boolean).length}/3</span>
            </div>
          </>
        )}
      </div>
      {missions.map(m => (
        <div key={m.id} style={{ ...S.card, borderRadius: 24, border: `1px solid ${m.done ? `${m.color}30` : "rgba(255,255,255,0.07)"}`, background: m.done ? `${m.color}08` : "rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `${m.color}14`, border: `1px solid ${m.color}30`, display: "flex", alignItems: "center", justifyContent: "center", color: m.color, flexShrink: 0 }}>{m.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: m.color, letterSpacing: "0.1em" }}>MISSION {m.num}</span>
                {m.done && <span style={{ background: `${m.color}18`, color: m.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>완료</span>}
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0, marginBottom: 4 }}>{m.title}</p>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>{m.desc}</p>
            </div>
          </div>
          <div style={{ marginBottom: m.photos ? 12 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 10, color: "#64748b" }}>진행 현황</span><span style={{ fontSize: 12, fontWeight: 700, color: m.done ? m.color : "#94a3b8" }}>{m.current} / {m.target}회</span></div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min((m.current/m.target)*100, 100)}%`, background: `linear-gradient(90deg,${m.color},${m.color}aa)`, borderRadius: 3, transition: "width 0.5s" }} />
            </div>
          </div>
          {m.photos !== undefined && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {m.photos.length > 0 && <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>{m.photos.map((p,i) => <img key={i} src={p.img} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: `1px solid ${m.color}40` }} />)}</div>}
              {!m.done && <><label htmlFor={`photo_${m.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "10px", border: `1.5px dashed ${m.color}40`, borderRadius: 14, cursor: "pointer", color: m.color, fontSize: 12, fontWeight: 700 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>인증샷 올리기</label><input type="file" id={`photo_${m.id}`} accept="image/*" style={{ display: "none" }} onChange={e => addPhoto(m.photoKey, e)} /></>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CalView({ meetings, events, uid, onAdd }) {
  const now      = new Date();
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [showForm, setShowForm] = useState(false);
  const [newEv,    setNewEv]    = useState({ title: "", date: "", time: "", note: "" });
  const [adding,   setAdding]   = useState(false);

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11); } else setCalMonth(m => m-1); };
  const nextMonth = () => { if (calYear === 2026 && calMonth === 11) return; if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0); } else setCalMonth(m => m+1); };
  const canPrev = !(calYear === now.getFullYear() && calMonth === now.getMonth());
  const canNext = !(calYear === 2026 && calMonth === 11);

  const accepted  = meetings.filter(m => (m.fromId === uid || m.toId === uid) && m.status === "수락함");
  const todayStr  = now.toISOString().slice(0, 10);
  const firstDay  = new Date(calYear, calMonth, 1).getDay();
  const daysInMon = new Date(calYear, calMonth+1, 0).getDate();
  const dStr      = d => `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const hasEv     = d => d && events.some(e => e.date === dStr(d));
  const todayEvs  = events.filter(e => e.date === todayStr);
  const upcoming  = events.filter(e => e.date > todayStr).slice(0, 8);
  const weeks = []; let d = 1 - firstDay;
  for (let w = 0; w < 6; w++) { const row = []; for (let x = 0; x < 7; x++, d++) row.push(d > 0 && d <= daysInMon ? d : null); weeks.push(row); if (d > daysInMon) break; }

  const doAdd = async () => {
    if (!newEv.title.trim() || !newEv.date) return alert("제목과 날짜를 입력해주세요.");
    setAdding(true); await onAdd({ ...newEv, type: "티미팅" }); setAdding(false);
    setShowForm(false); setNewEv({ title: "", date: "", time: "", note: "" });
  };

  const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...S.card, borderRadius: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <button onClick={prevMonth} disabled={!canPrev} style={{ background: "none", border: "none", color: canPrev ? "#94a3b8" : "#2d3748", cursor: canPrev ? "pointer" : "default", fontSize: 22, padding: "0 4px" }}>‹</button>
          <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", margin: 0 }}>{calYear}년 {MONTHS[calMonth]}</p>
          <button onClick={nextMonth} disabled={!canNext} style={{ background: "none", border: "none", color: canNext ? "#94a3b8" : "#2d3748", cursor: canNext ? "pointer" : "default", fontSize: 22, padding: "0 4px" }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2, marginBottom: 4 }}>
          {["일","월","화","수","목","금","토"].map((l,i) => <div key={l} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, padding: "4px 0", color: i===0?"#f87171":i===6?"#60a5fa":"#64748b" }}>{l}</div>)}
        </div>
        {weeks.map((row, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {row.map((day, di) => {
              const isToday = day === now.getDate() && calYear === now.getFullYear() && calMonth === now.getMonth();
              return (
                <div key={di} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "8px 0", borderRadius: 10, background: isToday ? "#f59e0b" : "none" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: isToday ? "#020617" : day ? (di===0?"#f87171":"#64748b") : "transparent" }}>{day||""}</span>
                  {hasEv(day) && <div style={{ width: 5, height: 5, background: isToday ? "#020617" : "#f59e0b", borderRadius: "50%", marginTop: 2 }} />}
                </div>
              );
            })}
          </div>
        ))}
        <button onClick={() => setShowForm(!showForm)} style={{ ...S.btnAmber, width: "100%", padding: "10px", fontSize: 12, borderRadius: 12, marginTop: 12 }}>+ 일정 추가</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, borderRadius: 22, border: "1px solid rgba(245,158,11,0.25)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>새 일정</p><button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button></div>
          <input style={S.inp} placeholder="일정 제목" value={newEv.title} onChange={e => setNewEv(f => ({ ...f, title: e.target.value }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input type="date" style={S.inp} value={newEv.date} onChange={e => setNewEv(f => ({ ...f, date: e.target.value }))} />
            <input type="time" style={S.inp} value={newEv.time} onChange={e => setNewEv(f => ({ ...f, time: e.target.value }))} />
          </div>
          <input style={S.inp} placeholder="메모 (선택)" value={newEv.note} onChange={e => setNewEv(f => ({ ...f, note: e.target.value }))} />
          <button onClick={doAdd} disabled={adding} style={{ ...S.btnAmber, width: "100%", padding: 12, opacity: adding ? 0.6 : 1 }}>{adding ? "저장 중..." : "저장"}</button>
        </div>
      )}

      {accepted.length > 0 && (
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 10 }}>☕ 수락된 티미팅 <span style={{ color: "#4ade80" }}>{accepted.length}건</span></h4>
          {accepted.map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.12)", borderRadius: 16, padding: "12px 14px", marginBottom: 8 }}>
              <span style={{ color: "#4ade80", fontSize: 16 }}>✓</span>
              <div><p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>티미팅 · {m.fromId === uid ? m.toName : m.fromName}</p><p style={{ fontSize: 10, color: "#64748b" }}>{m.fromId === uid ? m.toOrg : m.fromOrg}</p></div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 10 }}>⏰ 오늘 일정</h4>
        {todayEvs.length === 0 ? <p style={{ fontSize: 12, color: "#4b5563", fontStyle: "italic" }}>오늘 예정된 일정이 없습니다.</p> : todayEvs.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.1)", borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, background: "#f59e0b", borderRadius: "50%", flexShrink: 0 }} />
            <div><p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0 }}>{e.title}</p>{e.time && <p style={{ fontSize: 10, color: "#64748b" }}>{e.time}</p>}{e.note && <p style={{ fontSize: 10, color: "#64748b" }}>{e.note}</p>}</div>
          </div>
        ))}
      </div>

      <div>
        <h4 style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 10 }}>📅 다가오는 일정</h4>
        {upcoming.length === 0 ? <p style={{ fontSize: 12, color: "#4b5563", fontStyle: "italic" }}>예정된 일정이 없습니다.</p> : upcoming.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 14, ...S.card, borderRadius: 16, marginBottom: 8 }}>
            <div style={{ textAlign: "center", width: 42, flexShrink: 0 }}><p style={{ fontSize: 9, color: "#64748b", margin: 0 }}>{e.date?.slice(5,7)}월</p><p style={{ fontSize: 20, fontWeight: 900, color: "#fff", lineHeight: 1, margin: 0 }}>{e.date?.slice(8,10)}</p></div>
            <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 13, fontWeight: 700, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</p>{e.time && <p style={{ fontSize: 10, color: "#64748b" }}>{e.time}</p>}{e.note && <p style={{ fontSize: 10, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note}</p>}</div>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#4ade80", flexShrink: 0 }}>{e.type || "티미팅"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
