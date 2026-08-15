/* Land It. Shared UI primitives + store */
const { T:TRICKS, CATS, TIERS_LABEL, STAGES, STICKERS, PLANS, FREE_MAX_DIFF, CREW, PRIVACY, PARKS, CHALLENGES, EVENTS, NOTICES, STANCES, SPORTS, SPORT_IDS } = window.LANDIT;

const STAGE = Object.fromEntries(STAGES.map(s => [s.id, s]));
const LANDED = ["some", "most", "every"];
const trickById = id => TRICKS.find(t => t.id === id);
const catColor = c => CATS[c].color;
/* sport scoping. Pass null/undefined for "everything" */
const tricksFor = sport => sport ? TRICKS.filter(t => t.sport === sport) : TRICKS;
const sportOf = id => (trickById(id) || {}).sport;
const sportsOf = s => (s.sports && s.sports.length ? s.sports : ["scooter"]);
/* Rookie riders see the top two tiers, but can't open or track them */
const trickLocked = (t, s) => s.plan === "rookie" && (t.free === undefined ? t.diff > FREE_MAX_DIFF : !t.free);
const openTricks = s => TRICKS.filter(t => !trickLocked(t, s));

const I = {
  scoot: <g><circle cx="5.5" cy="18.5" r="2.6"/><circle cx="18.5" cy="18.5" r="2.6"/><path d="M5.5 18.5 L13 6 H18.5"/><path d="M9 6 H15"/></g>,
  home: <g><path d="M3 11 L12 3 L21 11"/><path d="M5.5 9.5V21h13V9.5"/></g>,
  search: <g><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L21 21"/></g>,
  grid: <g><rect x="3" y="3" width="7.5" height="7.5"/><rect x="13.5" y="3" width="7.5" height="7.5"/><rect x="3" y="13.5" width="7.5" height="7.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5"/></g>,
  chart: <g><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M2 20h20"/></g>,
  star: <path d="M12 3l2.6 5.6 6.1.8-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.4l6.1-.8z"/>,
  user: <g><circle cx="12" cy="8" r="4"/><path d="M4.5 21c1.2-4.2 4-6 7.5-6s6.3 1.8 7.5 6"/></g>,
  flame: <path d="M12 2.5s5.5 4.6 5.5 10a5.5 5.5 0 1 1-11 0c0-2 1-3.6 2-4.6.3 1.6 1.2 2.4 2 2.4 1.4 0 1.5-2.6 1.5-7.8z"/>,
  lock: <g><rect x="4.5" y="10.5" width="15" height="10"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></g>,
  check: <path d="M4 12.5l5.5 5.5L20 6.5"/>,
  plus: <g><path d="M12 4v16"/><path d="M4 12h16"/></g>,
  play: <path d="M7 4.5l12 7.5-12 7.5z"/>,
  cam: <g><rect x="2.5" y="6.5" width="14" height="11"/><path d="M16.5 11l5-3v8l-5-3z"/></g>,
  map: <g><path d="M3 6.5l6-2.5 6 2.5 6-2.5v14l-6 2.5-6-2.5-6 2.5z"/><path d="M9 4v14M15 6.5v14"/></g>,
  users: <g><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.6 3.4-5.2 6.5-5.2s5.5 1.6 6.5 5.2"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6"/><path d="M18 20c-.4-2-1-3.4-2-4.4"/></g>,
  back: <g><path d="M11 5l-7 7 7 7"/><path d="M4 12h16"/></g>,
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6z"/>,
  print: <g><path d="M7 9V3h10v6"/><rect x="4" y="9" width="16" height="8"/><path d="M7 15h10v6H7z"/></g>,
  crown: <path d="M3 18l1.5-11 4.5 4 3-6 3 6 4.5-4L21 18z"/>,
  coins: <g><ellipse cx="12" cy="6.5" rx="7" ry="2.8"/><path d="M5 6.5v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4"/><path d="M5 10.5v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4"/><path d="M5 14.5v4c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-4"/></g>,
  rail: <g><path d="M3.5 14.5h17"/><path d="M6.5 14.5V20M17.5 14.5V20"/><path d="M8.5 10.5l7-5.5"/></g>,
  rotate: <g><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 3.5v4h-4"/></g>,
  flag: <g><path d="M6 21V4"/><path d="M6 5h13l-2.5 4L19 13H6"/></g>,
  board: <g><path d="M2.5 10.5q9.5 3.2 19 0"/><path d="M7.5 12.4v1.6M16.5 12.4v1.6"/><circle cx="7.5" cy="15.8" r="1.9"/><circle cx="16.5" cy="15.8" r="1.9"/></g>,
  skull: <g><path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.8 1.4 4.6 3 5.8V20h9v-3.7c1.6-1.2 3-3 3-5.8A7.5 7.5 0 0 0 12 3z"/><circle cx="9.2" cy="10.5" r="1.2"/><circle cx="14.8" cy="10.5" r="1.2"/><path d="M12 13.5v2"/></g>
};

