"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { getCurrentUser, signInWithMagicLink, signOut } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase/client";
import {
  acceptScenarioInvitation,
  createScenarioInvitation,
  loadLatestWorkflow,
  orbitQuestions,
  rejectScenarioInvitation,
  signScenarioAgreement,
} from "@/lib/supabase/orbit-workflow";

type CandidateId = "junyoung" | "seoyeon";
type InviteStatus = "sent" | "opened" | "accepted" | "rejected" | null;
type Notice = { id: number | string; title: string; detail: string; href: string };

type OrbitState = {
  signedIn: boolean;
  projectId: string | null;
  invitationId: string | null;
  matchId: string | null;
  agreementId: string | null;
  side: "demand" | "supply" | null;
  idea: string;
  regenerateCount: number;
  selected: CandidateId | null;
  q3: string;
  inviteStatus: InviteStatus;
  rejectReason: string;
  answers: string[];
  registered: boolean;
  displayName: string;
  sampleInviteAvailable: boolean;
  verification: "not-started" | "pending" | "approved";
  role: string;
  interest: string;
  proof: string;
  proofDescription: string;
  betting: "equity" | "paid" | null;
  agreementDemand: boolean;
  agreementSupply: boolean;
  agreementContribution: string;
  agreementCompensation: string;
  notices: Notice[];
};

const STORAGE_KEY = "orbit-product-v3";
const DEMO_STORAGE_KEY = "orbit-product-v3-demo";
const ProductBasePathContext = createContext("");
const defaultIdea = "동네 소모임의 빈자리와 참여자를 연결하는 플랫폼을 만들고 싶다";
const initialState: OrbitState = {
  signedIn: false,
  projectId: null,
  invitationId: null,
  matchId: null,
  agreementId: null,
  side: null,
  idea: "",
  regenerateCount: 0,
  selected: null,
  q3: "",
  inviteStatus: null,
  rejectReason: "",
  answers: [],
  registered: false,
  displayName: "",
  sampleInviteAvailable: false,
  verification: "not-started",
  role: "",
  interest: "",
  proof: "",
  proofDescription: "",
  betting: null,
  agreementDemand: false,
  agreementSupply: false,
  agreementContribution: "주 10시간 내외 · 8주 내 첫 작동 버전",
  agreementCompensation: "지분 15% · 법인 설립 시 재협의",
  notices: [],
};

const candidates = {
  junyoung: {
    name: "박준영",
    initials: "준영",
    meta: "프론트엔드 개발 · 8년 차",
    axes: ["역할 높음", "도메인 보통", "베팅 높음"],
    weak: "약점 · 로컬 커뮤니티 도메인은 처음",
    why: "복잡한 정보를 쉽게 설계하며, 주 10시간 참여할 수 있어요.",
    scores: [88, 74, 91],
    proof: ["중견 IT기업 재직 · 본업 병행", "검증된 결과물 2건 · 지분·성과 수용"],
  },
  seoyeon: {
    name: "이서연",
    initials: "서연",
    meta: "제품 개발자 · 6년 차",
    axes: ["역할 높음", "도메인 높음", "베팅 보통"],
    weak: "약점 · 주 6시간까지만 가능",
    why: "지역 서비스 출시 경험으로 첫 검증을 빠르게 설계해요.",
    scores: [84, 86, 72],
    proof: ["지역 커뮤니티 서비스 출시 경험", "검증된 결과물 3건 · 주 6시간 가능"],
  },
} as const;

const supplierSampleInvite = {
  title: "케어메이트, 가족 돌봄을 함께 기록하다",
  summary: "가족과 돌봄 제공자가 일정과 특이사항을 공유하는 서비스",
  senderName: "한유진",
  senderInitials: "유진",
  expires: "7일",
} as const;

function normalizeDisplayName(value?: string | null) {
  const name = value?.trim() ?? "";
  return name.includes("@") ? "" : name;
}

function displayInitials(name: string) {
  const compact = name.replace(/\s+/g, "");
  return compact.length > 1 ? compact.slice(-2) : compact || "나";
}

function isSupplierSample(state: OrbitState) {
  return state.side === "supply" && state.sampleInviteAvailable && !state.invitationId;
}

function activeCandidate(state: OrbitState) {
  if (state.side === "supply") {
    const name = normalizeDisplayName(state.displayName) || "등록한 팀원";
    return {
      name,
      initials: displayInitials(name),
      meta: `${state.role || "역할 미등록"}${state.interest ? ` · ${state.interest}` : ""}`,
      axes: ["역할 높음", "도메인 보통", "베팅 높음"],
      weak: "보완점 · 첫 협업에서 역할과 시간을 구체화해야 해요.",
      why: state.proofDescription || "등록한 역할과 결과물을 바탕으로 초대가 연결됐어요.",
      scores: [86, 78, 84] as const,
      proof: [
        state.proofDescription || "등록한 결과물 검증 대기",
        state.interest ? `${state.interest} 관심 · ${state.role || "역할"}` : state.role || "역할 검증 대기",
      ],
    };
  }
  return candidates[state.selected ?? "junyoung"];
}

function supplierSampleQuestions(state: OrbitState) {
  return [
    "돌봄 일정 공유에서 가장 먼저 검증해야 할 핵심 사용자 흐름은 무엇이라고 생각하나요?",
    `${state.role || "등록한 역할"} 담당으로 6주 안에 만들 첫 버전의 범위와 참여 가능한 시간을 알려주세요.`,
  ];
}

const protectedScreens = new Set([
  "enter", "start", "translating", "project", "select", "invite", "register",
  "inbox", "respond", "match", "agreement", "handoff", "home", "home/projects",
  "home/invites", "profile", "notifications",
]);

function prerequisitePath(screen: string, state: OrbitState) {
  if (["translating", "project", "select"].includes(screen) && !state.idea.trim()) return "/start";
  if (screen === "invite" && !state.selected) return state.idea.trim() ? "/select" : "/start";
  if (screen === "respond" && state.inviteStatus === null && !isSupplierSample(state)) return "/inbox";
  if (["match", "agreement"].includes(screen) && state.inviteStatus !== "accepted") return "/inbox";
  if (screen === "handoff" && (!state.agreementDemand || !state.agreementSupply)) return "/agreement";
  return null;
}

function track(event: string, detail = "") {
  if (typeof window === "undefined") return;
  try {
    const saved = JSON.parse(localStorage.getItem("orbit-events") ?? "[]") as unknown;
    const log = Array.isArray(saved) ? saved : [];
    log.push({ event, detail, at: new Date().toISOString() });
    localStorage.setItem("orbit-events", JSON.stringify(log.slice(-100)));
  } catch {
    localStorage.removeItem("orbit-events");
  }
  if (
    window.location.pathname.startsWith("/demo") ||
    process.env.NEXT_PUBLIC_ORBIT_LOGINLESS === "1"
  ) return;
  const client = supabase;
  if (client) {
    void client.auth.getUser().then(({ data }) => {
      void client.from("events").insert({
        event_name: event,
        user_id: data.user?.id ?? null,
        metadata: detail ? { detail } : {},
      });
    });
  }
}

function useOrbitState(storageKey: string) {
  const [state, setState] = useState<OrbitState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let restored = { ...initialState };
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<OrbitState>;
        restored = { ...initialState, ...parsed };
      }
    } catch {
      sessionStorage.removeItem(storageKey);
    }
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setState(restored);
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, [storageKey]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // The product remains usable when browser storage is unavailable.
    }
  }, [hydrated, state, storageKey]);
  return { state, setState, hydrated };
}

function ProductLink({ href, ...props }: React.ComponentProps<typeof Link>) {
  const basePath = useContext(ProductBasePathContext);
  const destination = typeof href === "string" && href.startsWith("/") && href !== "/"
    ? `${basePath}${href}`
    : href;
  return <Link href={destination} {...props} />;
}

function ProductLogo({ className = "", onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <Link href="/" className={`op-logo ${className}`.trim()} aria-label="ORBIT 홈">
      <span className="op-logo-mark">
        <Image
          src={onDark ? "/orbit/orbit-logo-light-2x.png" : "/orbit/orbit-logo-dark-2x.png"}
          alt="ORBIT"
          width={89}
          height={26}
          priority
        />
      </span>
    </Link>
  );
}

function ProductHeader({ context, tone = "demand" }: { context?: string; tone?: "demand" | "supply" | "join" }) {
  return (
    <header className={`op-header ${tone}`}>
      <ProductLogo />
      {context && <span className="op-context">{context}</span>}
      <ProductLink href="/home" className="op-avatar" aria-label="대시보드로 이동">나</ProductLink>
    </header>
  );
}

