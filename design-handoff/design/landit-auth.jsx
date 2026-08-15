/* Land It. Signed-out landing, auth, onboarding */

function Landing({ onStart, onSignIn, onLegal }) {
  const sample = ["bunny-hop", "sk-kickflip", "tailwhip", "sk-50-50"].map(trickById);
  const hues = ["#FFC23F", "#FF8FB4", "#3AC0FF", "#9CE05B"];
  return <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--wash)", backgroundImage: "radial-gradient(rgba(18,16,11,.07) 1.1px,transparent 1.1px)", backgroundSize: "14px 14px" }}>
    <div style={{ background: "var(--ink)", color: "var(--paper)", padding: "12px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <div className="logo"><span className="glyph"><Ico name="scoot" w={19} sw={2.4} style={{ color: "var(--ink)" }}/></span><span className="wm">Land<em>It</em></span></div>
      <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={onSignIn}>Sign in</button>
    </div>

    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 18px 80px", width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.15fr) minmax(0,.85fr)", gap: 28, alignItems: "center" }} className="hero-grid">
        <div>
          <span className="tag" style={{ background: "var(--violet)", fontSize: 12 }}>Scooter and skateboard · free forever tier</span>
          <h1 className="d" style={{ fontSize: "clamp(42px,7.6vw,80px)", margin: "16px 0 0", lineHeight: 1.02 }}>
            Every trick<br/>you can do.<br/><span style={{ color: "var(--yellow)", textShadow: "4px 4px 0 var(--ink)" }}>Proven.</span>
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.45, maxWidth: 470, margin: "18px 0 24px", color: "var(--ink-2)" }}>
            Scooter, skateboard or both. Log what you're learning, what you want next, and how well you've actually got it. Earn stickers you can hold. Beat your crew.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button className="btn" onClick={onStart} style={{ fontSize: 17, padding: "14px 26px" }}>Start tracking, free</button>
            <button className="btn ghost" onClick={onSignIn} style={{ fontSize: 17, padding: "14px 26px" }}>I've got an account</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {sample.map((t, i) => <div key={t.id} className="tcard" style={{ background: hues[i], transform: `rotate(${i % 2 ? 1.6 : -1.8}deg)`, cursor: "default" }}>
            <span className="fold" style={{ "--c": catColor(t.cat) }}/>
            <div className="body">
              <div className="nm">{t.name}</div>
              <div className="meta"><span className="tag" style={{ background: catColor(t.cat) }}>{CATS[t.cat].label}</span><Diff n={t.diff} sm/></div>
            </div>
            <div className="foot" style={{ background: i < 2 ? "var(--green)" : "transparent", color: i < 2 ? "#fff" : "var(--ink-3)" }}>
              <span className="dot" style={{ background: i < 2 ? "#fff" : "transparent", borderColor: i < 2 ? "#fff" : "var(--ink-3)" }}/>{i < 2 ? "Every time" : "Not tracked"}
            </div>
          </div>)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16, marginTop: 62 }}>
        {[["grid", "Two full libraries", "Scooter and skateboard, side by side. Every trick with the lowdown, tips and a fact worth repeating."],
          ["chart", "Five honest stages", "Want it, learning it, sometimes, most times, every time. No fake progress bars."],
          ["star", "Stickers you earn", "Hit a milestone, unlock the sticker. Paid riders get the real vinyl posted out."],
          ["users", "Your crew", "See what your mates just landed and who's on the longest streak."]].map(([ic, h, p], i) =>
          <div key={h} className="panel flat" style={{ padding: 18, background: i === 1 ? "var(--paper-2)" : "var(--paper)" }}>
            <div style={{ width: 40, height: 40, background: ["var(--sky)", "var(--lime)", "var(--pink)", "var(--orange)"][i], border: "2.5px solid var(--ink)", display: "grid", placeItems: "center", marginBottom: 11 }}><Ico name={ic} w={21} sw={2.4}/></div>
            <div className="d" style={{ fontSize: 19, marginBottom: 6 }}>{h}</div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--ink-2)" }}>{p}</p>
          </div>)}
      </div>
    </div>
    <SiteFooter onLegal={onLegal} compact/>
    <style>{`@media(max-width:820px){.hero-grid{grid-template-columns:1fr!important}}`}</style>
  </div>;
}