function Ico({ name, w = 20, sw = 2.2, fill = "none", style }) {
  return <svg viewBox="0 0 24 24" width={w} height={w} fill={fill} stroke={fill === "none" ? "currentColor" : "none"} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>{I[name]}</svg>;
}

function Diff({ n, sm }) {
  return <div className={"diff" + (sm ? " sm" : "")} title={"Difficulty " + n + " / 5"}>
    {[0,1,2,3,4].map(k => <i key={k} className={k < n ? "on" : ""}/>)}
  </div>;
}

function Slot({ label, h = 100, style }) {
  return <div className="slot" style={{ minHeight: h, ...style }}><span>{label}</span></div>;
}

function Bar({ pct, color = "var(--lime)", h = 16 }) {
  return <div className="bar" style={{ height: h }}><i style={{ width: Math.max(0, Math.min(100, pct)) + "%", background: color }}/></div>;
}

function StickerBadge({ s, earned, just, onClick }) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const ink = "#16140F", fill = `color-mix(in oklab, ${s.hue} 42%, #fff)`;
  return <button onClick={onClick} className={"sticker" + (earned ? "" : " locked") + (just ? " just" : "")} style={{ cursor: onClick ? "pointer" : "default" }}>
    <svg viewBox="0 0 120 120">
      <defs>
        <path id={uid + "t"} d="M29.5 60 a30.5 30.5 0 0 1 61 0" fill="none"/>
        <path id={uid + "b"} d="M24 60 a36 36 0 0 0 72 0" fill="none"/>
      </defs>
      <circle cx="60" cy="60" r="58.5" fill="#fff"/>
      <circle cx="60" cy="60" r="54.5" fill={ink}/>
      <circle cx="60" cy="60" r="48" fill={fill}/>
      <circle cx="60" cy="60" r="44.5" fill="none" stroke={ink} strokeWidth="1.5" strokeDasharray="5 3.6"/>
      <text fontFamily="var(--fd)" fontSize={s.name.length > 11 ? 10.5 : 12.5} letterSpacing="1" fill={ink}>
        <textPath href={"#" + uid + "t"} startOffset="50%" textAnchor="middle">{s.name.toUpperCase()}</textPath>
      </text>
      <g transform={earned ? "translate(40.8,42) scale(1.6)" : "translate(43,36.5) scale(1.42)"} stroke={ink} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">{I[s.ico] || I.star}</g>
      {!earned && <g transform="translate(54.5,71.5) scale(0.46)" stroke={ink} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round">{I.lock}</g>}
      <text fontFamily="var(--fc)" fontWeight="700" fontSize="8.5" letterSpacing="1.8" fill={ink}>
        <textPath href={"#" + uid + "b"} startOffset="50%" textAnchor="middle">{earned ? "EARNED" : "LOCKED"}</textPath>
      </text>
    </svg>
  </button>;
}