function Progress({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["뭘 만들지 + 누구와", "후보 확정", "초대"];
  return (
    <div className="op-progress" aria-label={`수요자 여정 ${step}/3`}>
      <strong>{step}/3</strong>
      {[1, 2, 3].map((n) => <i className={n <= step ? "on" : ""} key={n} />)}
      <span>{labels[step - 1]}</span>
    </div>
  );
}

function Button({
  children,
  tone = "navy",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "navy" | "demand" | "supply" | "join" | "ghost" | "soft";
}) {
  return <button className={`op-button ${tone} ${className}`} {...props}>{children}</button>;
}

function CandidateCard({
  id,
  selected,
  onSelect,
  preview = false,
}: {
  id: CandidateId;
  selected?: boolean;
  onSelect?: (id: CandidateId) => void;
  preview?: boolean;
}) {
  const candidate = candidates[id];
  const content = (
    <>
      <div className="op-candidate-head">
        <span className="op-person supply">{candidate.initials}</span>
        <span><b>{candidate.name}</b><small>{candidate.meta}</small></span>
        <span className="op-lock" title="정확한 점수는 초대에 답한 뒤 열려요">잠금 ??%</span>
      </div>
      <div className="op-chip-row">
        {candidate.axes.map((axis, index) => <span className={`op-chip ${index === 1 ? "mid" : "high"}`} key={axis}>{axis}</span>)}
      </div>
      <p className="op-weak">{candidate.weak}</p>
      <p className="op-why"><b>왜 맞는지</b>{candidate.why}</p>
    </>
  );
  if (preview) return <article className="op-candidate">{content}</article>;
  return (
    <button
      type="button"
      className={`op-candidate selectable ${selected ? "selected" : ""}`}
      onClick={() => onSelect?.(id)}
      aria-pressed={selected}
    >
      {content}
    </button>
  );
}

function AuthGate({ nextPath }: { nextPath: string }) {
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;
  return (
    <div className="op-modal-veil" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div className="op-modal">
        <span className="op-kicker">이어서 진행하기</span>
        <h2 id="gate-title">먼저 로그인해 주세요</h2>
        <p>로그인한 뒤 가려던 화면으로 이어집니다.</p>
        <Link href={loginHref} className="op-button full">로그인으로 이동</Link>
        <Link href="/" className="op-text-link">돌아가기</Link>
      </div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [socialNotice, setSocialNotice] = useState("");
  const [emailNotice, setEmailNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const socialLogin = (provider: "Google" | "카카오") => {
    setError("");
    setSocialNotice(`${provider} 로그인은 준비 중입니다. 이메일 인증을 이용해 주세요.`);
  };
  const signupPending = () => {
    setError("");
    setSocialNotice("회원가입은 준비 중입니다.");
  };
  const emailLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return setError("이메일 주소를 입력해 주세요.");
    setLoading(true);
    setError("");
    setSocialNotice("");
    setEmailNotice("");
    const requestedNext = new URLSearchParams(window.location.search).get("next");
    const nextPath = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/enter";
    const { error: authError } = await signInWithMagicLink(email.trim(), `${window.location.origin}${nextPath}`);
    if (authError) { setError(authError.message); setLoading(false); return; }
    setEmailNotice("인증 메일을 보냈습니다. 메일함에서 ORBIT 로그인 링크를 눌러 주세요.");
    setLoading(false);
  };
  return (
    <main className="op-auth-page">
      <ProductLogo className="op-auth-logo" onDark />
      <section className="op-auth-card op-login-card">
        <span className="op-kicker">ORBIT 계정</span>
        <h1>로그인</h1>
        <div className="op-social-grid">
          <Button onClick={() => socialLogin("Google")} disabled={loading} className="full">Google로 계속</Button>
          <Button onClick={() => socialLogin("카카오")} disabled={loading} tone="soft" className="full">카카오로 계속</Button>
        </div>
        {socialNotice && <p role="status" className="op-form-notice">{socialNotice}</p>}
        <div className="op-section-label">이메일 인증으로 로그인</div>
        <form className="op-email-login" onSubmit={(event) => void emailLogin(event)}>
          <div className="op-email-fields"><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></div>
          {error && <p role="alert" className="op-form-error">{error}</p>}
          {emailNotice && <p role="status" className="op-form-notice">{emailNotice}</p>}
          <Button type="submit" disabled={loading} className="full">{loading ? "인증 메일을 보내는 중..." : "인증 메일 받기"}</Button>
        </form>
        <div className="op-legal-links"><button type="button" onClick={signupPending}>회원가입</button></div>
      </section>
    </main>
  );
}

function Signup() {
  return (
    <main className="op-auth-page">
      <ProductLogo className="op-auth-logo" onDark />
      <section className="op-auth-card op-signup-pending">
        <span className="op-kicker">ORBIT 계정</span>
        <h1>회원가입은 준비 중입니다</h1>
        <Link href="/login" className="op-button full">로그인으로 이동</Link>
      </section>
    </main>
  );
}

function Enter({
  state,
  go,
  beginDemand,
  beginSupply,
}: {
  state: OrbitState;
  go: (path: string) => void;
  beginDemand: () => void;
  beginSupply: () => void;
}) {
  const [showSupplier, setShowSupplier] = useState(false);
  return (
    <main className="op-page">
      <ProductHeader context="ORBIT 시작" />
      <div className="op-container op-enter">
        <span className="op-kicker">ORBIT 시작</span>
        <h1>어떻게 시작할까요?</h1>
        <div className="op-branch-grid">
          <button onClick={beginDemand} className="op-branch demand">
            <span className="op-branch-icon">01</span><b>아이디어로 팀 만들기</b>
            <p>아이디어를 역할로 바꾸고 팀원을 찾습니다.</p><strong>팀 만들기 →</strong>
          </button>
          <button onClick={() => { beginSupply(); setShowSupplier(true); }} className="op-branch supply">
            <span className="op-branch-icon">02</span><b>팀원으로 합류하기</b>
            <p>맞는 프로젝트에 합류해 성과를 나눕니다.</p><strong>팀원 등록 ↓</strong>
          </button>
        </div>
        {showSupplier && (
          <section className="op-onboard">
            <div><span className="op-kicker supply">팀원 프로필</span><h2>내 정보로 합류를 시작하세요</h2></div>
            <p>등록 과정에서 이름·역할·관심 분야를 입력합니다. 입력한 이름은 마이페이지와 받은 초대에 그대로 표시됩니다.</p>
            <Button tone="supply" onClick={() => go("/register")}>{state.registered ? "프로필 확인하기 →" : "프로필 등록하기 →"}</Button>
          </section>
        )}
      </div>
    </main>
  );
}

function Start({
  state,
  update,
  go,
}: {
  state: OrbitState;
  update: (patch: Partial<OrbitState>) => void;
  go: (path: string) => void;
}) {
  const valid = state.idea.trim().length >= 10 && state.idea.length <= 200;
  return (
    <main className="op-page">
      <ProductHeader context="ORBIT 시작" />
      <div className="op-container op-narrow">
        <Progress step={1} />
        <span className="op-kicker">아이디어 입력</span>
        <h1>풀고 싶은 문제를 적어주세요</h1>
        <p className="op-lead">평소 말로 적어도 됩니다.</p>
        <textarea
          className="op-idea-input"
          value={state.idea}
          maxLength={200}
          rows={4}
          onChange={(event) => update({ idea: event.target.value })}
          placeholder={'예: "동네 소모임의 빈자리와 참여자를 연결하는 플랫폼을 만들고 싶다"'}
        />
        <div className="op-input-meta">
          <button type="button" onClick={() => update({ idea: defaultIdea })}>문장 채우기</button>
          <span className={!valid && state.idea.length > 0 ? "error" : ""}>{state.idea.length} / 200자 · 최소 10자</span>
        </div>
        <Button
          tone="demand"
          className="op-start-primary"
          disabled={!valid}
          onClick={() => { track("idea_submitted"); go("/translating"); }}
        >ORBIT 시작</Button>
      </div>
    </main>
  );
}

function Translating({ go }: { go: (path: string) => void }) {
  const [progress, setProgress] = useState(8);
  useEffect(() => {
    const timer = window.setInterval(() => setProgress((value) => Math.min(value + 9, 100)), 180);
    const done = window.setTimeout(() => { track("translate_success"); go("/project"); }, 2300);
    return () => { clearInterval(timer); clearTimeout(done); };
  }, [go]);
  const message = progress < 38 ? "계획 정리 중…" : progress < 72 ? "역할 선정 중…" : "후보 선별 중…";
  return (
    <main className="op-loading">
      <div className="op-orbit-spin"><i /></div>
      <b>ORBIT 중…</b>
      <h1>아이디어를 역할로 바꾸고 있어요</h1>
      <p>팀원을 찾고 있어요.</p>
      <div className="op-loading-bar"><i style={{ width: `${progress}%` }} /></div>
      <small>{message}</small>
    </main>
  );
}

function Project({
  state,
  update,
  go,
  toast,
}: {
  state: OrbitState;
  update: (patch: Partial<OrbitState>) => void;
  go: (path: string) => void;
  toast: (message: string) => void;
}) {
  const [view, setView] = useState<"mock" | "plan">("mock");
  const regenerate = () => {
    if (state.regenerateCount >= 3) return toast("오늘 재생성 한도 3회에 닿았어요.");
    update({ regenerateCount: state.regenerateCount + 1 });
    track("regenerate_click", `${state.regenerateCount + 1}`);
    go("/start");
  };
  return (
    <main className="op-page">
      <ProductHeader context="프로젝트" />
      <div className="op-container op-wide">
        <Progress step={1} />
        <aside className="op-gate"><span>방법과 요구사항이 정해졌다면 외주가 더 적합합니다.</span><button onClick={() => { track("gate_exit"); go("/about"); }}>자세히 보기</button></aside>
        <div className="op-project-grid">
          <section>
            <span className="op-kicker">구체화 결과</span>
            <h1>모임온, 동네 취향을 잇다</h1>
            <p className="op-lead">소모임 빈자리 매칭 플랫폼</p>
            <div className="op-segmented" role="tablist">
              <button className={view === "mock" ? "active" : ""} onClick={() => setView("mock")}>목업형</button>
              <button className={view === "plan" ? "active" : ""} onClick={() => setView("plan")}>기획서형</button>
            </div>
            {view === "mock" ? <ProjectMock /> : <ProjectPlan />}
            <div className="op-section-row"><h2>필요 팀원</h2><span className="op-chip role">이번 역할(개발) · 0/1</span></div>
            <div className="op-role-grid">
              <article className="active"><b>개발</b><small>모집중</small></article>
            </div>
            <div className="op-regenerate"><button onClick={regenerate}>↩ 한 줄 다시 쓰기</button><span>재생성 {state.regenerateCount}/3 (오늘)</span></div>
          </section>
          <aside className="op-candidate-panel">
            <div className="op-section-row"><h2>팀원 후보</h2><span>한 명을 선택하세요</span></div>
            <CandidateCard id="junyoung" selected={state.selected === "junyoung"} onSelect={(selected) => { update({ selected }); track("candidate_preview_selected", selected); }} />
            <CandidateCard id="seoyeon" selected={state.selected === "seoyeon"} onSelect={(selected) => { update({ selected }); track("candidate_preview_selected", selected); }} />
            <Button tone="demand" className="full" disabled={!state.selected} onClick={() => { track("translation_accepted", state.selected ?? ""); go("/select"); }}>선택한 팀원 확인</Button>
          </aside>
        </div>
      </div>
    </main>
  );
}

function ProjectMock() {
  return (
    <>
      <section className="op-mock-product" aria-label="모임온 서비스 화면 목업">
        <header className="op-mock-summary">
          <span>아이디어 구체화 결과</span>
          <div>
            <b>동네 모임의 남은 자리와 참여자를 실시간으로 연결</b>
            <p>첫 검증은 성수동에서 시작해 ‘모임 발견 → 상세 확인 → 참여 신청’ 한 흐름에 집중합니다.</p>
          </div>
        </header>
        <div className="op-phone-row">
          <article className="op-phone">
            <div className="op-phone-status"><span>9:41</span><span>● ◔</span></div>
            <div className="op-appbar"><b>모임온</b><span>성수동⌄</span></div>
            <div className="op-mobile-screen">
              <label className="op-mobile-search">⌕ 관심 있는 모임을 찾아보세요</label>
              <div className="op-mobile-chips"><b>전체</b><span>운동</span><span>취미</span><span>스터디</span></div>
              <div className="op-mobile-title"><b>오늘 참여 가능한 모임</b><span>6개 보기</span></div>
              <div className="op-meet-card">
                <div className="op-meet-cover walk"><span>산책</span><em>2자리 남음</em></div>
                <b>서울숲 퇴근길 산책</b>
                <small>오늘 19:30 · 서울숲역 · 4/6명</small>
              </div>
              <div className="op-meet-card compact"><i>☕</i><span><b>성수 카페 신상 탐방</b><small>토 14:00 · 1자리 남음</small></span></div>
            </div>
            <footer><span>⌂<small>홈</small></span><span>⌕<small>탐색</small></span><span>＋<small>모임</small></span><span>○<small>내 활동</small></span></footer>
            <p className="op-screen-caption"><b>01 · 빈자리 탐색</b><span>지역·취향·남은 자리로 빠르게 발견</span></p>
          </article>

          <article className="op-phone">
            <div className="op-phone-status"><span>9:41</span><span>● ◔</span></div>
            <div className="op-detail-cover"><button type="button" aria-label="이전 화면">‹</button><span>서울숲 산책</span><em>모집중</em></div>
            <div className="op-mobile-screen detail">
              <span className="op-mobile-tag">운동 · 가벼운 산책</span>
              <h3>서울숲 퇴근길 산책</h3>
              <p>하루를 가볍게 마무리하고 싶은 동네 이웃과 60분을 걷습니다.</p>
              <dl>
                <div><dt>일시</dt><dd>오늘 19:30</dd></div>
                <div><dt>장소</dt><dd>서울숲역 3번 출구</dd></div>
                <div><dt>인원</dt><dd>4/6명 · 2자리 남음</dd></div>
              </dl>
              <div className="op-capacity"><span><i style={{ width: "67%" }} /></span><small>마감까지 2자리</small></div>
              <div className="op-host"><i>다솔</i><span><b>김다솔 운영자</b><small>동네 모임 12회 운영 · 응답 빠름</small></span></div>
              <button type="button" className="op-mobile-cta">이 모임에 참여 신청</button>
            </div>
            <p className="op-screen-caption"><b>02 · 상세 확인</b><span>일정·장소·신뢰·잔여석을 한 화면에서 판단</span></p>
          </article>

          <article className="op-phone">
            <div className="op-phone-status"><span>9:41</span><span>● ◔</span></div>
            <div className="op-appbar"><b>참여 신청</b><span>1/1</span></div>
            <div className="op-mobile-screen request">
              <div className="op-request-check">✓</div>
              <h3>신청을 보낼 준비가 됐어요</h3>
              <p>운영자가 확인하면 알림으로 알려드릴게요.</p>
              <div className="op-request-card"><i className="walk">산책</i><span><b>서울숲 퇴근길 산책</b><small>오늘 19:30 · 서울숲역</small></span></div>
              <label>운영자에게 한마디<textarea readOnly value="퇴근 후 가볍게 걷고 싶어요. 처음 참여합니다!" /></label>
              <div className="op-request-steps"><span className="done"><i>✓</i>신청 작성</span><span><i>2</i>운영자 확인</span><span><i>3</i>참여 확정</span></div>
              <button type="button" className="op-mobile-cta">참여 신청 보내기</button>
            </div>
            <p className="op-screen-caption"><b>03 · 참여 신청</b><span>한 번의 신청과 상태 알림으로 이탈 최소화</span></p>
          </article>
        </div>
        <div className="op-mock-decisions">
          <article><small>핵심 사용자</small><b>빈자리를 채우려는 운영자<br/>새 활동을 찾는 참여자</b></article>
          <article><small>첫 핵심 행동</small><b>모임 상세 확인 후<br/>참여 신청 1건 전송</b></article>
          <article><small>검증 지표</small><b>상세→신청 전환율<br/>운영자 승인 소요 시간</b></article>
        </div>
      </section>
      <div className="op-mock-mobile-note">모바일 화면은 좌우로 넘겨 확인할 수 있습니다.</div>
      <h2 className="op-small-heading">핵심 기능</h2>
      <div className="op-feature-list">
        <p><b>모임 등록</b><span>일정과 남은 자리 입력</span><em>개발</em></p>
        <p><b>빈자리 탐색</b><span>지역·취향별 모임 확인</span><em>개발 · 디자인</em></p>
        <p><b>참여 신청</b><span>운영자에게 즉시 전달</span><em>운영 자문</em></p>
      </div>
      <h2 className="op-small-heading">수익 구조</h2>
      <p className="op-plan-card">한 동네에서 거래 밀도를 검증한 뒤 성사 수수료로 확장합니다.</p>
    </>
  );
}

function ProjectPlan() {
  return (
    <dl className="op-plan">
      <div><dt>문제</dt><dd>소모임의 빈자리와 참여 수요가 제때 연결되지 않습니다.</dd></div>
      <div><dt>대상</dt><dd>동네 모임 운영자와 새로운 활동을 찾는 참여자</dd></div>
      <div><dt>핵심 흐름</dt><dd>모임 등록 → 지역·취향 탐색 → 참여 신청</dd></div>
      <div><dt>첫 성공</dt><dd>실제 참여 신청 1건이 운영자에게 도착</dd></div>
    </dl>
  );
}

function SelectCandidate({
  state,
  update,
  go,
  toast,
}: {
  state: OrbitState;
  update: (patch: Partial<OrbitState>) => void;
  go: (path: string) => void;
  toast: (message: string) => void;
}) {
  return (
    <main className="op-page">
      <ProductHeader context={state.inviteStatus === "rejected" ? "수요자 · 후보 재선택" : "함께할 팀원"} />
      <div className="op-container">
        {state.inviteStatus === "rejected" && (
          <section className="op-perspective-note" aria-label="수요자 화면 안내">
            <span>수요자 화면</span>
            <p>공급자의 거절 이후, 아이디어를 등록한 수요자가 다른 후보를 선택하는 단계입니다.</p>
          </section>
        )}
        <Progress step={2} />
        {state.inviteStatus === "rejected" && <aside className="op-rejected">공급자가 초대를 거절했어요{state.rejectReason ? ` · ${state.rejectReason}` : ""}. 다른 후보를 선택하세요.</aside>}
        <span className="op-kicker">팀원 선택</span>
        <h1>함께할 팀원을 골라주세요</h1>
        <p className="op-lead">지금은 강점과 보완점으로 판단하세요.</p>
        <div className="op-select-grid">
          <CandidateCard id="junyoung" selected={state.selected === "junyoung"} onSelect={(selected) => update({ selected })} />
          <CandidateCard id="seoyeon" selected={state.selected === "seoyeon"} onSelect={(selected) => update({ selected })} />
        </div>
        <div className="op-actions">
          <Button tone="demand" disabled={!state.selected} onClick={() => { track("candidate_selected", state.selected ?? ""); update({ inviteStatus: null, rejectReason: "" }); go("/invite"); }}>이 팀원으로 진행</Button>
          <Button tone="ghost" onClick={() => { track("reselect_click"); update({ selected: null }); toast("후보 목록으로 돌아왔어요."); go("/project"); }}>다른 후보 다시 보기</Button>
        </div>
      </div>
    </main>
  );
}

function Invite({
  state,
  update,
  send,
}: {
  state: OrbitState;
  update: (patch: Partial<OrbitState>) => void;
  send: () => void;
}) {
  const [q3Open, setQ3Open] = useState(Boolean(state.q3));
  const [confirm, setConfirm] = useState(false);
  const candidate = candidates[state.selected ?? "junyoung"];
  const demographic = /나이|연령|성별|남자|여자|결혼|기혼|미혼|종교|출신|학벌|학력/.test(state.q3);
  return (
    <main className="op-page">
      <ProductHeader context="매칭 3질문" />
      <div className="op-container">
        <Progress step={3} />
        <span className="op-kicker">ORBIT 초대</span>
        <h1>질문을 확인하고 초대하세요</h1>
        <p className="op-lead">{candidate.name} 님에게 질문을 보냅니다.</p>
        <div className="op-invite-grid">
          <section className="op-question-list">
            <Question no="Q1" text={orbitQuestions[0]} auto />
            <Question no="Q2" text={orbitQuestions[1]} auto />
            <button className="op-q3-toggle" onClick={() => setQ3Open((open) => !open)}>{q3Open ? "−" : "+"} 내가 궁금한 질문 1개 더하기 <small>선택</small></button>
            {q3Open && <div className="op-q3"><textarea rows={3} value={state.q3} onChange={(event) => update({ q3: event.target.value })} placeholder="예: 초기 6개월은 검증에 집중해도 괜찮으세요?" />{demographic && <p>역할과 협업에 필요한 질문인지 확인하세요.</p>}</div>}
          </section>
          <aside className="op-invite-summary">
            <span className="op-person supply">{candidate.initials}</span>
            <h2>{candidate.name}</h2><p>{candidate.meta}</p>
            <div className="op-protection"><b>아이디어 보호</b>IP·비밀유지 동의를 마쳤습니다. 상세 프로필은 수락 후 공개됩니다.</div>
            <Button tone="demand" className="full" onClick={() => setConfirm(true)}>초대 보내기</Button>
          </aside>
        </div>
      </div>
      {confirm && <div className="op-modal-veil" role="dialog" aria-modal="true"><div className="op-modal op-confirm"><span className="op-kicker">유효기간 7일</span><h2>초대를 보낼까요?</h2><p>질문 {state.q3 ? "3개" : "2개"}와 프로젝트 요약을 보냅니다.</p><Question no="Q1" text="지역 커뮤니티 서비스의 초기 공급자 확보 경험과 첫 접점" /><Question no="Q2" text="8주 안에 만들 첫 버전의 범위" />{state.q3 && <Question no="Q3" text={state.q3} />}<div className="op-actions"><Button tone="demand" onClick={send}>초대 보내기</Button><Button tone="ghost" onClick={() => setConfirm(false)}>취소</Button></div></div></div>}
    </main>
  );
}

function Question({ no, text, auto = false }: { no: string; text: string; auto?: boolean }) {
  return <article className="op-question"><span>{no}</span><p>{text}</p>{auto && <small>ORBIT 자동 선별</small>}</article>;
}

function Register({
  state,
  update,
  finish,
}: {
  state: OrbitState;
  update: (patch: Partial<OrbitState>) => void;
  finish: () => void;
}) {
  const [step, setStep] = useState(1);
  const [nda, setNda] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  return (
    <main className="op-page supply-bg">
      <ProductHeader context="팀원 등록 · 최초 1회" tone="supply" />
      <div className="op-container op-register">
        <div className="op-wizard">
          {["기본 정보", "실력 증명", "베팅 의향", "필수 동의"].map((label, index) => <span className={step >= index + 1 ? "on" : ""} key={label}><i>{index + 1}</i>{label}</span>)}
        </div>
        {step === 1 && <section className="op-form-stage"><span className="op-kicker supply">1/4</span><h1>이름과 역할을 알려주세요</h1><p className="op-lead">입력한 정보는 마이페이지와 초대 화면에 사용됩니다.</p><label>이름<input value={state.displayName} onChange={(event) => update({ displayName: event.target.value })} placeholder="실명을 입력하세요" autoComplete="name" /></label><label>주 역할<select value={state.role} onChange={(event) => update({ role: event.target.value })}><option value="">역할 선택</option><option>개발 (프론트엔드)</option><option>개발 (백엔드)</option><option>디자인</option><option>기획</option></select></label><label>관심 분야<input value={state.interest} onChange={(event) => update({ interest: event.target.value })} placeholder="예: 돌봄, 커뮤니티, 교육" /></label><Button tone="supply" disabled={!state.displayName.trim() || !state.role || !state.interest.trim()} onClick={() => setStep(2)}>다음</Button></section>}
        {step === 2 && <section className="op-form-stage"><span className="op-kicker supply">2/4</span><h1>결과물을 등록하세요</h1><p className="op-lead">결과물과 평판을 확인합니다.</p><label>포트폴리오 또는 결과물 링크<input type="text" value={state.proof} onChange={(event) => update({ proof: event.target.value })} placeholder="포트폴리오 주소를 입력하세요" /></label><label>한 줄 설명 (선택)<textarea value={state.proofDescription} onChange={(event) => update({ proofDescription: event.target.value })} rows={3} placeholder="맡은 역할과 결과를 적어주세요." /></label><div className="op-actions"><Button tone="ghost" onClick={() => setStep(1)}>이전</Button><Button tone="supply" disabled={!state.proof.trim()} onClick={() => setStep(3)}>다음</Button></div></section>}
        {step === 3 && <section className="op-form-stage"><span className="op-kicker supply">3/4</span><h1>보상 방식을 선택하세요</h1><div className="op-choice-stack"><button className={state.betting === "equity" ? "selected" : ""} onClick={() => { update({ betting: "equity" }); track("betting_intent_set", "equity"); }}><b>지분·성과 배분</b><span>성과를 함께 나눕니다.</span></button><button className={state.betting === "paid" ? "selected" : ""} onClick={() => { update({ betting: "paid" }); track("self_select_exit", "paid"); }}><b>선보수 필요</b><span>외주 플랫폼이 더 적합할 수 있습니다.</span></button></div>{state.betting === "paid" && <p className="op-soft-warning">ORBIT은 성과 배분형 팀원을 위한 서비스입니다. 등록은 계속할 수 있습니다.</p>}<div className="op-actions"><Button tone="ghost" onClick={() => setStep(2)}>이전</Button><Button tone="supply" disabled={!state.betting} onClick={() => setStep(4)}>다음</Button></div></section>}
        {step === 4 && <section className="op-form-stage"><span className="op-kicker supply">4/4</span><h1>필수 항목에 동의하세요</h1><p className="op-lead">직접 동의해야 신청할 수 있습니다.</p><label className="op-check"><input type="checkbox" checked={nda} onChange={(event) => setNda(event.target.checked)} /><span>지적재산권 귀속·비밀유지에 동의합니다<small>아이디어를 외부에 공개하거나 무단 사용하지 않습니다.</small></span></label><label className="op-check"><input type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} /><span>등록 데이터 수집·이용에 동의합니다<small>수락 후 상세 프로필이 공개됩니다.</small></span></label><div className="op-actions"><Button tone="ghost" onClick={() => setStep(3)}>이전</Button><Button tone="supply" disabled={!nda || !privacy} onClick={finish}>ORBIT 검증 신청</Button></div></section>}
      </div>
    </main>
  );
}

function Inbox({ state, go }: { state: OrbitState; go: (path: string) => void }) {
  const sample = isSupplierSample(state);
  const hasInvite = state.inviteStatus !== null || sample;
  const candidate = activeCandidate(state);
  const inviteTitle = sample ? supplierSampleInvite.title : "모임온, 동네 취향을 잇다";
  const inviteSummary = sample ? supplierSampleInvite.summary : "소모임 빈자리 매칭 플랫폼";
  const senderName = sample ? supplierSampleInvite.senderName : "김다솔";
  const senderInitials = sample ? supplierSampleInvite.senderInitials : "다솔";
  const role = sample ? state.role || "서비스 기획" : "개발";
  return (
    <main className="op-page supply-bg">
      <ProductHeader context="받은 ORBIT 초대" tone="supply" />
      <div className="op-container">
        <aside className="op-viewer-notice">
          <span>초대받은 팀원 화면</span>
          <div><b>이 페이지는 프로젝트 초대를 받은 팀원에게 보여집니다.</b><p>받은 초대와 응답 상태는 로그인 후 마이페이지의 ‘합류’에서 다시 확인할 수 있어요.</p></div>
        </aside>
        <div className="op-title-row"><div><span className="op-kicker supply">팀원 합류</span><h1>받은 초대</h1></div><span className={`op-status ${state.verification}`}>{state.verification === "pending" ? "실력 검증 대기" : state.verification === "approved" ? "실력 인증 승인" : "등록 전"}</span></div>
        {!hasInvite ? <section className="op-empty"><span>0</span><h2>도착한 초대가 없어요</h2><p>도착하면 알림에서 확인할 수 있습니다.</p><Button tone="ghost" onClick={() => go("/home/invites")}>합류 현황 보기</Button></section> : <div className="op-inbox-grid"><section className="op-invite-list"><button className="active"><span className="op-person demand">{senderInitials}</span><span><b>{inviteTitle}</b><small>{role} · 보낸 사람 {senderName}</small></span><em>{sample ? "MVP 예시" : inviteStatusLabel(state.inviteStatus)}</em></button></section><aside className="op-preview"><span className="op-kicker supply">{sample ? "MVP 예시 초대" : "초대 내용"}</span><h2>{inviteTitle}</h2><p>{inviteSummary}</p><dl><div><dt>필요 역할</dt><dd>{role}</dd></div><div><dt>받는 팀원</dt><dd>{candidate.name}</dd></div><div><dt>유효기간</dt><dd>{sample ? supplierSampleInvite.expires : "7일"}</dd></div></dl>{sample && <p className="op-sample-note">등록한 프로필로 응답 흐름을 확인할 수 있는 포트폴리오용 예시 초대입니다.</p>}<Button tone="supply" onClick={() => { track("invite_opened", sample ? "sample" : "saved"); go("/respond"); }}>{state.inviteStatus === "sent" || sample ? "초대 열기" : "응답 화면 보기"}</Button></aside></div>}
      </div>
    </main>
  );
}

function inviteStatusLabel(status: InviteStatus) {
  if (status === "accepted") return "수락";
  if (status === "rejected") return "거절";
  if (status === "opened") return "열람";
  return "대기";
}

function Respond({
  state,
  accept,
  reject,
}: {
  state: OrbitState;
  accept: (answers: string[]) => void;
  reject: (reason: string) => void;
}) {
  const [answers, setAnswers] = useState(() => [state.answers[0] ?? "", state.answers[1] ?? "", state.answers[2] ?? ""]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const sample = isSupplierSample(state);
  const questions = sample ? supplierSampleQuestions(state) : [
    orbitQuestions[0],
    orbitQuestions[1],
    state.q3,
  ].filter(Boolean);
  const ready = questions.every((_, index) => answers[index].trim().length >= 2);
  const fill = () => setAnswers(sample ? [
    "가족 초대부터 돌봄 일정 등록, 변경 알림 확인까지의 흐름을 먼저 검증하겠습니다.",
    `첫 버전은 일정 공유와 특이사항 기록에 집중하고, ${state.role || "담당"} 역할로 주 8시간 참여할 수 있습니다.`,
    "",
  ] : [
    "동네 모임 운영자 10명을 직접 만나 초기 공급자와 첫 접점을 만들겠습니다.",
    "모임 등록과 참여 신청만 남기고 추천과 결제는 수동 운영으로 검증하겠습니다.",
    "당장의 보수보다 제 지분이 남는 판인지가 더 중요합니다.",
  ]);
  return (
    <main className="op-page supply-bg">
      <ProductHeader context="초대에 답하기" tone="supply" />
      <div className="op-container">
        <aside className="op-viewer-notice compact"><span>초대받은 팀원 화면</span><p>보낸 사람의 질문에 답한 뒤 합류 여부를 선택하는 단계입니다.</p></aside>
        <span className="op-kicker supply">{sample ? `${supplierSampleInvite.title} · ${state.role || "서비스 기획"}` : "모임온 · 개발"}</span><h1>질문에 답하고 합류를 선택하세요</h1>
        <p className="op-lead">답변 후 최종 궁합이 공개됩니다.</p>
        <div className="op-respond-grid">
          <section className="op-question-list">
            {questions.map((question, index) => <article className="op-answer" key={question}><span>Q{index + 1}</span><p>{question}</p><textarea rows={3} value={answers[index]} onChange={(event) => setAnswers((current) => current.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))} placeholder="답변을 적어주세요" /></article>)}
            <button className="op-text-link" onClick={fill}>답변 채우기</button>
          </section>
          <aside>
            <div className="op-protection"><b>합의 전 확인</b>수락 후 역할·기여·보상을 합의합니다.</div>
            <div className="op-actions"><Button tone="supply" disabled={!ready} onClick={() => accept(answers.slice(0, questions.length))}>수락</Button><Button tone="ghost" onClick={() => setRejectOpen((open) => !open)}>거절</Button></div>
            {!ready && <small className="op-center-note left">받은 질문에 모두 답하면 수락할 수 있어요.</small>}
            {rejectOpen && <div className="op-reject-box"><label>거절 사유 (선택)<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="">선택 안 함</option><option>지분 조건이 불명확해요</option><option>지금은 시간이 부족해요</option><option>아이디어 확신이 부족해요</option><option>기타</option></select></label><Button tone="ghost" onClick={() => reject(reason)}>거절 확정</Button></div>}
          </aside>
        </div>
      </div>
    </main>
  );
}

function Match({ state, go }: { state: OrbitState; go: (path: string) => void }) {
  const candidate = activeCandidate(state);
  const sample = isSupplierSample(state);
  useEffect(() => { track("match_result_view", candidate.scores.join(",")); }, [candidate]);
  return (
    <main className="op-page join-bg">
      <ProductHeader context="ORBIT 궁합" tone="join" />
      <div className="op-container op-match">
        <span className="op-kicker join">최종 궁합</span>
        <h1>궁합 결과</h1>
        <p className="op-lead">{sample ? supplierSampleInvite.senderName : "김다솔"} × {candidate.name} · {sample ? supplierSampleInvite.title : "모임온 프로젝트"}</p>
        <div className="op-score-grid">
          {candidate.scores.map((score, index) => <article key={score}><div className={`op-gauge g${index + 1}`} style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}><span>{score}<small>%</small></span></div><b>{["역할 적합도", "도메인 적합도", "베팅 의향"][index]}</b><small>{["결과물 · 답변 기반", sample ? "돌봄 서비스 관심도" : "로컬 플랫폼 운영 이해", "지분 · 성과 수용"][index]}</small></article>)}
        </div>
        <section className="op-final-why"><h2>궁합 근거</h2><p><b>역할 {candidate.scores[0]}%</b> {sample ? `${state.role || "등록 역할"} 경험과 결과물이 필요 역할에 맞습니다.` : "화면 구현 경험이 맞습니다."} <b>베팅 {candidate.scores[2]}%</b> 성과 배분 의향이 같습니다. <b>도메인 {candidate.scores[1]}%</b> {sample ? "등록한 관심 분야와 답변을 함께 반영했습니다." : "첫 기관 검증으로 경험을 보완합니다."}</p></section>
        <h2 className="op-small-heading">상세 프로필</h2>
        <div className="op-profile-pair">
          <article><div><span className="op-person demand">{sample ? supplierSampleInvite.senderInitials : "다솔"}</span><span><b>{sample ? supplierSampleInvite.senderName : "김다솔"}</b><small>{sample ? "가족 돌봄 서비스 기획 · 수요" : "5년 차 커뮤니티 운영자 · 수요"}</small></span></div><ul>{sample ? <><li>가족 돌봄 일정과 특이사항 공유 문제 정의</li><li>6주 MVP · 역할과 보상 조건 협의 가능</li></> : <><li>지역 소모임 운영과 참여자 모집 경험 5년</li><li>첫 프로젝트 · 검증 우선, 지분 협의 가능</li></>}</ul></article>
          <article><div><span className="op-person supply">{candidate.initials}</span><span><b>{candidate.name}</b><small>{candidate.meta} · 공급</small></span></div><ul>{candidate.proof.map((item) => <li key={item}>{item}</li>)}</ul></article>
        </div>
        <Button tone="join" onClick={() => go("/agreement")}>합류 합의로 진행</Button>
      </div>
    </main>
  );
}