function Auth({ mode, onDone, onSwap, onBack }) {
  const [f, setF] = React.useState({ name: "", email: "", pw: "" });
  const [err, setErr] = React.useState({});
  const isUp = mode === "up";
  const set = (k, v) => { setF(p => ({ ...p, [k]: v })); setErr(p => ({ ...p, [k]: null })); };

  function submit(e) {
    e.preventDefault();
    const n = {};
    if (isUp && f.name.trim().length < 2) n.name = "Tell us what to call you";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) n.email = "That email doesn't look right";
    if (f.pw.length < 6) n.pw = "6 characters minimum";
    setErr(n);
    if (Object.keys(n).length) return;
    onDone({ name: isUp ? f.name.trim() : (f.email.split("@")[0] || "Rider"), email: f.email, isUp });
  }

  return <div style={{ minHeight: "100vh", background: "var(--ink)", display: "grid", placeItems: "center", padding: 20 }}>
    <div style={{ width: "min(430px,100%)" }}>
      <button className="cond" onClick={onBack} style={{ background: "none", border: "none", color: "#9d968a", display: "flex", alignItems: "center", gap: 7, padding: 0, marginBottom: 16, fontSize: 13 }}><Ico name="back" w={16}/> Back</button>
      <div className="panel" style={{ padding: 24, boxShadow: "8px 8px 0 var(--yellow)" }}>
        <div className="logo" style={{ marginBottom: 4 }}><span className="glyph" style={{ borderColor: "var(--ink)" }}><Ico name="scoot" w={19} sw={2.4}/></span><span className="wm" style={{ color: "var(--ink)" }}>Land<em style={{ color: "var(--orange)" }}>It</em></span></div>
        <h2 className="d" style={{ fontSize: 30, margin: "12px 0 4px" }}>{isUp ? "Make an account" : "Welcome back"}</h2>
        <p className="cond" style={{ margin: "0 0 20px", color: "var(--ink-3)", fontSize: 14, letterSpacing: ".04em" }}>{isUp ? "Free tier, no card, keeps everything" : "Pick up where you left off"}</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {isUp && <div className="field"><label>Your name</label><input value={f.name} onChange={e => set("name", e.target.value)} placeholder="Miles" autoComplete="off"/>{err.name && <span className="err">{err.name}</span>}</div>}
          <div className="field"><label>Email</label><input value={f.email} onChange={e => set("email", e.target.value)} placeholder="you@example.com" autoComplete="off"/>{err.email && <span className="err">{err.email}</span>}</div>
          <div className="field"><label>Password</label><input type="password" value={f.pw} onChange={e => set("pw", e.target.value)} placeholder="••••••"/>{err.pw && <span className="err">{err.pw}</span>}</div>
          <button className="btn wide" type="submit" style={{ marginTop: 4, fontSize: 16, padding: "13px 20px" }}>{isUp ? "Create account" : "Sign in"}</button>
        </form>
        <div className="cond" style={{ marginTop: 16, fontSize: 13.5, color: "var(--ink-3)", textAlign: "center", letterSpacing: ".03em" }}>
          {isUp ? "Already riding? " : "New here? "}
          <button onClick={onSwap} style={{ background: "none", border: "none", padding: 0, color: "var(--orange)", textDecoration: "underline", textUnderlineOffset: 3, font: "inherit" }}>{isUp ? "Sign in" : "Make an account"}</button>
        </div>
      </div>
      <p className="cond" style={{ color: "#7d766a", fontSize: 12, textAlign: "center", marginTop: 14, letterSpacing: ".06em" }}>Under 16? Ask a parent. They can hold the account with a Crew Pass.</p>
    </div>
  </div>;
}

