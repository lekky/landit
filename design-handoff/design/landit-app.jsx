/* Land It. App shell, state, routing */

const NAV = [
  { id: "home", label: "Home", icon: "home" },
  { id: "library", label: "Tricks", icon: "grid" },
  { id: "progress", label: "Progress", icon: "chart" },
  { id: "stickers", label: "Stickers", icon: "star" },
  { id: "crew", label: "Crew", icon: "users" }
];
const EXTRA_NAV = [
  { id: "challenge", label: "Challenge", icon: "bolt" },
  { id: "events", label: "Events", icon: "flag" },
  { id: "parks", label: "Spots", icon: "map" },
  { id: "plans", label: "Plans", icon: "crown" }
];

function App() {
  const [s, setS] = React.useState(loadState);
  const [route, setRoute] = React.useState({ name: "home", arg: null });
  const [gate, setGate] = React.useState(null);      // null | 'up' | 'in'
  const [toasts, setToasts] = React.useState([]);
  const [menu, setMenu] = React.useState(false);
  const [legal, setLegal] = React.useState(null);
  const seen = React.useRef(null);
  const sRef = React.useRef(s);
  sRef.current = s;

  React.useEffect(() => { try { localStorage.setItem("landit.v2", JSON.stringify(s)); } catch (e) {} }, [s]);

  const view = sportsOf(s).includes(s.view) ? s.view : sportsOf(s)[0];
  const stats = React.useMemo(() => computeStats(s, view), [s, view]);
  const setView = React.useCallback(v => setS(p => ({ ...p, view: v })), []);

  const toast = React.useCallback((text, hue) => {
    const id = Math.random();
    setToasts(t => [...t, { id, text, hue }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  }, []);

  /* fire sticker toasts when new ones unlock */
  React.useEffect(() => {
    if (!s.signedIn) return;
    const now = earnedStickers(stats);
    if (seen.current === null) { seen.current = now; return; }
    const fresh = now.filter(id => !seen.current.includes(id));
    seen.current = now;
    fresh.forEach(id => {
      const st = STICKERS.find(x => x.id === id);
      toast("Sticker unlocked · " + st.name, st.hue);
    });
  }, [stats, s.signedIn, toast]);

  const act = React.useMemo(() => ({
    set: patch => setS(p => ({ ...p, ...patch })),
    setStage(id, stage) {
      setS(p => {
        const byId = { ...p.byId };
        if (stage) byId[id] = stage; else delete byId[id];
        return { ...p, byId, log: stage ? logStage(p.log, id, stage) : (p.log || []).filter(e => e.id !== id) };
      });
      if (stage) toast((trickById(id) || {}).name + " · " + STAGE[stage].label, STAGE[stage].color);
    },
    addClip(trickId, src, kind) {
      setS(p => {
        if (p.plan === "rookie") { toast("Saving clips is on Shredder", "var(--violet)"); return p; }
        return { ...p, clips: [...p.clips, { trick: trickId, src, kind, date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" }) }] };
      });
    },
    deleteClip(idx) {
      setS(p => ({ ...p, clips: p.clips.filter((_, i) => i !== idx) }));
    },
    logRide() {
      setS(p => {
        const today = new Date().toDateString();
        if (p.lastRide === today) return p;
        return { ...p, lastRide: today, streak: (p.streak || 0) + 1, days: (p.days || 0) + 1 };
      });
      toast("Session logged. Streak up", "var(--orange)");
    },
    logChallenge(id) {
      const ch = chalById(id);
      if (!ch || chalState(ch) !== "live") return;
      setS(p => {
        const c = { ...(p.challengeLogged || {}) };
        c[id] = Math.min(ch.goal, (c[id] || 0) + 1);
        return { ...p, challengeLogged: c };
      });
    },
    setSports(list) {
      const next = SPORT_IDS.filter(x => list.includes(x));
      if (!next.length) return;
      setS(p => ({ ...p, sports: next, view: next.includes(p.view) ? p.view : next[0] }));
      toast(next.length > 1 ? "Tracking both sports" : "Tracking " + SPORTS[next[0]].label.toLowerCase() + " only", SPORTS[next[0]].color);
    },
    setView(v) { setS(p => ({ ...p, view: v })); },
    joinCrew() { setS(p => ({ ...p, crew: true })); toast("You're in. Ramp Rats", "var(--sky)"); },
    setPlan(id) {
      setS(p => ({ ...p, plan: id }));
      const pl = PLANS.find(x => x.id === id);
      toast(id === "rookie" ? "Back on the free plan" : "You're on " + pl.name, pl.hue);
      setRoute({ name: "home", arg: null });
    },
    setNote(id, text) { setS(p => ({ ...p, notes: { ...p.notes, [id]: text } })); },
    setStance(id) { setS(p => ({ ...p, stance: id })); },
    setPrivacy(id) {
      setS(p => ({ ...p, privacy: id }));
      toast("Profile set to " + PRIVACY.find(x => x.id === id).label.toLowerCase(), "var(--sky)");
    },
    toggleEvent(e) {
      setS(p => {
        const going = p.eventsGoing || [];
        return { ...p, eventsGoing: going.includes(e.id) ? going.filter(x => x !== e.id) : [...going, e.id] };
      });
      toast(((sRef.current.eventsGoing || []).includes(e.id) ? "Off the list. " : "You're down for ") + e.name, "var(--sky)");
    },
    dismissNotice(id) { setS(p => ({ ...p, seenNotices: [...(p.seenNotices || []), id] })); },
    addSpot(spot) {
      setS(p => ({ ...p, submittedSpots: [...(p.submittedSpots || []), spot] }));
      toast("Spot submitted for review", "var(--sky)");
    },
    approveSpot(i) {
      setS(p => {
        const spot = p.submittedSpots[i];
        if (!spot) return p;
        PARKS.push({ ...spot, dist: spot.dist });
        return { ...p, submittedSpots: p.submittedSpots.filter((_, x) => x !== i) };
      });
      toast("Spot approved. Now live", "var(--green)");
    },
    rejectSpot(i) {
      setS(p => ({ ...p, submittedSpots: p.submittedSpots.filter((_, x) => x !== i) }));
      toast("Spot rejected", "var(--ink-3)");
    },
    signOut() { setS(p => ({ ...p, signedIn: false })); setRoute({ name: "home", arg: null }); },
    reset() { seen.current = null; setS(p => ({ ...BLANK, signedIn: true, onboarded: true, name: p.name, plan: p.plan, level: p.level, goal: p.goal, goalCustom: p.goalCustom, sports: p.sports, view: p.view })); toast("Progress cleared", "var(--ink-3)"); },
    toast
  }), [toast]);

  const go = React.useCallback((name, arg) => {
    setRoute({ name, arg: arg || null });
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  if (legal) return <Legal id={legal} onPick={setLegal} onClose={() => setLegal(null)}/>;

  /* ---- signed out ---- */
  if (!s.signedIn) {
    if (gate) return <Auth mode={gate} onBack={() => setGate(null)} onSwap={() => setGate(gate === "up" ? "in" : "up")}
      onDone={({ name, isUp }) => {
        seen.current = null;
        setS(p => ({ ...p, signedIn: true, name, onboarded: isUp ? p.onboarded && !!p.level : true }));
        setGate(null);
        setRoute({ name: "home", arg: null });
      }}/>;
    return <Landing onStart={() => setGate("up")} onSignIn={() => setGate("in")} onLegal={setLegal}/>;
  }

  if (!s.onboarded) return <Onboarding name={s.name} onFinish={({ sports, stance, level, goal, goalCustom, avatar, picks }) =>
    setS(p => ({ ...p, onboarded: true, sports, view: sports[0], stance, level, goal, goalCustom, avatar: avatar || p.avatar, byId: { ...p.byId, ...picks } }))}/>;

  const v = { view, setView };
  const screens = {
    home: <Home s={s} stats={stats} act={act} go={go} {...v}/>,
    library: <Library s={s} act={act} go={go} {...v}/>,
    trick: <TrickDetail id={route.arg} s={s} stats={stats} act={act} go={go}/>,
    progress: <Progress s={s} stats={stats} act={act} go={go} {...v}/>,
    stickers: <StickerWall s={s} stats={stats} act={act} go={go} {...v}/>,
    crew: <Crew s={s} stats={stats} act={act} go={go}/>,
    challenge: <Challenge s={s} stats={stats} act={act} go={go} {...v}/>,
    parks: <Parks s={s} act={act} {...v}/>,
    events: <Events s={s} act={act} go={go} {...v}/>,
    rider: <RiderProfile id={route.arg} s={s} stats={stats} act={act} go={go} {...v}/>,
    plans: <Plans s={s} act={act} go={go}/>,
    profile: <Profile s={s} stats={stats} act={act} go={go}/>,
    coach: <CoachView s={s} stats={stats} go={go}/>,
    admin: <Admin s={s} act={act} go={go}/>
  };
  const activeNav = route.name === "trick" ? "library" : route.name === "rider" ? "crew" : route.name;

  return <div className="app">
    <header className="topbar">
      <div className="topbar-in">
        <button className="logo" onClick={() => go("home")}>
          <span className="glyph"><Ico name="scoot" w={19} sw={2.4} style={{ color: "var(--ink)" }}/></span>
          <span className="wm">Land<em>It</em></span>
        </button>
        <nav className="nav">
          {NAV.concat(EXTRA_NAV).map(n => <button key={n.id} className={activeNav === n.id ? "on" : ""} onClick={() => go(n.id)}>{n.label}</button>)}
        </nav>
        <div className="right">
          <span className="streakchip"><Ico name="flame" w={15} fill="var(--yellow)"/>{s.streak}</span>
          <Av pic={s.avatar} name={s.name} size={34} rw={2.5} ring="var(--paper)" onClick={() => go("profile")} title="Profile"/>
        </div>
      </div>
    </header>

    <main className="page">{screens[route.name] || screens.home}</main>

    <SiteFooter onNav={go} onLegal={setLegal}/>

    <nav className="mobnav">
      {NAV.map(n => <button key={n.id} className={activeNav === n.id ? "on" : ""} onClick={() => go(n.id)}>
        <Ico name={n.icon} w={21} sw={2.2}/>{n.label}
      </button>)}
    </nav>

    <div className="toasts">
      {toasts.map(t => <div key={t.id} className="toast">
        <span className="chip" style={{ background: t.hue }}/>{t.text}
      </div>)}
    </div>
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