function Agreement({
  state,
  update,
  go,
  sign,
}: {
  state: OrbitState;
  update: (patch: Partial<OrbitState>) => void;
  go: (path: string) => void;
  sign: (side: "demand" | "supply") => void;
}) {
  const both = state.agreementDemand && state.agreementSupply;
  const sample = isSupplierSample(state);
  const supplier = activeCandidate(state);
  const demandName = sample ? supplierSampleInvite.senderName : "김다솔";
  const role = sample ? state.role || "서비스 기획" : "개발 (프론트엔드 리드)";
  return (
    <main className="op-page join-bg">
      <ProductHeader context="ORBIT 완료 · 합류 합의" tone="join" />
      <div className="op-container">
        <span className="op-kicker join">양쪽 동의</span><h1>합류 합의</h1>
        <p className="op-lead">역할·기여·보상을 확인하세요. 계약과 정산은 직접 진행합니다.</p>
        <div className="op-agreement-fields"><label>역할<input value={role} readOnly /></label><label>기여 조건<input value={state.agreementContribution} onChange={(event) => update({ agreementContribution: event.target.value })} /></label><label>보상 · 지분 조건<input value={state.agreementCompensation} onChange={(event) => update({ agreementCompensation: event.target.value })} /></label></div>
        <div className="op-sign-grid">
          <Button tone="join" className={state.agreementDemand ? "signed" : ""} onClick={() => sign("demand")} disabled={state.agreementDemand}>{state.agreementDemand ? `✓ ${demandName} 동의함` : `수요자 동의 · ${demandName}`}</Button>
          <Button tone="join" className={state.agreementSupply ? "signed" : ""} onClick={() => sign("supply")} disabled={state.agreementSupply}>{state.agreementSupply ? `✓ ${supplier.name} 동의함` : `공급자 동의 · ${supplier.name}`}</Button>
        </div>
        {!both && <p className="op-wait-note">상대 동의 대기 · 7일 뒤 만료 · 동의 후 철회 불가</p>}
        {both && <section className="op-complete"><h2>ORBIT 완료</h2><p>{role} 역할의 합류 합의가 완료되었습니다.</p></section>}
        {both && <Button tone="join" onClick={() => go("/handoff")}>협업 채널 연결로 →</Button>}
      </div>
    </main>
  );
}