const LEVELS = [
  { id: "new", label: "Just started", sub: "Still working on the basics", hue: "#9CE05B" },
  { id: "some", label: "Got a few tricks", sub: "Hops, 180s, maybe a whip", hue: "#3AC0FF" },
  { id: "solid", label: "Park regular", sub: "Whips, spins, grinding ledges", hue: "#FF9F1C" },
  { id: "send", label: "Sending it", sub: "Flips and combos", hue: "#FF3D78" }
];
const GOALS = [
  { id: "first",    sport: null,      label: "Land my first trick",     hue: "#FFC23F" },
  { id: "whip",     sport: "scooter", label: "Get a tailwhip",          hue: "#246BFF" },
  { id: "kickflip", sport: "skate",   label: "Land a kickflip",         hue: "#246BFF" },
  { id: "street",   sport: null,      label: "Ride street properly",    hue: "#FF5A1F" },
  { id: "flip",     sport: "scooter", label: "Go upside down",          hue: "#E0392B" },
  { id: "bowl",     sport: "skate",   label: "Drop in and ride bowls",  hue: "#E0392B" },
  { id: "all",      sport: null,      label: "Tick off the whole list", hue: "#8A3BE0" }
];
const goalsFor = sports => GOALS.filter(g => !g.sport || sports.includes(g.sport));
const goalLabel = s => {
  if (s.goal === "custom") return (s.goalCustom || "").trim() || "Your own goal";
  const g = GOALS.find(x => x.id === s.goal);
  return g ? g.label : null;
};

/* Pills for every goal, plus one you write yourself */
function GoalPicker({ sports, goal, custom, onGoal, onCustom }) {
  return <div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {goalsFor(sports).map(g => <button key={g.id} className="pill" onClick={() => onGoal(g.id)}
        style={goal === g.id ? { background: g.hue, color: "#fff", boxShadow: "3px 3px 0 var(--ink)" } : null}>{g.label}</button>)}
      <button className="pill" onClick={() => onGoal("custom")}
        style={goal === "custom" ? { background: "var(--ink)", color: "var(--paper)", boxShadow: "3px 3px 0 var(--ink)" } : null}>+ Something else</button>
    </div>
    {goal === "custom" && <div style={{ marginTop: 12 }}>
      <input value={custom || ""} onChange={e => onCustom(e.target.value)} maxLength={60} autoFocus
        placeholder="Land a bri flip before the summer holidays"
        style={{ border: "2.5px solid var(--ink)", background: "var(--paper)", padding: "11px 13px", fontSize: 15, width: "100%", font: "inherit", boxShadow: "3px 3px 0 var(--yellow)" }}/>
      <p className="cond" style={{ margin: "7px 0 0", fontSize: 12.5, color: "var(--ink-3)", letterSpacing: ".05em" }}>Sixty characters. It goes on your dashboard, so keep it blunt.</p>
    </div>}
  </div>;
}

