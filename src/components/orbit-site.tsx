"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";

const nav = [["소개", "/about"], ["이용 방법", "/how-it-works"], ["팀원으로 합류", "/for-members"], ["FAQ", "/faq"]] as const;
const notice = "ORBIT은 합류 합의까지 지원합니다. 이후 협업과 정산은 당사자 책임입니다.";
const loginlessBuild = process.env.NEXT_PUBLIC_ORBIT_LOGINLESS === "1";
type PublicAuthState = "checking" | "signed-in" | "signed-out";

function usePublicAuth(initialSignedIn?: boolean) {
  const [authState, setAuthState] = useState<PublicAuthState>(() => {
    if (loginlessBuild) return "signed-in";
    if (initialSignedIn === undefined) return "checking";
    return initialSignedIn ? "signed-in" : "signed-out";
  });

  useEffect(() => {
    if (loginlessBuild) return;
    const client = supabase;
    if (!client) {
      const timer = window.setTimeout(() => setAuthState("signed-out"), 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    void client.auth.getUser().then(({ data }) => {
      if (active) setAuthState(data.user ? "signed-in" : "signed-out");
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthState(session?.user ? "signed-in" : "signed-out");
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return authState;
}

function getStartHref(authState: PublicAuthState) {
  if (loginlessBuild) return "/enter";
  return authState === "signed-in" ? "/home" : "/login";
}

function useScrollReveal() {
  useEffect(() => {
    const selector = [
      "main .section .eyebrow",
      "main .section h2",
      "main .section .lead",
      "main .section .card",
      "main .section .product",
      "main .section .market-card",
      "main .section blockquote",
      "main .section .dashed",
      "main .section .steps > div",
      "main .section .orbit-meet",
      "main .subhero > *",
      "main .how > *",
      "main .member-hero .wide > *",
      "main .faq details",
      "main .last > div",
    ].join(",");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -4% 0px" });

    const register = () => {
      document.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        if (element.dataset.revealBound) return;
        element.dataset.revealBound = "true";
        if (reducedMotion || element.getBoundingClientRect().top < window.innerHeight * 0.92) {
          element.classList.add("is-visible");
          return;
        }
        const siblings = element.parentElement ? Array.from(element.parentElement.children) : [];
        element.style.setProperty("--reveal-delay", `${(siblings.indexOf(element) % 4) * 80}ms`);
        element.classList.add("reveal-ready");
        observer.observe(element);
      });
    };

    register();
    const mutations = new MutationObserver(register);
    mutations.observe(document.body, { childList: true, subtree: true });
    return () => {
      mutations.disconnect();
      observer.disconnect();
    };
  }, []);
}

function HeaderContent({ active, member = false, authState }: { active?: string; member?: boolean; authState: PublicAuthState }) {
  useScrollReveal();
  const [signupNotice, setSignupNotice] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutNotice, setLogoutNotice] = useState("");
  useEffect(() => {
    if (!signupNotice) return;
    const timer = window.setTimeout(() => setSignupNotice(false), 3000);
    return () => window.clearTimeout(timer);
  }, [signupNotice]);
  useEffect(() => {
    if (!logoutNotice) return;
    const timer = window.setTimeout(() => setLogoutNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [logoutNotice]);
  const logout = async () => {
    if (!supabase || logoutPending) return;
    setLogoutPending(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setLogoutNotice("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setLogoutPending(false);
      return;
    }
    window.location.assign("/");
  };
  return (
    <>
      <header className="header">
        <div className="nav-shell">
          <Link href="/" className="logo"><Image src="/orbit/orbit-logo-light-2x.png" alt="ORBIT" width={89} height={26} priority /></Link>
          <nav>
            {nav.map(([label, href]) => <Link href={href} className={active === href ? "active" : ""} key={href}>{label}</Link>)}
            {loginlessBuild ? (
              <Link href="/enter" className={`nav-button nav-auth ${member ? "teal" : ""}`}>ORBIT 시작</Link>
            ) : authState === "checking" ? (
              <span className="nav-auth-checking" role="status">로그인 확인 중</span>
            ) : authState === "signed-in" ? (
              <>
                <Link href="/home" className={`nav-button nav-auth ${member ? "teal" : ""}`}>마이페이지</Link>
                <button type="button" className="nav-login nav-auth nav-logout" onClick={() => void logout()} disabled={logoutPending}>{logoutPending ? "로그아웃 중" : "로그아웃"}</button>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-login nav-auth">로그인</Link>
                <button type="button" className={`nav-button nav-auth ${member ? "teal" : ""}`} onClick={() => setSignupNotice(true)}>회원가입</button>
              </>
            )}
          </nav>
        </div>
      </header>
      {signupNotice && <div className="site-toast" role="status">회원가입은 준비 중입니다.</div>}
      {logoutNotice && <div className="site-toast" role="alert">{logoutNotice}</div>}
    </>
  );
}

function Header({ active, member = false }: { active?: string; member?: boolean }) {
  const authState = usePublicAuth();
  return <HeaderContent active={active} member={member} authState={authState} />;
}

function Footer({ compact = false }: { compact?: boolean }) {
  if (compact) return <footer className="compact-footer"><div>{nav.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div><span>© ORBIT · {notice}</span></footer>;
  return <footer className="footer"><div className="footer-grid"><div><Image src="/orbit/orbit-logo-light-2x.png" alt="ORBIT" width={89} height={26} /><p>아이디어를 팀으로 잇습니다.</p></div><div><b>둘러보기</b>{nav.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}</div><div><b>약관</b><Link href="/terms">이용약관</Link><Link href="/privacy">개인정보처리방침</Link></div><div><b>문의</b><a href="mailto:hello@orbit.team">hello@orbit.team</a></div></div><div className="footer-bottom"><span>{notice}</span><span>© ORBIT</span></div></footer>;
}

function Eyebrow({ children, teal = false }: { children: React.ReactNode; teal?: boolean }) { return <div className={`eyebrow${teal ? " teal-text" : ""}`}><i />{children}</div>; }
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <div className={`card ${className}`}>{children}</div>; }
function Dot({ color = "orbit" }: { color?: string }) { return <span className={`dot ${color}`} />; }

function Mock({ type }: { type: "idea" | "match" | "agreement" }) {
  if (type === "idea") return <div className="mock"><small>구체화 결과 · 1/3</small><h4>모임온, 동네 취향을 잇다</h4><small>필요한 역할</small><span className="pill">앱 개발</span><small>작업 요구</small><div className="mock-line">모임 등록·참여 신청 화면</div><div className="mock-line">지역·취향별 빈자리 탐색</div><small>후보 미리보기</small><div className="mock-line split"><b>후보 1 · 앱 개발</b><em>검증됨</em></div><div className="mock-line split"><b>후보 2 · 앱 개발</b><em>검증됨</em></div></div>;
  if (type === "match") return <div className="mock"><small>ORBIT 궁합 결과 · 2/3</small><h4>후보 1 × 모임온</h4>{[["역할", "높음", 82, "#2563EB"], ["도메인", "보통", 52, "#94A3B8"], ["베팅", "높음", 88, "#0E7C86"]].map(([a,b,n,c]) => <div className="score-row" key={a as string}><b>{a}</b><em style={{ color: c as string }}>{b}</em><div><span style={{ width: `${n}%`, background: c as string }} /></div></div>)}<div className="mock-line"><b>강점</b> 지역 커뮤니티 서비스 제작 경험</div><div className="mock-warning"><b>보완점</b> 초기 공급자 확보 경험 부족</div></div>;
  return <div className="mock"><small>합류 합의 · 3/3</small><h4>역할·기여·보상 조건</h4><div className="mock-line split"><span>역할</span><b>앱 개발</b></div><div className="mock-line split"><span>기여</span><b>주 10시간 · 첫 화면 제작</b></div><div className="mock-line split"><span>보상</span><b>성과 배분</b></div><span className="complete"><Dot color="green" />ORBIT 완료 · 합류 합의</span></div>;
}

function HeroSimulation({ startHref }: { startHref: string }) {
  const [stage, setStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const labels = ["한 줄 입력", "ORBIT 중", "팀원 후보", "궁합 공개"];

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setStage((current) => (current + 1) % labels.length), 3000);
    return () => window.clearInterval(timer);
  }, [paused, labels.length]);

  return <section className="hero-simulation" aria-label="ORBIT 제품 데모 흐름"><div className="sim-window-bar"><span><i /><i /><i /></span><b>ORBIT DEMO</b><button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "시뮬레이션 재생" : "시뮬레이션 일시 정지"} title={paused ? "재생" : "일시 정지"}>{paused ? "▶" : "Ⅱ"}</button></div><div className="sim-progress">{labels.map((label, index) => <button type="button" className={index === stage ? "active" : index < stage ? "done" : ""} onClick={() => setStage(index)} key={label}><i /><span>{label}</span></button>)}</div><div className="sim-stage" key={stage}>{stage === 0 && <div className="sim-idea"><small>1/3 · 풀고 싶은 문제</small><h3>한 줄이면 충분해요</h3><div className="sim-input">동네 소모임의 빈자리와 참여자를 연결하는 플랫폼을 만들고 싶다<span /></div><Link href={startHref}>ORBIT 시작</Link></div>}{stage === 1 && <div className="sim-loading"><div className="sim-orbit"><i /></div><b>ORBIT 중…</b><p>역할과 팀원을 찾고 있어요</p><div><i /></div><small>후보 선별 중</small></div>}{stage === 2 && <div className="sim-project"><div><small>구체화 결과 · 1/3</small><h3>모임온, 동네 취향을 잇다</h3><p>필요 역할 <b>앱 개발</b></p><ul><li>모임 등록·참여 신청 화면</li><li>지역·취향별 빈자리 탐색</li></ul></div><aside><small>팀원 후보</small><div><span>준영</span><p><b>박준영</b><small>프론트엔드 · 8년</small></p><em>잠금 ??%</em></div><div className="sim-levels"><i>역할 높음</i><i>도메인 보통</i><i>베팅 높음</i></div><p>복잡한 정보를 쉽게 설계합니다.</p></aside></div>}{stage === 3 && <div className="sim-match"><small>궁합 공개</small><h3>김다솔 × 박준영</h3><div>{[["역할", "88"], ["도메인", "74"], ["베팅", "91"]].map(([label, score], index) => <article key={label}><i className={`score-${index}`} style={{ "--sim-score": `${Number(score) * 3.6}deg` } as React.CSSProperties}><b>{score}<small>%</small></b></i><span>{label}</span></article>)}</div><p><b>강점</b>검증 방식과 성과 배분 의향이 맞아요.</p></div>}</div><div className="sim-caption"><Dot color="green" /><Link href={startHref}>직접 시작하기 →</Link></div></section>;
}

export function HomePage({ initialSignedIn = false }: { initialSignedIn?: boolean }) {
  const [unlocked, setUnlocked] = useState(false);
  const authState = usePublicAuth(initialSignedIn);
  const startHref = getStartHref(authState);
  useEffect(() => { const onScroll = () => { const scoreCards = document.querySelector(".score-cards"); if (scoreCards && scoreCards.getBoundingClientRect().top < innerHeight * .9) setUnlocked(true); }; onScroll(); addEventListener("scroll", onScroll, { passive: true }); return () => removeEventListener("scroll", onScroll); }, []);
  const stats = [["접속 중", "37", "명", "green"], ["진행 프로젝트", "68", "+12", "demand"], ["검증된 팀원", "412", "288명 참여", "supply"], ["합류 성사", "54", "63%", "green"]];
  return <><HeaderContent authState={authState} /><main><section className="hero"><div className="hero-image" /><div className="hero-scrim" /><div className="hero-rings"><span /><span /><span /></div><div className="hero-body"><div className="hero-showcase"><div className="hero-copy"><h1>아이디어를 역할로 바꾸고,<br />함께 만들 팀원을 잇습니다</h1><p>한 줄 아이디어를 역할과 팀원으로 연결합니다.</p><div className="buttons"><Link href={startHref} className="primary">ORBIT 시작</Link>{!loginlessBuild && <Link href="/demo" className="outline">로그인 없이 체험</Link>}</div></div><HeroSimulation startHref={startHref} /></div><div className="stats hero-stats"><div className="wide"><div className="stats-label"><span className="demo-data-label">포트폴리오용 예시 데이터</span><small>실제 가입자·프로젝트·매칭 성과가 아닌 화면 설명용 시나리오입니다.</small></div><div className="stat-grid">{stats.map(([label, value, suffix, color]) => <Card key={label}><small>{label}</small><strong>{value}</strong><em className={color}>{suffix}</em><span className="stat-example-tag">예시 데이터</span></Card>)}</div></div></div></div></section>
  <section className="section space"><div className="wide"><Eyebrow>문제</Eyebrow><h2>아이디어만으로는 막막합니다</h2><div className="two-grid"><Card><div className="ring demand-border"><Dot color="demand" /></div><h3>역할의 벽</h3><p>어떤 역할이 필요한지 알기 어렵습니다.</p></Card><Card><div className="ring supply-border"><Dot color="supply" /></div><h3>팀원의 벽</h3><p>실력과 참여 의향을 함께 보기 어렵습니다.</p></Card></div><div className="orbit-meet"><i /><i /><b /><span>역할과 팀원이 만나는 곳, ORBIT</span></div></div></section>
  <section className="section surface"><div className="wide"><Eyebrow>해결</Eyebrow><h2>세 단계면 팀이 됩니다</h2><div className="steps">{[["1", "시작", "아이디어를 역할과 작업으로 정리합니다."], ["2", "선택", "검증된 후보 중 한 명을 고릅니다."], ["3", "합류", "질문과 합의로 팀을 시작합니다."]].map(([n,t,d]) => <div key={n}><b>{n}</b><h3>{t}</h3><p>{d}</p></div>)}</div></div></section>
  <section className="section space"><div className="wide"><Eyebrow>제품</Eyebrow><h2>아이디어가 팀이 되는 과정</h2><div className="products">{(["idea", "match", "agreement"] as const).map((type, i) => <div className={`product ${type}`} key={type}><Mock type={type} /><p>{["프로젝트와 후보를 함께 봅니다.", "세 축으로 궁합을 봅니다.", "역할과 조건을 합의합니다."][i]}</p></div>)}</div></div></section>
  <section className="section scores"><div className="narrow centered"><Eyebrow>궁합 점수</Eyebrow><h2>점수는 답변 뒤 공개됩니다</h2><p className="lead">먼저 강점과 보완점을 확인하세요.</p><div className="score-cards">{[["역할 · 높음", "88", "demand"], ["도메인 · 보통", "74", "star"], ["베팅 · 높음", "91", "supply"]].map(([label,n,c]) => <Card key={label}><small>{label}</small><strong className={c}>{unlocked ? `${n}%` : "??%"}</strong></Card>)}</div><p>강점과 보완점을 함께 보여줍니다.</p></div></section>
  <section className="section space"><div className="wide"><h2 className="centered">어떻게 시작할까요?</h2><div className="two-grid"><Link className="market-card demand-card" href="/how-it-works"><div className="ring demand-border"><Dot color="demand" /></div><h3>아이디어로 시작</h3><p>아이디어를 역할로 정리합니다.</p><b>이용 방법 보기 →</b></Link><Link className="market-card supply-card" href="/for-members"><div className="ring supply-border"><Dot color="supply" /></div><h3>팀원으로 시작</h3><p>맞는 프로젝트의 초대를 받습니다.</p><b>팀원으로 합류 →</b></Link></div></div></section>
  <section className="section surface"><div className="wide"><Eyebrow>무엇이 다른가</Eyebrow><blockquote>“외주는 정해진 일을 맡기고,<br />ORBIT은 함께 만들 팀원을 찾습니다.”</blockquote><div className="three-grid"><Card><small>외주 마켓</small><p>정해진 일을 비용으로 맡깁니다.</p></Card><Card className="orbit-card"><small>ORBIT</small><p>성과를 나눌 팀원을 찾습니다.</p></Card><Card><small>선택 기준</small><p>목적에 맞는 방식을 고르세요.</p></Card></div></div></section>
  <section className="section space centered"><div className="narrow"><h2>ORBIT이 맞지 않는 분</h2><div className="two-grid text-left"><div className="dashed">만들 방법이 정해졌다면<br /><span>외주가 더 적합합니다.</span></div><div className="dashed">확정 보수가 필요하다면<br /><span>ORBIT과 맞지 않습니다.</span></div></div></div></section>
  <section className="section surface centered responsibility"><div><div className="shield">✓</div><p>ORBIT은 합류 합의까지 지원합니다.<br /><span>이후 협업과 정산은 당사자 책임입니다.</span></p></div></section><section className="last"><div><h2>아이디어를 시작하세요</h2><Link href={startHref} className="primary">ORBIT 시작</Link></div></section></main><Footer /></>;
}

export function AboutPage() { return <><Header active="/about" /><main><section className="subhero wide"><Eyebrow>소개</Eyebrow><h1>왜 ORBIT인가요</h1><p>작은 팀이 필요한 순간, ORBIT이 사람을 잇습니다.</p></section><section className="section surface"><div className="wide"><h2>하는 일과 하지 않는 일</h2><div className="two-grid"><Card className="orbit-card"><small className="orbit">ORBIT이 하는 일</small><ul className="dot-list">{["아이디어를 역할과 작업으로 정리", "검증된 팀원 추천", "질문과 궁합 확인", "합류 합의 지원"].map(x => <li key={x}>{x}</li>)}</ul></Card><div className="dashed"><small>ORBIT이 하지 않는 일</small><ul className="dash-list">{["제작과 운영", "자금 지원", "정산", "지분 등기와 분쟁 조정"].map(x => <li key={x}>{x}</li>)}</ul></div></div></div></section><section className="section space"><div className="wide"><h2>두 사람의 이야기</h2><div className="two-grid"><Card className="demand-card"><small className="demand">아이디어를 낸 사람</small><p className="quote">“한 줄 아이디어가 필요한 역할과 팀원으로 이어졌어요.”</p></Card><Card className="supply-card"><small className="supply">팀원으로 합류한 사람</small><p className="quote">“맞는 프로젝트의 초대를 받고, 질문으로 궁합을 확인했어요.”</p></Card></div></div></section><section className="section surface centered responsibility"><p>ORBIT은 합류 합의까지 지원합니다.<br /><span>이후 협업과 정산은 당사자 책임입니다.</span></p></section></main><Footer compact /></>; }

const steps = [["아이디어 입력", "역할과 작업, 팀원 후보를 보여드립니다."], ["팀원 초대", "후보를 고르고 질문 3개를 보냅니다."], ["합류 합의", "궁합과 조건을 확인하고 합류합니다."]];

export function HowItWorksPage() { const [tab, setTab] = useState<"idea" | "member">("idea"); return <><Header active="/how-it-works" /><main><section className="subhero wide"><Eyebrow>이용 방법</Eyebrow><h1>세 단계로 시작하세요</h1><div className="tabs" role="tablist"><button className={tab === "idea" ? "chosen demand-tab" : ""} onClick={() => setTab("idea")} role="tab" aria-selected={tab === "idea"}><Dot color="demand" />아이디어로 시작</button><button className={tab === "member" ? "chosen supply-tab" : ""} onClick={() => setTab("member")} role="tab" aria-selected={tab === "member"}><Dot color="supply" />팀원으로 시작</button></div></section>{tab === "idea" ? <section className="how wide">{steps.map(([title, body], i) => <Card className="how-step" key={title}><div><div className="progress"><b>{i + 1}/3</b><i><span style={{ width: `${(i + 1) * 33}%` }} /></i></div><h3>{title}</h3><p>{body}</p></div><Mock type={i === 0 ? "idea" : i === 1 ? "match" : "agreement"} /></Card>)}</section> : <section className="how wide"><div className="member-grid">{[["1 · 역할과 관심", "역할과 관심 분야를 등록합니다."], ["2 · 실력 증명", "결과물과 평판을 확인합니다."], ["3 · 베팅 의향", "성과 배분 조건을 정합니다."], ["4 · 필수 동의", "아이디어 보호에 동의합니다."]].map(([a,b]) => <Card key={a}><small className="supply">{a}</small><p>{b}</p></Card>)}</div><div className="invite"><small>초대가 도착합니다</small><div><b>받은 초대</b><span>→</span><b>질문 3개에 답함</b><span>→</span><b>수락 또는 거절</b></div></div></section>}<section className="section surface centered"><div className="narrow"><h2>질문은 어떻게 정하나요?</h2><p className="lead">ORBIT 질문 2개에 직접 질문 1개를 더합니다.<br />답변 후 궁합 점수가 열립니다.</p></div></section></main><Footer compact /></>; }

export function MembersPage() { const authState = usePublicAuth(); const startHref = getStartHref(authState); return <><HeaderContent active="/for-members" member authState={authState} /><main><section className="member-hero"><div className="member-rings" /><div className="wide"><Eyebrow teal>팀원으로 합류하기</Eyebrow><h1>검증된 실력에<br />맞는 프로젝트가 찾아옵니다</h1><p>초대를 받고, 참여를 결정하세요.</p><Link href={startHref} className="primary teal">팀원으로 시작</Link></div></section><section className="section surface"><div className="wide"><h2>합류 방식</h2><div className="four-grid">{[["지분·성과 배분", "성과를 함께 나눕니다."], ["검증된 이력", "협업 기록이 다음 기회가 됩니다."], ["입찰 없는 매칭", "프로필에 맞는 초대를 받습니다."], ["유연한 참여", "시간과 속도를 함께 정합니다."]].map(([a,b]) => <Card key={a}><h3>{a}</h3><p>{b}</p></Card>)}</div><div className="dashed honest"><small>보상 방식</small><p>성과 전에는 보수가 없을 수 있습니다.</p></div></div></section><section className="section space"><div className="wide"><div className="two-grid"><Card className="supply-card"><small className="supply">검증 절차</small><h3>결과물과 평판을 확인합니다.</h3><p>검증된 프로필에 표시가 붙습니다.</p></Card><Card><small>아이디어 보호</small><h3>초대받은 아이디어를 보호합니다.</h3><p>보호 동의 후 합류합니다.</p></Card></div></div></section></main><Footer compact /></>; }

const faqs = [["지분은 어떻게 정하나요?", "역할, 기여, 보상 조건을 당사자가 정합니다. ORBIT은 합의 양식을 제공합니다."], ["ORBIT이 정산에 관여하나요?", notice], ["내 아이디어는 어떻게 보호되나요?", "아이디어 보호 동의 후 초대를 받을 수 있습니다."], ["팀원은 어떻게 검증하나요?", "결과물과 평판을 확인한 프로필에 ‘검증됨’을 표시합니다."], ["점수는 왜 처음엔 가려져 있나요?", "먼저 강점과 보완점을 보여주고, 답변 후 점수를 공개합니다."], ["안 맞으면 어떻게 하나요?", "합의 전에는 거절할 수 있습니다. 합의 후에는 정한 조건을 따릅니다."], ["IT가 아닌 분야도 되나요?", "네. 분야와 관계없이 사용할 수 있습니다."], ["비용이 드나요?", "서비스 이용은 무료입니다."], ["한 번에 여러 역할을 채울 수 있나요?", "가장 필요한 역할 한 명부터 연결합니다."], ["합의 후에는 어디서 대화하나요?", "팀이 선택한 협업 도구에서 이어갑니다."]];

export function FaqPage() { return <><Header active="/faq" /><main><section className="subhero narrow"><Eyebrow>FAQ</Eyebrow><h1>자주 묻는 질문</h1></section><section className="faq narrow">{faqs.map(([q,a], i) => <details key={q} open={i === 0}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</section></main><Footer compact /></>; }