function Handoff({ go }: { go: (path: string) => void }) {
  return (
    <main className="op-page join-bg">
      <ProductHeader context="협업 시작" tone="join" />
      <div className="op-container op-handoff">
        <div className="op-handoff-mark"><i /><i /><b /></div>
        <span className="op-kicker join">이번 역할 · 1/1</span><h1>팀이 만들어졌어요</h1>
        <p className="op-lead">팀이 선택한 협업 도구에서 이어가세요.</p>
        <aside className="op-boundary"><b>서비스 범위</b><p>ORBIT은 합류 합의까지 지원합니다. 이후 협업과 정산은 당사자 책임입니다.</p></aside>
        <Button tone="join" onClick={() => { track("handoff_click"); go("/home"); }}>대시보드로 이동</Button>
      </div>
    </main>
  );
}

function AppShell({
  screen,
  state,
  go,
  logout,
  demo,
  beginDemand,
  beginSupply,
}: {
  screen: string;
  state: OrbitState;
  go: (path: string) => void;
  logout: () => void;
  demo: boolean;
  beginDemand: () => void;
  beginSupply: () => void;
}) {
  const done = state.agreementDemand && state.agreementSupply;
  const inProgress = state.idea && !done ? 1 : 0;
  const memberName = normalizeDisplayName(state.displayName);
  const waiting = state.inviteStatus === "sent" || state.inviteStatus === "opened" || isSupplierSample(state) ? 1 : 0;
  return (
    <main className="op-shell">
      <aside className="op-sidebar">
        <ProductLogo />
        <nav>
          <ProductLink className={screen === "home" ? "active" : ""} href="/home">대시보드</ProductLink>
          <ProductLink className={screen === "home/projects" ? "active demand" : ""} href="/home/projects">팀 만들기</ProductLink>
          <ProductLink className={screen === "home/invites" ? "active supply" : ""} href="/home/invites">합류</ProductLink>
          <ProductLink className={screen === "profile" ? "active" : ""} href="/profile">프로필 · 인증</ProductLink>
          <ProductLink className={screen === "notifications" ? "active" : ""} href="/notifications">알림{state.notices.length > 0 && <em>{state.notices.length}</em>}</ProductLink>
          <button onClick={logout}>{demo ? "홈으로" : "로그아웃"}</button>
        </nav>
        <div className="op-sidebar-user"><span className="op-avatar">{memberName ? displayInitials(memberName).slice(-1) : "나"}</span><div><b>{memberName || "이름 미등록"}</b><small>{state.side === "supply" ? "ORBIT 팀원" : "ORBIT 멤버"}</small></div></div>
      </aside>
      <section className="op-shell-main">
        {screen === "home" && <Dashboard memberName={memberName} inProgress={inProgress ? 1 : 0} done={done ? 1 : 0} waiting={waiting ? 1 : 0} go={go} />}
        {screen === "home/projects" && <Projects state={state} done={done} go={go} beginDemand={beginDemand} />}
        {screen === "home/invites" && <Invites state={state} go={go} />}
        {screen === "profile" && <Profile state={state} go={go} beginSupply={beginSupply} />}
        {screen === "notifications" && <Notifications state={state} />}
      </section>
    </main>
  );
}