function Onboarding({ name, onFinish }) {
  const [step, setStep] = React.useState(0);
  const [sports, setSports] = React.useState(["scooter"]);
  const [stance, setStance] = React.useState(null);
  const [level, setLevel] = React.useState(null);
  const [goal, setGoal] = React.useState(null);
  const [custom, setCustom] = React.useState("");
  const [pic, setPic] = React.useState(null);
  const [picking, setPicking] = React.useState(false);
  const [picks, setPicks] = React.useState({});

  /* Free plan at sign-up, so only show what a Rookie can actually track */
  const suggested = React.useMemo(() => {
    const max = Math.min(FREE_MAX_DIFF, { new: 2, some: 3, solid: 3, send: 3 }[level] || 3);
    return sports.flatMap(sp => TRICKS.filter(t => t.sport === sp && t.diff <= max).slice(0, sports.length > 1 ? 6 : 10));
  }, [level, sports]);

  const steps = ["What you ride", "Where you're at", "What you're after", "First few tricks"];
  const last = steps.length - 1;
  const toggleSport = id => setSports(p => p.includes(id) ? (p.length > 1 ? p.filter(x => x !== id) : p) : [...p, id]);

  return <div style={{ minHeight: "100vh", background: "var(--wash)", backgroundImage: "radial-gradient(rgba(18,16,11,.07) 1.1px,transparent 1.1px)", backgroundSize: "14px 14px", padding: "26px 16px 60px" }}>
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {steps.map((s, i) => <div key={s} style={{ flex: 1, height: 10, border: "2.5px solid var(--ink)", background: i <= step ? "var(--yellow)" : "var(--paper)" }}/>)}
      </div>
      <span className="eyebrow">Step {step + 1} of {steps.length} · {steps[step]}</span>

      {step === 0 && <div style={{ marginTop: 10 }}>
        <h2 className="d" style={{ fontSize: "clamp(30px,6vw,46px)" }}>Alright {name.split(" ")[0]}.<br/>What do you ride?</h2>
        <p style={{ color: "var(--ink-2)", marginTop: 10, marginBottom: 20 }}>Pick both if you do both. It sets which library you see, and you can change it any time in your profile.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="sportpick">
          {SPORT_IDS.map(id => {
            const sp = SPORTS[id], on = sports.includes(id);
            return <button key={id} onClick={() => toggleSport(id)} className="panel flat"
              style={{ padding: "20px 18px", textAlign: "left", display: "flex", flexDirection: "column", gap: 9, background: on ? sp.color : "var(--paper)", color: on ? "#fff" : "var(--ink)", boxShadow: on ? "5px 5px 0 var(--ink)" : "3px 3px 0 var(--ink)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 40, height: 40, border: "2.5px solid var(--ink)", background: on ? "var(--paper)" : sp.color, display: "grid", placeItems: "center", flex: "none" }}>
                  <Ico name={sp.icon} w={22} sw={2.3} style={{ color: "var(--ink)" }}/>
                </span>
                <span className="d" style={{ fontSize: 24 }}>{sp.label}</span>
              </span>
              <span className="cond" style={{ fontSize: 13.5, letterSpacing: ".03em", opacity: .9 }}>{sp.blurb}</span>
              <span className="lab" style={{ opacity: .8 }}>{TRICKS.filter(t => t.sport === id).length} tricks</span>
            </button>;
          })}
        </div>
        <p className="cond" style={{ margin: "14px 0 0", fontSize: 13.5, color: "var(--ink-3)", letterSpacing: ".03em" }}>
          {sports.length > 1 ? "Both it is. Every page gets a tab so you can look at one sport at a time." : "Riding both? Tap the other one as well."}
        </p>
        <div className="panel flat" style={{ padding: 16, marginTop: 18 }}>
          <div className="lab" style={{ marginBottom: 4 }}>Which foot forward?</div>
          <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--ink-2)" }}>So the tips talk about the right foot. Skip it if you don't know yet.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STANCES.map(st => <button key={st.id} className="pill" onClick={() => setStance(stance === st.id ? null : st.id)}
              style={stance === st.id ? { background: "var(--ink)", color: "var(--paper)", boxShadow: "3px 3px 0 var(--ink)" } : null}>
              {st.label} <span style={{ opacity: .65, fontWeight: 500 }}>· {st.sub}</span>
            </button>)}
          </div>
        </div>
      </div>}

      {step === 1 && <div style={{ marginTop: 10 }}>
        <h2 className="d" style={{ fontSize: "clamp(30px,6vw,46px)" }}>How's it going<br/>so far?</h2>
        <p style={{ color: "var(--ink-2)", marginTop: 10, marginBottom: 20 }}>This just sets where your list starts. You can change it whenever.</p>
        <div className="panel flat" style={{ padding: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap" }}>
          <Av pic={pic} name={name} size={48} rw={3}/>
          <div style={{ minWidth: 140, flex: 1 }}>
            <div className="lab">Your picture</div>
            <p className="cond" style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--ink-3)", letterSpacing: ".03em" }}>{(pic && avById(pic)) ? avById(pic).name : "Pick one, or keep your initial"}</p>
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            {AVATARS.slice(0, 5).map(a => <button key={a.id} onClick={() => setPic(a.id)} title={a.name} style={{ background: "none", border: "none", padding: 0 }}>
              <Av pic={a.id} size={38} rw={pic === a.id ? 3.5 : 2.5} ring={pic === a.id ? "var(--orange)" : "var(--ink)"}/>
            </button>)}
            <button className="btn sm ghost" onClick={() => setPicking(true)}>All {AVATARS.length}</button>
          </div>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {LEVELS.map(l => <button key={l.id} onClick={() => setLevel(l.id)} className="panel flat"
            style={{ padding: "15px 17px", textAlign: "left", display: "flex", alignItems: "center", gap: 14, background: level === l.id ? l.hue : "var(--paper)", boxShadow: level === l.id ? "5px 5px 0 var(--ink)" : "3px 3px 0 var(--ink)" }}>
            <span style={{ width: 20, height: 20, borderRadius: "50%", border: "3px solid var(--ink)", background: level === l.id ? "var(--ink)" : "var(--paper)", flex: "none" }}/>
            <span><span className="d" style={{ fontSize: 20, display: "block" }}>{l.label}</span><span className="cond" style={{ fontSize: 13.5, color: "var(--ink-2)", letterSpacing: ".03em" }}>{l.sub}</span></span>
          </button>)}
        </div>
      </div>}

      {step === 2 && <div style={{ marginTop: 10 }}>
        <h2 className="d" style={{ fontSize: "clamp(30px,6vw,46px)" }}>What's the goal?</h2>
        <p style={{ color: "var(--ink-2)", marginTop: 10, marginBottom: 20 }}>We'll put it on your dashboard and nag you about it. Write your own if none of these fit.</p>
        <GoalPicker sports={sports} goal={goal} custom={custom} onGoal={setGoal} onCustom={setCustom}/>
      </div>}

      {step === 3 && <div style={{ marginTop: 10 }}>
        <h2 className="d" style={{ fontSize: "clamp(28px,5.4vw,42px)" }}>Tick anything you<br/>can already do</h2>
        <p style={{ color: "var(--ink-2)", marginTop: 10, marginBottom: 18 }}>Tap once for <b>learning</b>, twice for <b>landed</b>. Skip it if you'd rather start clean.</p>
        <div className="grid-tricks">
          {suggested.map(t => {
            const v = picks[t.id];
            return <button key={t.id} className="tcard" onClick={() => setPicks(p => ({ ...p, [t.id]: p[t.id] === "trying" ? "most" : p[t.id] === "most" ? undefined : "trying" }))}
              style={{ background: v === "most" ? "#DFF6C9" : v === "trying" ? "#FFE9C2" : "var(--paper)" }}>
              <span className="fold" style={{ "--c": catColor(t.cat) }}/>
              <div className="body"><div className="nm" style={{ fontSize: 17 }}>{t.name}</div><div className="meta"><Diff n={t.diff} sm/>{sports.length > 1 && <SportTag sport={t.sport} sm/>}</div></div>
              <div className="foot" style={{ background: v ? STAGE[v].color : "transparent", color: v ? "#fff" : "var(--ink-3)" }}>
                <span className="dot" style={{ background: v ? "#fff" : "transparent", borderColor: v ? "#fff" : "var(--ink-3)" }}/>{v ? STAGE[v].label : "Tap to log"}
              </div>
            </button>;
          })}
        </div>
      </div>}

      <div style={{ display: "flex", gap: 10, marginTop: 26 }}>
        {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
        <button className="btn" style={{ marginLeft: "auto" }}
          disabled={(step === 0 && !sports.length) || (step === 1 && !level) || (step === 2 && (!goal || (goal === "custom" && !custom.trim())))}
          onClick={() => step < last ? setStep(step + 1) : onFinish({ sports, stance, level, goal, goalCustom: custom.trim(), avatar: pic, picks: Object.fromEntries(Object.entries(picks).filter(([, v]) => v)) })}>
          {step < last ? "Next" : "Let's go"}
        </button>
      </div>
      {picking && <AvatarPicker value={pic} name={name} onClose={() => setPicking(false)} onPick={setPic}/>}
    </div>
  </div>;
}

Object.assign(window, { Landing, Auth, Onboarding, GoalPicker, LEVELS, GOALS, goalsFor, goalLabel });