const { AVATARS, AV_GROUPS } = window.LANDIT_AVATARS;
const avById = id => AVATARS.find(a => a.id === id);

/* Av. Avatar or fallback initial. `pic` is an avatar id. */
function Av({ pic, name, size = 38, ring = "var(--ink)", rw = 2.5, hue = "var(--pink)", onClick, title }) {
  const a = pic ? avById(pic) : null;
  const box = {
    width: size, height: size, borderRadius: "50%", border: rw + "px solid " + ring,
    background: a ? a.hue : hue, display: "grid", placeItems: "center", flex: "none",
    overflow: "hidden", padding: 0, cursor: onClick ? "pointer" : "default"
  };
  const inner = a
    ? <img src={a.src} alt={a.name} style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}/>
    : <span style={{ fontFamily: "var(--fd)", fontSize: Math.round(size * .44), color: "#fff", lineHeight: 1 }}>{(name || "?").trim()[0]}</span>;
  return onClick
    ? <button onClick={onClick} style={box} title={title}>{inner}</button>
    : <span style={box} title={title}>{inner}</span>;
}

function AvatarPicker({ value, name, onPick, onClose }) {
  const [sel, setSel] = React.useState(avById(value) ? value : null);
  return <Modal onClose={onClose} w={560}>
    <div style={{ padding: 22 }}>
      <div className="eyebrow">Your picture</div>
      <h3 className="d" style={{ fontSize: 28, margin: "7px 0 4px" }}>Pick one</h3>
      <p className="cond" style={{ margin: "0 0 18px", fontSize: 14, color: "var(--ink-3)", letterSpacing: ".03em" }}>Photo upload is coming. These are built in for now.</p>
      {AV_GROUPS.map(g => <div key={g.id} style={{ marginBottom: 18 }}>
        <div className="lab" style={{ marginBottom: 10, color: "var(--ink-3)" }}>{g.id}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(62px,1fr))", gap: 10 }}>
          {AVATARS.filter(a => a.group === g.id).map(a => {
            const on = sel === a.id;
            return <button key={a.id} onClick={() => setSel(a.id)} title={a.name}
              style={{ background: "none", border: "none", padding: 0, display: "grid", placeItems: "center", transform: on ? "scale(1.06)" : "none", transition: ".12s" }}>
              <Av pic={a.id} size={54} rw={on ? 4 : 2.5} ring={on ? "var(--orange)" : "var(--ink)"}/>
            </button>;
          })}
        </div>
      </div>)}
      <div style={{ display: "flex", gap: 10, alignItems: "center", borderTop: "2.5px solid var(--wash)", paddingTop: 16 }}>
        <Av pic={sel} name={name} size={44} rw={3}/>
        <span className="cond" style={{ fontSize: 15 }}>{(sel && avById(sel)) ? avById(sel).name : "Just your initial"}</span>
        <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => { onPick(null); onClose(); }}>Use initial</button>
        <button className="btn sm" onClick={() => { onPick(sel); onClose(); }}>Save</button>
      </div>
    </div>
  </Modal>;
}

function TrickCard({ t, stage, onOpen, bg, locked }) {
  const c = catColor(t.cat), st = locked ? null : (stage ? STAGE[stage] : null);
  return <button className={"tcard" + (locked ? " lockd" : "")} onClick={onOpen} style={{ background: bg || "var(--paper)" }}>
    <span className="fold" style={{ "--c": c }}/>
    {locked && <span className="lockflag"><Ico name="lock" w={12} sw={2.8}/>{TIERS_LABEL[t.diff - 1]}</span>}
    <div className="body">
      <div className="nm">{t.name}</div>
      <div className="meta">
        <span className="tag tilt" style={{ background: c }}>{CATS[t.cat].label}</span>
        <Diff n={t.diff} sm/>
      </div>
      <SportTag sport={t.sport} sm/>
    </div>
    <div className="foot" style={{ background: st ? st.color : locked ? "var(--violet)" : "transparent", color: st || locked ? "#fff" : "var(--ink-3)" }}>
      <span className="dot" style={{ background: st || locked ? "#fff" : "transparent", borderColor: st || locked ? "#fff" : "var(--ink-3)" }}/>
      {locked ? "Shredder plan" : st ? st.label : "Not tracked"}
    </div>
  </button>;
}