function Dashboard({ memberName, inProgress, done, waiting, go }: { memberName: string; inProgress: number; done: number; waiting: number; go: (path: string) => void }) {
  return <><span className="op-kicker">내 활동</span><h1>{memberName ? `안녕하세요, ${memberName} 님` : "안녕하세요!"}</h1>{!memberName && <p className="op-lead">팀원 등록에서 이름과 역할을 입력하면 내 정보가 여기에 표시됩니다.</p>}<div className="op-summary-grid"><article><strong>{inProgress}</strong><span>진행중</span></article><article><strong>{done}</strong><span>합의 완료</span></article><article><strong>{waiting}</strong><span>대기</span></article></div><h2 className="op-shell-heading">바로 가기</h2><div className="op-shortcuts"><button onClick={() => go("/home/projects")}><b>팀 만들기</b><span>프로젝트와 초대 현황</span><em>→</em></button><button onClick={() => go("/home/invites")}><b>합류</b><span>받은 초대와 응답</span><em>→</em></button></div></>;
}

function Projects({ state, done, go, beginDemand }: { state: OrbitState; done: boolean; go: (path: string) => void; beginDemand: () => void }) {
  return <><span className="op-kicker">프로젝트</span><h1>팀 만들기</h1><p className="op-lead">프로젝트는 한 번에 1개만 진행합니다.</p><h2 className="op-shell-heading">내 프로젝트</h2>{state.idea ? <article className="op-list-row"><span className="op-person demand">모임온</span><div><b>모임온, 동네 취향을 잇다</b><small>{done ? "합의완료" : state.inviteStatus ? "진행중" : "모집중"} · “{state.idea}”</small></div><span className="op-chip role">이번 역할(개발) · {done ? "1/1" : "0/1"}</span><Button tone="ghost" onClick={() => go("/project")}>열기</Button></article> : <EmptyInline text="만든 프로젝트가 없어요." action="한 줄로 시작하기" onClick={beginDemand} />}<h2 className="op-shell-heading">내가 초대한 팀원</h2>{state.inviteStatus ? <article className="op-list-row"><span className="op-person supply">{candidates[state.selected ?? "junyoung"].initials}</span><div><b>{candidates[state.selected ?? "junyoung"].name}</b><small>개발 · 모임온 · 초대 상태</small></div><em className={`op-status ${state.inviteStatus}`}>{inviteStatusLabel(state.inviteStatus)}</em></article> : <EmptyInline text="보낸 초대가 없어요." />}{done && <Button tone="soft" onClick={beginDemand}>+ 다음 아이디어 시작하기</Button>}</>;
}

function Invites({ state, go }: { state: OrbitState; go: (path: string) => void }) {
  const sample = isSupplierSample(state);
  const hasInvite = state.inviteStatus !== null || sample;
  return <><span className="op-kicker supply">초대</span><h1>합류</h1><h2 className="op-shell-heading">받은 ORBIT 초대</h2>{hasInvite ? <article className="op-list-row"><span className="op-person demand">{sample ? supplierSampleInvite.senderInitials : "다솔"}</span><div><b>{sample ? supplierSampleInvite.title : "모임온, 동네 취향을 잇다"}</b><small>{sample ? `${state.role || "서비스 기획"} · 보낸 사람 ${supplierSampleInvite.senderName}` : "개발 · 보낸 사람 김다솔"}</small></div><em className={`op-status ${sample ? "sent" : state.inviteStatus}`}>{sample ? "MVP 예시" : inviteStatusLabel(state.inviteStatus)}</em><Button tone="ghost" onClick={() => go("/inbox")}>수신함</Button></article> : <EmptyInline text="받은 초대가 없어요." />}</>;
}

function Profile({ state, go, beginSupply }: { state: OrbitState; go: (path: string) => void; beginSupply: () => void }) {
  const bettingLabel = state.betting === "paid" ? "선보수 필요" : state.betting === "equity" ? "지분·성과 배분 수용" : "미등록";
  const name = normalizeDisplayName(state.displayName);
  return <><span className="op-kicker supply">팀원 프로필</span><h1>프로필 · 인증</h1><p className="op-lead">수락 후 상세 프로필을 공개합니다.</p><div className="op-profile-layout"><article className="op-profile-card"><div><span className="op-person supply">{displayInitials(name)}</span><span><b>{name || "이름 미등록"}</b><small>{state.role || "역할 미등록"}{state.interest ? ` · ${state.interest}` : ""}</small></span><em className={`op-status ${state.verification}`}>{state.verification === "pending" ? "검증 대기" : state.verification === "approved" ? "인증 승인" : "미신청"}</em></div><h2>베팅 의향</h2><p>{bettingLabel} · 본업 병행</p><h2>프로필 공개 범위</h2><p>간단: 역할·수준·보완점<br />상세: 이름·결과물·이력 (수락 후)</p><Button tone="ghost" onClick={() => { beginSupply(); go("/register"); }}>{state.registered ? "프로필 다시 등록" : "프로필 등록"}</Button></article><aside><article className="op-plan-card"><b>인증 상태</b><p>결과물과 평판을 확인합니다. 반려 시 재신청할 수 있습니다.</p></article></aside></div></>;
}