function StagePicker({ value, onPick, compact }) {
  return <div className="stages">
    {STAGES.map(s => {
      const on = value === s.id;
      return <button key={s.id} className={"stagebtn" + (on ? " on" : "")} onClick={() => onPick(on ? null : s.id)}
        style={on ? { background: s.color, borderColor: "var(--ink)" } : null}>
        <span className="ring" style={on ? { background: "#fff" } : null}/>
        {compact ? s.short : s.label}
      </button>;
    })}
  </div>;
}

/* One or the other, when a rider does both */
function SportTabs({ s, view, setView, extra }) {
  const sports = sportsOf(s);
  if (sports.length < 2) return null;
  return <div className="sporttabs">
    {sports.map(id => {
      const sp = SPORTS[id], on = view === id;
      return <button key={id} className={"sporttab" + (on ? " on" : "")} onClick={() => setView(id)}
        style={on ? { background: sp.color, borderColor: "var(--ink)", color: "#fff" } : null}>
        <Ico name={sp.icon} w={17} sw={2.3}/>{sp.label}
        {extra && <span className="n">{extra(id)}</span>}
      </button>;
    })}
  </div>;
}

/* Small "what it's for" badge */
function SportTag({ sport, sm }) {
  const sp = SPORTS[sport];
  return <span className="sportchip" style={{ borderColor: sp.color, color: sp.color, fontSize: sm ? 10 : 11 }}>
    <Ico name={sp.icon} w={sm ? 12 : 13} sw={2.4}/>{sp.short}
  </span>;
}