function Notifications({ state }: { state: OrbitState }) {
  return <><span className="op-kicker">수신함</span><h1>알림</h1><p className="op-lead">초대와 합의 소식을 확인하세요.</p><div className="op-notice-list">{state.notices.length === 0 ? <EmptyInline text="알림이 없어요." /> : state.notices.map((notice) => <ProductLink href={notice.href} key={notice.id}><span>•</span><div><b>{notice.title}</b><small>{notice.detail}</small></div><em>→</em></ProductLink>)}</div></>;
}

function EmptyInline({ text, action, onClick, badge }: { text: string; action?: string; onClick?: () => void; badge?: string }) {
  return <div className="op-empty-inline"><span>{text}</span>{badge && <em>{badge}</em>}{action && <Button tone="soft" onClick={onClick}>{action}</Button>}</div>;
}

function Legal({ type }: { type: "terms" | "privacy" }) {
  const privacy = type === "privacy";
  return <main className="op-legal"><ProductHeader context={privacy ? "개인정보처리방침" : "이용약관"} /><article><span className="op-kicker">ORBIT</span><h1>{privacy ? "개인정보처리방침" : "이용약관"}</h1><p className="op-lead">시행일 2026년 7월 27일</p>{privacy ? <><h2>1. 수집 정보</h2><p>계정, 프로필, 결과물, 보상 의향, 초대·합의 상태를 수집합니다.</p><h2>2. 이용 목적</h2><p>아이디어 구체화, 팀원 추천, 초대, 궁합 산출, 합류 합의에 사용합니다.</p><h2>3. 공개 범위</h2><p>선택 전에는 간단 프로필만 보입니다. 상세 프로필은 수락 후 공개됩니다.</p><h2>4. 문의</h2><p>hello@orbit.team</p></> : <><h2>1. 서비스 범위</h2><p>아이디어 구체화, 팀원 추천, 합류 합의 양식을 제공합니다.</p><h2>2. 책임 범위</h2><p>합류 후 협업·운영·정산·지분·분쟁은 당사자 책임입니다.</p><h2>3. 아이디어 보호</h2><p>팀원은 아이디어의 무단 사용과 외부 공개 금지에 동의해야 합니다.</p><h2>4. 정책 변경</h2><p>변경 시 서비스에서 안내합니다.</p></>}<Link href="/" className="op-text-link">ORBIT 홈으로 돌아가기</Link></article></main>;
}