/* Share card. Screenshot fodder, not a real export. */
function ShareCard({ kind, trick, sticker, s, stats, onClose, toast }) {
  const isTrick = kind === "trick";
  const hue = isTrick ? catColor(trick.cat) : sticker.hue;
  const line = isTrick
    ? "Landed the " + trick.name
    : "Earned " + sticker.name;
  const caption = isTrick
    ? "Landed the " + trick.name + " on " + SPORTS[trick.sport].label.toLowerCase() + ". " + (stats ? stats.global.landed + " tricks down." : "") + " Tracked on Land It."
    : sticker.name + " sticker earned on Land It. " + stickerCond(sticker) + ".";
  return <Modal onClose={onClose} w={420}>
    <div style={{ padding: 20 }}>
      <div className="eyebrow">Share it</div>
      <div style={{ background: "var(--ink)", border: "3px solid var(--ink)", marginTop: 12, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{ width: 26, height: 26, background: "var(--yellow)", border: "2px solid var(--paper)", display: "grid", placeItems: "center", transform: "rotate(-5deg)", flex: "none" }}><Ico name="scoot" w={16} sw={2.4} style={{ color: "var(--ink)" }}/></span>
          <span className="d" style={{ fontSize: 17, color: "var(--paper)" }}>Land<span style={{ color: "var(--yellow)" }}>It</span></span>
          <span className="lab" style={{ marginLeft: "auto", color: "#8d8679" }}>{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
        </div>
        <div style={{ background: hue, border: "3px solid var(--paper)", padding: "20px 18px", display: "flex", flexDirection: "column", gap: 12, alignItems: isTrick ? "flex-start" : "center" }}>
          {isTrick ? <>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <span className="tag" style={{ background: "var(--ink)" }}>{CATS[trick.cat].label}</span>
              <span className="tag" style={{ background: "var(--paper)", color: "var(--ink)" }}>{SPORTS[trick.sport].label}</span>
            </div>
            <div className="d" style={{ fontSize: 38, color: "#fff", textShadow: "3px 3px 0 var(--ink)", lineHeight: .92 }}>{trick.name}</div>
            <Diff n={trick.diff}/>
          </> : <div style={{ width: 130 }}><StickerBadge s={sticker} earned/></div>}
        </div>
        <div>
          <div className="d" style={{ fontSize: 22, color: "var(--paper)" }}>{line}</div>
          <div className="lab" style={{ color: "#C9C2B4", marginTop: 6 }}>{s.name} · {stats ? stats.global.landed + " tricks landed" : ""} · {s.streak} day streak</div>
        </div>
      </div>
      <p className="cond" style={{ margin: "14px 0 12px", fontSize: 13.5, color: "var(--ink-2)", letterSpacing: ".03em" }}>{caption}</p>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <button className="btn sm" onClick={() => {
          try { navigator.clipboard.writeText(caption); } catch (e) {}
          toast && toast("Caption copied", "var(--sky)");
        }}>Copy caption</button>
        <button className="btn sm ghost" onClick={onClose} style={{ marginLeft: "auto" }}>Close</button>
      </div>
    </div>
  </Modal>;
}

function Modal({ children, onClose, w = 520 }) {
  React.useEffect(() => {
    const k = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return <div className="scrim" onClick={onClose}>
    <div className="modal" style={{ width: "min(" + w + "px,100%)" }} onClick={e => e.stopPropagation()}>{children}</div>
  </div>;
}

function SecHead({ children, more, onMore }) {
  return <div className="sechead">
    <h2>{children}</h2>
    <span className="rule"/>
    {more && <button className="more" onClick={onMore}>{more}</button>}
  </div>;
}

function Empty({ icon, title, sub, cta, onCta }) {
  return <div className="panel flat" style={{ padding: "38px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
    <div style={{ width: 52, height: 52, border: "3px solid var(--ink)", background: "var(--yellow)", display: "grid", placeItems: "center", transform: "rotate(-5deg)" }}>
      <Ico name={icon} w={26} sw={2.4}/>
    </div>
    <div className="d" style={{ fontSize: 22 }}>{title}</div>
    <p style={{ margin: 0, maxWidth: 380, color: "var(--ink-2)", fontSize: 14.5, lineHeight: 1.5 }}>{sub}</p>
    {cta && <button className="btn" onClick={onCta} style={{ marginTop: 4 }}>{cta}</button>}
  </div>;
}

/* ---------- store ---------- */
const BLANK = {
  signedIn: false, name: "", handle: "", plan: "rookie", onboarded: false, avatar: null,
  goal: null, goalCustom: "", level: null, stance: null, byId: {}, log: [], clips: [], streak: 0, days: 0,
  sports: ["scooter"], view: "scooter", seenNotices: [], eventsGoing: [], privacy: "members",
  crew: false, challengeLogged: {}, stickers: [], notes: {}, lastRide: null, submittedSpots: []
};

function loadState() {
  try {
    const raw = localStorage.getItem("landit.v2");
    if (raw) return migrate({ ...BLANK, ...JSON.parse(raw) });
  } catch (e) {}
  return { ...BLANK };
}

/* v1 saves knew nothing about sports */
function migrate(s) {
  if (!Array.isArray(s.sports) || !s.sports.length) s.sports = ["scooter"];
  s.sports = s.sports.filter(x => SPORT_IDS.includes(x));
  if (!s.sports.length) s.sports = ["scooter"];
  if (!s.sports.includes(s.view)) s.view = s.sports[0];
  if (typeof s.challengeLogged === "number") s.challengeLogged = { scooter: s.challengeLogged };
  if (!s.challengeLogged || typeof s.challengeLogged !== "object") s.challengeLogged = {};
  SPORT_IDS.forEach(sp => {
    if (s.challengeLogged[sp] === undefined) return;
    const live = liveChallenge(sp);
    if (live) s.challengeLogged[live.id] = Math.max(s.challengeLogged[live.id] || 0, s.challengeLogged[sp]);
    delete s.challengeLogged[sp];
  });
  if (!Array.isArray(s.seenNotices)) s.seenNotices = [];
  if (!Array.isArray(s.eventsGoing)) s.eventsGoing = [];
  if (!PRIVACY.some(p => p.id === s.privacy)) s.privacy = "members";
  if (!Array.isArray(s.log)) s.log = [];
  /* Riders tracked before dates existed. Spread them back so the chart has something honest to show. */
  const dated = new Set(s.log.map(e => e.id));
  const undated = Object.keys(s.byId).filter(id => !dated.has(id));
  if (undated.length) {
    const now = Date.now(), span = 150 * 864e5;
    undated.forEach((id, i) => s.log.push({ id, stage: s.byId[id], at: now - span + Math.round(span * (i + 1) / (undated.length + 1)), est: true }));
    s.log.sort((a, b) => a.at - b.at);
  }
  return s;
}

/* every stage change, newest last */
function logStage(log, id, stage) {
  return [...(log || []), { id, stage, at: Date.now() }];
}
/* when each trick first counted as landed */
function firstLanded(s) {
  const out = {};
  (s.log || []).forEach(e => { if (LANDED.includes(e.stage) && !out[e.id]) out[e.id] = e; });
  return out;
}
/* landed-per-month for the last n months, oldest first */
function landedByMonth(s, sport, n = 6) {
  const first = firstLanded(s);
  const now = new Date(), months = [];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: dt.getFullYear() + "-" + dt.getMonth(), label: dt.toLocaleDateString("en-GB", { month: "short" }), n: 0, est: 0 });
  }
  Object.values(first).forEach(e => {
    const t = trickById(e.id);
    if (!t || (sport && t.sport !== sport)) return;
    const dt = new Date(e.at), key = dt.getFullYear() + "-" + dt.getMonth();
    const m = months.find(x => x.key === key);
    if (m) { m.n++; if (e.est) m.est++; }
  });
  return months;
}
/* Challenge scheduling. A challenge is live between its start and end date. */
const chalById = id => CHALLENGES.find(c => c.id === id);
function chalState(c) {
  const now = Date.now();
  const from = Date.parse(c.starts + "T00:00:00"), to = Date.parse(c.ends + "T23:59:59");
  return now < from ? "upcoming" : now > to ? "past" : "live";
}
const challengesFor = sport => CHALLENGES.filter(c => c.sport === sport).slice()
  .sort((a, b) => Date.parse(a.starts) - Date.parse(b.starts));
const liveChallenge = sport => {
  const mine = challengesFor(sport);
  return mine.find(c => chalState(c) === "live") || mine.find(c => chalState(c) === "upcoming") || mine[mine.length - 1] || null;
};
const chalRange = c => {
  const f = new Date(c.starts + "T00:00:00"), t = new Date(c.ends + "T00:00:00");
  const fmt = (dt, withMonth) => dt.getDate() + (withMonth ? " " + dt.toLocaleDateString("en-GB", { month: "short" }) : "");
  return fmt(f, f.getMonth() !== t.getMonth()) + " to " + fmt(t, true);
};

/* Accepts "53.4084, -2.9916" or a pasted Google Maps URL */
function parseCoords(text) {
  if (!text) return null;
  const m = String(text).match(/(-?\d{1,3}\.\d{3,})[, /@]+(-?\d{1,3}\.\d{3,})/);
  if (!m) return null;
  const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
const hasCoords = p => typeof p.lat === "number" && typeof p.lng === "number";
const mapEmbed = (p, z = 15) => "https://maps.google.com/maps?q=" + p.lat + "," + p.lng + "&z=" + z + "&output=embed";
const mapLink = p => "https://www.google.com/maps/search/?api=1&query=" + p.lat + "," + p.lng;

const shortDate = ts => new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function core(s, sport) {
  const byId = s.byId || {};
  const pool = tricksFor(sport);
  const inScope = id => { const t = trickById(id); return !!t && (!sport || t.sport === sport); };
  const tracked = Object.keys(byId).filter(inScope);
  const landedIds = tracked.filter(id => LANDED.includes(byId[id]));
  const catCount = {}, catTotal = {};
  Object.keys(CATS).forEach(c => { catCount[c] = 0; catTotal[c] = pool.filter(t => t.cat === c).length; });
  landedIds.forEach(id => { const t = trickById(id); if (t) catCount[t.cat]++; });
  const catDone = {};
  Object.keys(CATS).forEach(c => catDone[c] = catTotal[c] > 0 && catCount[c] >= catTotal[c]);
  const landedIn = sp => Object.keys(byId).some(id => LANDED.includes(byId[id]) && (trickById(id) || {}).sport === sp);
  const chal = (s.challengeLogged || {});
  const doneChallenges = CHALLENGES.filter(c => (chal[c.id] || 0) >= c.goal).length;
  return {
    sport: sport || null, byId, total: pool.length, tracked: tracked.length,
    landed: landedIds.length, landedIds,
    working: tracked.filter(id => byId[id] === "trying").length,
    wanted: tracked.filter(id => byId[id] === "want").length,
    mastered: tracked.filter(id => byId[id] === "every").length,
    hardLanded: landedIds.filter(id => (trickById(id) || {}).diff === 5).length,
    catCount, catTotal, catDone,
    streak: s.streak || 0, clips: (s.clips || []).length,
    challenges: sport ? CHALLENGES.filter(c => c.sport === sport && (chal[c.id] || 0) >= c.goal).length : doneChallenges,
    crew: !!s.crew, bothSports: SPORT_IDS.every(landedIn),
    pct: pool.length ? Math.round(landedIds.length / pool.length * 100) : 0
  };
}

/* sport = null scopes to everything the rider does */
function computeStats(s, sport) {
  const st = core(s, sport || null);
  st.sports = sportsOf(s);
  st.bySport = {};
  SPORT_IDS.forEach(x => st.bySport[x] = core(s, x));
  st.global = sport ? core(s, null) : st;
  st.global.sports = st.sports;
  return st;
}

/* Stickers are scoped: a sport sticker is judged on that sport alone */
function stickersFor(sports) {
  return STICKERS.filter(x => !x.off && (!x.sport || sports.includes(x.sport)));
}
/* "5 tricks landed" reads off the sticker's own threshold */
const stickerCond = x => (x.n !== undefined ? x.n + " " + x.cond : x.cond);

function earnedStickers(stats) {
  const sports = stats.sports || ["scooter"];
  return stickersFor(sports).filter(st => {
    const scope = st.sport ? (stats.bySport || {})[st.sport] : (stats.global || stats);
    try { return !!scope && st.rule(scope, st); } catch (e) { return false; }
  }).map(st => st.id);
}

/* unlocked = all prereqs landed */
function isUnlocked(t, byId) {
  return t.pre.every(p => LANDED.includes(byId[p]));
}

Object.assign(window, {
  TRICKS, CATS, TIERS_LABEL, STAGES, STAGE, STICKERS, PLANS, CREW, PARKS, CHALLENGES, SPORTS, SPORT_IDS, LANDED,
  FREE_MAX_DIFF, trickById, catColor, tricksFor, sportOf, sportsOf, trickLocked, openTricks, Ico, Diff, Slot, Bar, StickerBadge, TrickCard, StagePicker,
  Modal, SecHead, Empty, SportTabs, SportTag, ShareCard,
  EVENTS, NOTICES, STANCES, PRIVACY, chalById, chalState, challengesFor, liveChallenge, chalRange, parseCoords, hasCoords, mapEmbed, mapLink, logStage, firstLanded, landedByMonth, shortDate, stickerCond,
  AVATARS, AV_GROUPS, avById, Av, AvatarPicker,
  BLANK, loadState, migrate, computeStats, stickersFor, earnedStickers, isUnlocked
});