export function OrbitProduct({
  screen,
  demo = false,
  demoBasePath = "/demo",
}: {
  screen: string;
  demo?: boolean;
  demoBasePath?: string;
}) {
  const router = useRouter();
  const basePath = demo ? demoBasePath : "";
  const { state, setState, hydrated } = useOrbitState(demo ? DEMO_STORAGE_KEY : STORAGE_KEY);
  const [toastMessage, setToastMessage] = useState("");
  const [authChecked, setAuthChecked] = useState(demo);
  const [remoteReady, setRemoteReady] = useState(demo);
  const update = (patch: Partial<OrbitState>) => setState((current) => ({ ...current, ...patch }));
  const go = useMemo(
    () => (path: string) => router.push(path === "/about" ? path : `${basePath}${path}`),
    [basePath, router],
  );
  const beginDemand = () => {
    update({
      side: "demand",
      projectId: null,
      invitationId: null,
      matchId: null,
      agreementId: null,
      idea: "",
      regenerateCount: 0,
      selected: null,
      q3: "",
      inviteStatus: null,
      rejectReason: "",
      answers: [],
      agreementDemand: false,
      agreementSupply: false,
      sampleInviteAvailable: false,
      agreementContribution: initialState.agreementContribution,
      agreementCompensation: initialState.agreementCompensation,
    });
    track("enter_side_selected", "demand");
    go("/start");
  };
  const beginSupply = () => {
    update({
      side: "supply",
      projectId: null,
      invitationId: null,
      matchId: null,
      agreementId: null,
      idea: "",
      selected: null,
      q3: "",
      inviteStatus: null,
      rejectReason: "",
      answers: [],
      sampleInviteAvailable: state.registered,
      agreementDemand: false,
      agreementSupply: false,
    });
    track("enter_side_selected", "supply");
  };
  useEffect(() => {
    if (demo) return;
    const client = supabase;
    if (!client) {
      queueMicrotask(() => {
        setState((current) => ({ ...current, signedIn: false }));
        setAuthChecked(true);
      });
      return;
    }
    let active = true;
    void getCurrentUser().then((user) => {
      if (!active) return;
      setRemoteReady(!user);
      setState((current) => ({ ...current, signedIn: Boolean(user) }));
      setAuthChecked(true);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (!session?.user) setRemoteReady(true);
      else if (event === "INITIAL_SESSION" || event === "SIGNED_IN") setRemoteReady(false);
      setState((current) => ({ ...current, signedIn: Boolean(session?.user) }));
      setAuthChecked(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [demo, setState]);
  useEffect(() => {
    if (demo || !authChecked || !state.signedIn || !["login", "signup"].includes(screen)) return;
    router.replace("/home");
  }, [authChecked, demo, router, screen, state.signedIn]);
  useEffect(() => {
    if (demo || !hydrated) return;
    const client = supabase;
    if (!client || !state.signedIn) {
      queueMicrotask(() => setRemoteReady(true));
      return;
    }
    let active = true;
    void client.auth.getUser().then(async ({ data }) => {
      if (!data.user || !active) {
        if (active) setRemoteReady(true);
        return;
      }
      try {
        const [workflow, profileResult, noticeResult] = await Promise.all([
          loadLatestWorkflow(client, data.user.id),
          client.from("profiles").select("display_name,role,interest,proof_url,proof_summary,betting_intent,verification_status").eq("id", data.user.id).maybeSingle(),
          client.from("notifications").select("id,title,detail,href").eq("user_id", data.user.id).order("created_at", { ascending: false }).limit(20),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (noticeResult.error) throw noticeResult.error;
        if (!active) return;
        const profile = profileResult.data;
        setState((current) => ({
          ...current,
          ...workflow,
          side: current.side ?? (workflow.projectId ? "demand" : profile?.role ? "supply" : null),
          registered: Boolean(profile?.role),
          displayName: normalizeDisplayName(profile?.display_name),
          sampleInviteAvailable: Boolean(profile?.role) && !workflow.invitationId,
          verification: profile?.verification_status ?? "not-started",
          role: profile?.role ?? "",
          interest: profile?.interest ?? "",
          proof: profile?.proof_url ?? "",
          proofDescription: profile?.proof_summary ?? "",
          betting: profile?.betting_intent ?? null,
          notices: noticeResult.data?.map((notice) => ({ ...notice, href: notice.href ?? "/notifications" })) ?? [],
        }));
      } catch (error) {
        if (active) setToastMessage(error instanceof Error ? error.message : "저장된 ORBIT 진행 상태를 불러오지 못했어요.");
      } finally {
        if (active) setRemoteReady(true);
      }
    });
    return () => { active = false; };
  }, [demo, hydrated, setState, state.signedIn]);
  const authenticated = demo || state.signedIn;
  const redirectPath = authenticated ? prerequisitePath(screen, state) : null;
  useEffect(() => {
    if (!hydrated || !authChecked || !remoteReady || !redirectPath) return;
    router.replace(`${basePath}${redirectPath}`);
  }, [authChecked, basePath, hydrated, redirectPath, remoteReady, router]);
  useEffect(() => {
    const client = supabase;
    if (demo || !remoteReady || screen !== "translating" || !client || !state.signedIn || !state.idea.trim() || state.projectId) return;
    void client.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: project, error } = await client.from("projects").insert({
        owner_id: data.user.id,
        idea: state.idea.trim(),
        title: "모임온, 동네 취향을 잇다",
        summary: "소모임 빈자리 매칭 플랫폼",
        status: "draft",
      }).select("id").single();
      if (error) {
        setToastMessage("프로젝트를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      if (project) {
        const { error: roleError } = await client.from("project_roles").insert({ project_id: project.id, role_name: "개발", status: "active", is_mvp: true });
        if (roleError) setToastMessage("프로젝트 역할 정보를 저장하지 못했어요.");
        setState((current) => ({ ...current, projectId: project.id }));
      }
    });
  }, [demo, remoteReady, screen, setState, state.idea, state.projectId, state.signedIn]);
  const toast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 3200);
  };
  const notify = (title: string, detail: string, href: string) => {
    update({ notices: [{ id: Date.now(), title, detail, href }, ...state.notices] });
    const client = supabase;
    if (client && !demo) {
      void client.auth.getUser().then(({ data }) => {
        if (!data.user) return;
        void client.from("notifications").insert({ user_id: data.user.id, title, detail, href });
      });
    }
  };
  const sendInvite = async () => {
    const selected = state.selected;
    if (!selected || (!demo && !state.projectId)) {
      toast("프로젝트와 후보를 다시 확인해 주세요.");
      return;
    }
    if (!demo) {
      const client = supabase;
      if (!client) {
        toast("Supabase 연결을 확인해 주세요.");
        return;
      }
      const { data } = await client.auth.getUser();
      if (!data.user) {
        toast("로그인 세션을 확인해 주세요.");
        return;
      }
      try {
        const invitationId = await createScenarioInvitation(client, {
          projectId: state.projectId!,
          userId: data.user.id,
          candidateKey: selected,
          q3: state.q3,
        });
        update({ invitationId });
      } catch (error) {
        toast(error instanceof Error ? error.message : "초대를 저장하지 못했어요.");
        return;
      }
    }
    update({ inviteStatus: "sent", rejectReason: "", answers: [] });
    track("invite_sent", state.q3 ? "Q3 작성" : "Q3 없음");
    notify("새 ORBIT 초대가 도착했어요", "모임온 · 개발", "/inbox");
    go("/inbox");
  };
  const finishRegister = async () => {
    const displayName = normalizeDisplayName(state.displayName);
    if (!displayName || !state.role || !state.interest.trim() || !state.proof.trim() || !state.betting) {
      toast("필수 입력을 확인해 주세요.");
      return;
    }
    const client = supabase;
    if (client && !demo) {
      const { data } = await client.auth.getUser();
      if (!data.user) {
        toast("로그인 세션을 확인할 수 없어요. 다시 로그인해 주세요.");
        go("/login?next=%2Fregister");
        return;
      }
      const { error } = await client.from("profiles").update({
        display_name: displayName,
        role: state.role,
        interest: state.interest,
        proof_url: state.proof.trim(),
        proof_summary: state.proofDescription.trim(),
        betting_intent: state.betting,
        verification_status: "pending",
      }).eq("id", data.user.id);
      if (error) {
        toast("검증 신청을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
    }
    update({ displayName, registered: true, verification: "pending", sampleInviteAvailable: true, inviteStatus: null });
    track("supplier_register_complete");
    toast("검증 신청 완료 · 운영자 확인 전까지 검증 대기로 표시돼요.");
    go("/home/invites");
  };
  const logout = async () => {
    if (demo) {
      router.push("/");
      return;
    }
    await signOut();
    setState({ ...initialState });
    track("logout");
    go("/");
  };
  const acceptInvite = async (answers: string[]) => {
    const selected = state.selected ?? "junyoung";
    const sample = isSupplierSample(state);
    let matchId = state.matchId;
    if (!demo && !sample) {
      const client = supabase;
      if (!client || !state.invitationId) {
        toast("저장된 초대를 찾을 수 없어요.");
        return;
      }
      const { data } = await client.auth.getUser();
      if (!data.user) {
        toast("로그인 세션을 확인해 주세요.");
        return;
      }
      try {
        matchId = await acceptScenarioInvitation(client, {
          invitationId: state.invitationId,
          userId: data.user.id,
          answers,
          candidate: state.side === "supply" ? activeCandidate(state) : candidates[selected],
        });
      } catch (error) {
        toast(error instanceof Error ? error.message : "답변과 궁합 결과를 저장하지 못했어요.");
        return;
      }
    }
    update({ inviteStatus: "accepted", answers, matchId });
    track("respond_accept");
    notify("초대가 수락됐어요", "궁합 결과가 열렸습니다", "/match");
    go("/match");
  };
  const rejectInvite = async (reason: string) => {
    const sample = isSupplierSample(state);
    if (!demo && !sample) {
      const client = supabase;
      if (!client || !state.invitationId) {
        toast("저장된 초대를 찾을 수 없어요.");
        return;
      }
      try {
        await rejectScenarioInvitation(client, state.invitationId, reason);
      } catch (error) {
        toast(error instanceof Error ? error.message : "거절 상태를 저장하지 못했어요.");
        return;
      }
    }
    if (sample) {
      update({ sampleInviteAvailable: false, inviteStatus: null, rejectReason: reason, answers: [] });
      track("respond_reject", "sample");
      toast("MVP 예시 초대를 거절했어요.");
      go("/home/invites");
      return;
    }
    update({ inviteStatus: "rejected", rejectReason: reason, selected: null });
    track("respond_reject", reason);
    notify("초대가 거절됐어요", "다른 후보를 선택할 수 있습니다", "/select");
    go("/select");
  };
  const signAgreement = async (side: "demand" | "supply") => {
    const sample = isSupplierSample(state);
    if (!demo && !sample && (!state.projectId || !state.invitationId)) {
      toast("저장된 프로젝트와 초대를 찾을 수 없어요.");
      return;
    }
    let agreementId = state.agreementId;
    if (!demo && !sample) {
      const client = supabase;
      if (!client) {
        toast("Supabase 연결을 확인해 주세요.");
        return;
      }
      try {
        const agreement = await signScenarioAgreement(client, {
          projectId: state.projectId!,
          invitationId: state.invitationId!,
          side,
          contribution: state.agreementContribution,
          compensation: state.agreementCompensation,
          demandSigned: state.agreementDemand,
          supplySigned: state.agreementSupply,
        });
        agreementId = agreement.id;
      } catch (error) {
        toast(error instanceof Error ? error.message : "합류 합의를 저장하지 못했어요.");
        return;
      }
    }
    const completes = side === "demand" ? state.agreementSupply : state.agreementDemand;
    update({
      agreementId,
      ...(side === "demand" ? { agreementDemand: true } : { agreementSupply: true }),
    });
    track("agreement_signed", side);
    if (completes) {
      track("agreement_both_signed", "모임온·개발");
      toast("ORBIT 완료 · 합류 합의가 Supabase에 저장됐어요.");
    }
  };

  if (!demo && ["login", "signup"].includes(screen) && authChecked && state.signedIn) {
    return <main className="op-loading"><div className="op-orbit-spin"><i /></div><b>ORBIT</b><p>마이페이지로 이동하고 있어요.</p></main>;
  }
  if (!demo && screen === "login") return <Login />;
  if (!demo && screen === "signup") return <Signup />;
  if (screen === "terms" || screen === "privacy") return <ProductBasePathContext.Provider value={basePath}><Legal type={screen} /></ProductBasePathContext.Provider>;
  if (!demo && protectedScreens.has(screen) && (!hydrated || !authChecked || !remoteReady)) {
    return <main className="op-loading"><div className="op-orbit-spin"><i /></div><b>ORBIT</b><p>로그인 상태를 확인하고 있어요.</p></main>;
  }
  if (!demo && protectedScreens.has(screen) && !authenticated) {
    return <ProductBasePathContext.Provider value={basePath}><main className="op-page"><AuthGate nextPath={`/${screen}`} /></main></ProductBasePathContext.Provider>;
  }
  if (redirectPath) {
    return <main className="op-loading"><div className="op-orbit-spin"><i /></div><b>ORBIT</b><p>이전 단계로 안내하고 있어요.</p></main>;
  }

  let content: React.ReactNode;
  if (screen === "enter") content = <Enter state={state} go={go} beginDemand={beginDemand} beginSupply={beginSupply} />;
  else if (screen === "start") content = <Start state={state} update={update} go={go} />;
  else if (screen === "translating") content = <Translating go={go} />;
  else if (screen === "project") content = <Project state={state} update={update} go={go} toast={toast} />;
  else if (screen === "select") content = <SelectCandidate state={state} update={update} go={go} toast={toast} />;
  else if (screen === "invite") content = <Invite state={state} update={update} send={sendInvite} />;
  else if (screen === "register") content = <Register state={state} update={update} finish={finishRegister} />;
  else if (screen === "inbox") content = <Inbox state={state} go={go} />;
  else if (screen === "respond") content = <Respond state={state} accept={acceptInvite} reject={rejectInvite} />;
  else if (screen === "match") content = <Match state={state} go={go} />;
  else if (screen === "agreement") content = <Agreement state={state} update={update} go={go} sign={signAgreement} />;
  else if (screen === "handoff") content = <Handoff go={go} />;
  else if (["home", "home/projects", "home/invites", "profile", "notifications"].includes(screen)) content = <AppShell screen={screen} state={state} go={go} logout={() => void logout()} demo={demo} beginDemand={beginDemand} beginSupply={beginSupply} />;
  else content = <Enter state={state} go={go} beginDemand={beginDemand} beginSupply={beginSupply} />;

  return (
    <ProductBasePathContext.Provider value={basePath}>
      {content}
      {toastMessage && <div className="op-toast" role="status">{toastMessage}</div>}
    </ProductBasePathContext.Provider>
  );
}
