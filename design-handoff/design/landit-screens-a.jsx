/* Land It. Home, Library, Trick detail */

function StatBlock({ n, label, hue }) {
  return <div style={{ border: "3px solid var(--ink)", background: hue, padding: "12px 14px", boxShadow: "3px 3px 0 var(--ink)" }}>
    <div className="d" style={{ fontSize: 34, lineHeight: .9 }}>{n}</div>
    <div className="lab" style={{ marginTop: 5, color: "var(--ink-2)" }}>{label}</div>
  </div>;
}

function Home({ s, stats, act, go, view, setView }) {
  const mine = t => t.sport === view;
  const inView = id => { const t = trickById(id); return t && t.sport === view; };
  const working = Object.keys(s.byId).filter(id => s.byId[id] === "trying" && inView(id)).map(trickById);
  const wanted = Object.keys(s.byId).filter(id => s.byId[id] === "want" && inView(id)).map(trickById);
  const nextUp = TRICKS.filter(t => mine(t) && !s.byId[t.id] && isUnlocked(t, s.byId) && !trickLocked(t, s)).sort((a, b) => a.diff - b.diff).slice(0, 4);
  const earned = earnedStickers(stats);
  const recent = STICKERS.filter(x => earned.includes(x.id)).slice(-4);
  const goal = goalLabel(s);
  const sp = SPORTS[view];
  const chal = liveChallenge(view);
  const logged = chal ? ((s.challengeLogged || {})[chal.id] || 0) : 0;
  const chalPct = chal ? Math.min(100, Math.round(logged / chal.goal * 100)) : 0;
  const twoSports = sportsOf(s).length > 1;

  const notice = NOTICES.filter(n => !(s.seenNotices || []).includes(n.id) && (!n.sport || n.sport === view)).slice(-1)[0];

  return <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
    {notice && <div className="panel" style={{ padding: "15px 18px", background: notice.hue || "var(--yellow)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <span className="tag" style={{ background: "var(--ink)" }}>{notice.tag || "Land It"}</span>
      <div style={{ minWidth: 200, flex: 1 }}>
        <div className="cond" style={{ fontSize: 16 }}>{notice.title}</div>
        {notice.body && <p style={{ margin: "4px 0 0", fontSize: 14.5, lineHeight: 1.4, color: "var(--ink)" }}>{notice.body}</p>}
      </div>
      <button className="btn sm ink" onClick={() => act.dismissNotice(notice.id)}>Got it</button>
    </div>}
    <SportTabs s={s} view={view} setView={setView} extra={id => stats.bySport[id].landed + " landed"}/>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,340px)", gap: 18, alignItems: "start" }} className="home-top">
      <div className="panel" style={{ padding: "22px 22px 20px", background: "var(--paper)" }}>
        <span className="eyebrow">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</span>
        <h1 className="d" style={{ fontSize: "clamp(30px,5.5vw,50px)", margin: "8px 0 0" }}>Alright, {s.name.split(" ")[0]}.</h1>
        <p style={{ margin: "10px 0 18px", color: "var(--ink-2)", fontSize: 16, maxWidth: 460 }}>
          {stats.landed === 0 ? "Nothing logged on the " + sp.short.toLowerCase() + " yet. Pick one thing off the list and go and try it today."
            : `${stats.landed} ${sp.short.toLowerCase()} tricks landed, ${stats.working} in progress. ${goal ? "Goal: " + (s.goal === "custom" ? goal : goal.toLowerCase()) + "." : ""}`}
          {twoSports && stats.global.landed > stats.landed &&
            <span style={{ display: "block", marginTop: 6, color: "var(--ink-3)", fontSize: 14.5 }}>{stats.global.landed} landed across both sports.</span>}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(88px,1fr))", gap: 10 }}>
          <StatBlock n={stats.landed} label="Landed" hue="var(--lime)"/>
          <StatBlock n={stats.working} label="Learning" hue="var(--yellow)"/>
          <StatBlock n={stats.wanted} label="Want to" hue="#C9B8FF"/>
          <StatBlock n={earned.length} label="Stickers" hue="#FFB3C9"/>
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span className="lab">{sp.label} library</span><span className="lab">{stats.landed} / {stats.total}</span>
          </div>
          <Bar pct={stats.pct}/>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="panel" style={{ padding: 18, background: "var(--ink)", color: "var(--paper)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 46, height: 46, background: "var(--orange)", border: "3px solid var(--paper)", display: "grid", placeItems: "center", flex: "none" }}><Ico name="flame" w={24} fill="var(--paper)"/></span>
            <div>
              <div className="d" style={{ fontSize: 30, lineHeight: .9 }}>{s.streak} day{s.streak === 1 ? "" : "s"}</div>
              <div className="lab" style={{ color: "#C9C2B4", marginTop: 4 }}>Riding streak</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 5, margin: "15px 0 14px" }}>
            {["M","T","W","T","F","S","S"].map((d, i) => <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ height: 26, border: "2px solid " + (i < Math.min(7, s.streak) ? "var(--yellow)" : "#3a352c"), background: i < Math.min(7, s.streak) ? "var(--yellow)" : "transparent" }}/>
              <span className="lab" style={{ fontSize: 10, color: "#8d8679" }}>{d}</span>
            </div>)}
          </div>
          <button className="btn wide sm" onClick={act.logRide} style={{ background: s.lastRide === new Date().toDateString() ? "var(--green)" : "var(--yellow)", color: "var(--ink)" }}>
            {s.lastRide === new Date().toDateString() ? "✓ Rode today" : "I rode today"}
          </button>
        </div>

        {chal && <button className="panel" onClick={() => go("challenge")} style={{ padding: 16, background: chal.hue, textAlign: "left" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="tag" style={{ background: "var(--ink)" }}>{chal.week}</span>
            <span className="lab" style={{ color: "var(--ink)" }}>{chalState(chal) === "live" ? sp.label : "Starts " + chalRange(chal).split(" to ")[0]}</span>
          </div>
          <div className="d" style={{ fontSize: 26, color: "#fff", textShadow: "2px 2px 0 var(--ink)" }}>{chal.title}</div>
          <p style={{ margin: "8px 0 12px", fontSize: 13.5, lineHeight: 1.4, color: "var(--ink)" }}>{chal.blurb}</p>
          <Bar pct={chalPct} color="var(--ink)" h={13}/>
          <div className="lab" style={{ marginTop: 7 }}>{logged} of {chal.goal} logged</div>
        </button>}
      </div>
    </div>

    <div>
      <SecHead more="Library →" onMore={() => go("library")}>{working.length ? "Working on it" : "Start here"}</SecHead>
      <div className="grid-tricks">
        {(working.length ? working : nextUp).map(t => <TrickCard key={t.id} t={t} stage={s.byId[t.id]} locked={trickLocked(t, s)} onOpen={() => go("trick", t.id)}/>)}
      </div>
    </div>

    {wanted.length > 0 && <div>
      <SecHead>On the wish list</SecHead>
      <div className="grid-tricks">{wanted.slice(0, 4).map(t => <TrickCard key={t.id} t={t} stage={s.byId[t.id]} locked={trickLocked(t, s)} onOpen={() => go("trick", t.id)}/>)}</div>
    </div>}

    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18 }} className="home-bottom">
      <div>
        <SecHead more="Sticker wall →" onMore={() => go("stickers")}>Stickers</SecHead>
        {recent.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {recent.map(x => <StickerBadge key={x.id} s={x} earned onClick={() => go("stickers")}/>)}
        </div> : <Empty icon="star" title="No stickers yet" sub="Log your first trick and the first one drops straight away." cta="Find a trick" onCta={() => go("library")}/>}
      </div>
      <div>
        <SecHead more="Crew →" onMore={() => go("crew")}>Your crew</SecHead>
        <div className="panel flat" style={{ padding: 4 }}>
          {CREW.slice(0, 4).map((c, i) => <button key={c.handle} onClick={() => go("rider", c.me ? "me" : c.handle)}
            style={{ width: "100%", textAlign: "left", border: "none", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderBottom: i < 3 ? "2px solid var(--wash)" : "none", background: c.me ? "var(--paper-2)" : "transparent" }}>
            <span className="d" style={{ fontSize: 16, width: 20, color: "var(--ink-3)" }}>{i + 1}</span>
            <Av pic={c.me ? s.avatar : null} name={c.me ? s.name : c.name} size={32} hue={c.hue}/>
            <div style={{ minWidth: 0 }}>
              <div className="cond" style={{ fontSize: 15 }}>{c.me ? s.name : c.name}</div>
              <div className="lab" style={{ color: "var(--ink-3)", letterSpacing: ".08em", fontSize: 10.5 }}>{c.me ? (stats.global.landed ? "Last: " + (trickById(stats.global.landedIds[stats.global.landedIds.length - 1]) || {}).name : "Nothing logged") : "Last: " + c.last}</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div className="d" style={{ fontSize: 19 }}>{c.me ? stats.global.landed : c.landed}</div>
              <div className="lab" style={{ fontSize: 9.5, color: "var(--ink-3)" }}>landed</div>
            </div>
          </button>)}
        </div>
      </div>
    </div>
    <style>{`@media(max-width:900px){.home-top{grid-template-columns:1fr!important}.home-bottom{grid-template-columns:1fr!important;gap:26px!important}}`}</style>
  </div>;
}

function Library({ s, act, go, view, setView }) {
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all");
  const [stat, setStat] = React.useState("all");
  const [diff, setDiff] = React.useState(0);
  const [sort, setSort] = React.useState("diff");
  const [showF, setShowF] = React.useState(false);
  const activeF = (cat !== "all" ? 1 : 0) + (diff ? 1 : 0) + (stat !== "all" ? 1 : 0);

  const pool = tricksFor(view);
  const lockedCount = pool.filter(t => trickLocked(t, s)).length;

  const list = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    let r = pool.filter(t => {
      if (cat !== "all" && t.cat !== cat) return false;
      if (diff && t.diff !== diff) return false;
      const st = s.byId[t.id];
      if (stat === "tracked" && !st) return false;
      if (stat === "landed" && !LANDED.includes(st)) return false;
      if (stat === "trying" && st !== "trying") return false;
      if (stat === "want" && st !== "want") return false;
      if (stat === "none" && st) return false;
      if (term && !(t.name + " " + t.about + " " + CATS[t.cat].label).toLowerCase().includes(term)) return false;
      return true;
    });
    r.sort((a, b) => sort === "diff" ? a.diff - b.diff : sort === "hard" ? b.diff - a.diff : a.name.localeCompare(b.name));
    return r;
  }, [q, cat, stat, diff, sort, s.byId, s.plan, view]);

  const filters = <>
    <div className="panel flat" style={{ padding: 15 }}>
      <div className="lab" style={{ marginBottom: 9 }}>Category</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button className={"pill" + (cat === "all" ? " on" : "")} onClick={() => setCat("all")}>All</button>
        {Object.entries(CATS).map(([k, c]) => <button key={k} className="pill" onClick={() => setCat(k)}
          style={cat === k ? { background: c.color, color: "#fff", boxShadow: "3px 3px 0 var(--ink)" } : null}>{c.label}</button>)}
      </div>
      <div className="lab" style={{ margin: "17px 0 9px" }}>Difficulty</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button className={"pill" + (diff === 0 ? " on" : "")} onClick={() => setDiff(0)}>Any</button>
        {[1,2,3,4,5].map(d => <button key={d} className={"pill" + (diff === d ? " on" : "")} onClick={() => setDiff(d)}>{TIERS_LABEL[d-1]}</button>)}
      </div>
      <div className="lab" style={{ margin: "17px 0 9px" }}>My status</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {[["all","Everything"],["none","Not tracked"],["want","Want to learn"],["trying","Learning"],["landed","Landed"]].map(([k, l]) =>
          <button key={k} className={"pill" + (stat === k ? " on" : "")} onClick={() => setStat(k)}>{l}</button>)}
      </div>
      <div className="lab" style={{ margin: "17px 0 9px" }}>Sort</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {[["diff","Easiest first"],["hard","Hardest first"],["az","A–Z"]].map(([k, l]) =>
          <button key={k} className={"pill" + (sort === k ? " on" : "")} onClick={() => setSort(k)}>{l}</button>)}
      </div>
    </div>
  </>;

  return <div>
    <SportTabs s={s} view={view} setView={setView} extra={id => tricksFor(id).length}/>
    <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
      <div>
        <span className="eyebrow">{SPORTS[view].label} library</span>
        <h1 className="d" style={{ fontSize: "clamp(30px,5vw,44px)", marginTop: 6 }}>{pool.length} tricks</h1>
      </div>
      <div className="search" style={{ flex: 1, minWidth: 240 }}>
        <Ico name="search" w={19} sw={2.6}/>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search tricks: whip, grind, flip…"/>
        {q && <button className="cond" onClick={() => setQ("")} style={{ background: "none", border: "none", color: "var(--ink-3)", fontSize: 13 }}>Clear</button>}
      </div>
    </div>

    <div className="two-col">
      <div>
        <button className="filter-toggle" onClick={() => setShowF(v => !v)}>
          <Ico name="grid" w={17} sw={2.4}/>
          <span>Filters &amp; sort</span>
          {activeF > 0 && <span className="fcount">{activeF}</span>}
          <span style={{ marginLeft: "auto" }}>{showF ? "Hide" : "Show"}</span>
        </button>
        <div className={"filterwrap" + (showF ? " open" : "")}>{filters}</div>
      </div>
      <div>
        {s.plan === "rookie" && lockedCount > 0 && <div className="panel flat" style={{ padding: "13px 15px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--paper-2)" }}>
          <span style={{ width: 34, height: 34, background: "var(--violet)", border: "2.5px solid var(--ink)", display: "grid", placeItems: "center", flex: "none" }}><Ico name="lock" w={17} sw={2.6} style={{ color: "#fff" }}/></span>
          <div style={{ minWidth: 180, flex: 1 }}>
            <div className="cond" style={{ fontSize: 15 }}>You're on Rookie</div>
            <p style={{ margin: "3px 0 0", fontSize: 13.5, color: "var(--ink-2)" }}>{TIERS_LABEL[0]} and {TIERS_LABEL[1]} tricks are yours. The {TIERS_LABEL[2]}, {TIERS_LABEL[3]} and {TIERS_LABEL[4]} tiers open up on Shredder.</p>
          </div>
          <button className="btn sm" onClick={() => go("plans")}>See plans</button>
        </div>}
        <div className="lab" style={{ color: "var(--ink-3)", marginBottom: 11 }}>{list.length} trick{list.length === 1 ? "" : "s"}{cat !== "all" ? " · " + CATS[cat].blurb : ""}</div>
        {list.length ? <div className="grid-tricks">
          {list.map(t => <TrickCard key={t.id} t={t} stage={s.byId[t.id]} locked={trickLocked(t, s)} onOpen={() => go("trick", t.id)}/>)}
        </div> : <Empty icon="search" title="Nothing matches" sub="Try dropping a filter or searching something broader." cta="Reset filters" onCta={() => { setQ(""); setCat("all"); setStat("all"); setDiff(0); }}/>}
      </div>
    </div>
  </div>;
}

/* What a Rookie rider sees when they open a Gnarly or Pro trick */
function LockedTrick({ t, s, go }) {
  const c = catColor(t.cat);
  const pres = t.pre.map(trickById).filter(Boolean);
  return <div>
    <button className="cond" onClick={() => go("library")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 7, padding: 0, marginBottom: 14, color: "var(--ink-3)", fontSize: 13.5 }}><Ico name="back" w={16}/> All tricks</button>
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ background: "repeating-linear-gradient(45deg,#EFE9DA 0 11px,#E5DECC 11px 22px)", padding: "20px 22px", borderBottom: "3px solid var(--ink)", display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="tag" style={{ background: c }}>{CATS[t.cat].label}</span>
            <SportTag sport={t.sport}/>
          </div>
          <h1 className="d" style={{ fontSize: "clamp(36px,7vw,64px)", color: "var(--ink-3)", marginTop: 10 }}>{t.name}</h1>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div className="lab" style={{ color: "var(--ink-2)", marginBottom: 6 }}>Difficulty · {TIERS_LABEL[t.diff - 1]}</div>
          <Diff n={t.diff}/>
        </div>
      </div>
      <div style={{ padding: "34px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
        <span style={{ width: 56, height: 56, background: "var(--violet)", border: "3px solid var(--ink)", display: "grid", placeItems: "center", transform: "rotate(-5deg)" }}><Ico name="lock" w={27} sw={2.4} style={{ color: "#fff" }}/></span>
        <div className="d" style={{ fontSize: 26 }}>{TIERS_LABEL[t.diff - 1]} tier is on Shredder</div>
        <p style={{ margin: 0, maxWidth: 460, fontSize: 15.5, lineHeight: 1.5, color: "var(--ink-2)" }}>
          Rookie covers the {TIERS_LABEL[0]} and {TIERS_LABEL[1]} tiers. The lowdown, the tips and the tracking for this one come with Shredder, along with the rest of the {TIERS_LABEL[t.diff - 1]} tier.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
          <button className="btn" onClick={() => go("plans")}>See plans</button>
          <button className="btn ghost" onClick={() => go("library")}>Back to the library</button>
        </div>
        {pres.length > 0 && <div style={{ borderTop: "2.5px solid var(--wash)", paddingTop: 16, marginTop: 8, width: "100%" }}>
          <div className="lab" style={{ marginBottom: 9, color: "var(--ink-3)" }}>You'd want these first, and they're free</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, justifyContent: "center" }}>
            {pres.map(p => <button key={p.id} className="pill" onClick={() => go("trick", p.id)} style={{ fontSize: 12, padding: "5px 10px", background: LANDED.includes(s.byId[p.id]) ? "var(--lime)" : "var(--paper)" }}>
              {LANDED.includes(s.byId[p.id]) ? "✓ " : ""}{p.name}</button>)}
          </div>
        </div>}
      </div>
    </div>
  </div>;
}

function TrickDetail({ id, s, stats, act, go }) {
  const t = trickById(id);
  const [note, setNote] = React.useState(s.notes[id] || "");
  const [sharing, setSharing] = React.useState(false);
  const [viewClip, setViewClip] = React.useState(null);
  const landedAt = firstLanded(s)[id];
  const fileRef = React.useRef(null);
  if (!t) return <Empty icon="search" title="Trick not found" sub="It may have been renamed." cta="Back to library" onCta={() => go("library")}/>;
  if (trickLocked(t, s)) return <LockedTrick t={t} s={s} go={go}/>;
  const c = catColor(t.cat), st = s.byId[t.id] ? STAGE[s.byId[t.id]] : null;
  const unlocked = isUnlocked(t, s.byId);
  const pres = t.pre.map(trickById).filter(Boolean);
  const unlocks = TRICKS.filter(x => x.pre.includes(t.id));
  const clips = s.clips.filter(cl => cl.trick === t.id);

  return <div>
    <button className="cond" onClick={() => go("library")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 7, padding: 0, marginBottom: 14, color: "var(--ink-3)", fontSize: 13.5 }}><Ico name="back" w={16}/> All tricks</button>

    <div className="panel" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
      <div style={{ background: c, padding: "20px 22px", borderBottom: "3px solid var(--ink)", display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="tag" style={{ background: "var(--ink)" }}>{CATS[t.cat].label}</span>
            <SportTag sport={t.sport}/>
          </div>
          <h1 className="d" style={{ fontSize: "clamp(36px,7vw,64px)", color: "#fff", textShadow: "3px 3px 0 var(--ink)", marginTop: 10 }}>{t.name}</h1>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div className="lab" style={{ color: "var(--ink)", marginBottom: 6 }}>Difficulty · {TIERS_LABEL[t.diff - 1]}</div>
          <Diff n={t.diff}/>
        </div>
      </div>

      <div style={{ padding: 22, display: "grid", gridTemplateColumns: "minmax(0,1.25fr) minmax(0,1fr)", gap: 22 }} className="tk-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Slot label="Trick photo: drop a shot of this trick" h={200}/>
          <div>
            <div className="lab" style={{ color: c, marginBottom: 6 }}>◆ The lowdown</div>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, color: "var(--ink-2)", textWrap: "pretty" }}>{t.about}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 11, border: "2.5px solid var(--ink)", background: "var(--paper-2)", padding: "11px 14px" }}>
            <span style={{ width: 34, height: 34, background: SPORTS[t.sport].color, border: "2.5px solid var(--ink)", display: "grid", placeItems: "center", flex: "none" }}>
              <Ico name={SPORTS[t.sport].icon} w={19} sw={2.3} style={{ color: "#fff" }}/>
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="lab" style={{ color: "var(--ink-3)" }}>What you need</div>
              <div className="cond" style={{ fontSize: 14.5, marginTop: 2 }}>{SPORTS[t.sport].kit}{t.diff >= 4 ? ". Learn this one into foam or resi first" : ""}</div>
            </div>
          </div>
          <div>
            <div className="lab" style={{ color: c, marginBottom: 6 }}>◆ Tips</div>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, color: "var(--ink-2)", textWrap: "pretty" }}>{t.tips}</p>
          </div>
          <div style={{ background: "var(--paper-2)", borderLeft: "7px solid " + c, border: "2.5px solid var(--ink)", borderLeftWidth: 7, borderLeftColor: c, padding: "13px 15px", display: "flex", gap: 12 }}>
            <span className="d" style={{ fontSize: 13, color: c, flex: "none", width: 46, lineHeight: 1.05 }}>Fun fact</span>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: "var(--ink-2)" }}>{t.fact}</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="panel flat" style={{ padding: 15, background: "var(--paper-2)" }}>
            <div className="lab" style={{ marginBottom: 10 }}>Can you do it?</div>
            <StagePicker value={s.byId[t.id]} onPick={v => act.setStage(t.id, v)} compact/>
            {st && <p className="cond" style={{ margin: "12px 0 0", fontSize: 14, color: "var(--ink-2)", letterSpacing: ".03em" }}>
              Logged as <b style={{ color: st.color }}>{st.label}</b>. {st.id === "every" ? "That's it locked in." : "Tap a higher stage when it gets more consistent."}
            </p>}
            {landedAt && <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, borderTop: "2.5px solid var(--wash)", paddingTop: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 120 }}>
                <div className="lab" style={{ color: "var(--ink-3)" }}>First landed</div>
                <div className="cond" style={{ fontSize: 14.5, marginTop: 2 }}>{shortDate(landedAt.at)}{landedAt.est ? " (estimated)" : ""}</div>
              </div>
              <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => setSharing(true)}>Share it</button>
            </div>}
          </div>

          <div className="panel flat" style={{ padding: 15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div className="lab">Your clips</div>
              <span className="lab" style={{ marginLeft: "auto", color: s.plan === "rookie" ? "var(--violet)" : "var(--ink-3)" }}>{s.plan === "rookie" ? "Shredder" : "Unlimited"}</span>
            </div>
            {s.plan === "rookie" ? <>
              <div className="slot" style={{ minHeight: 90, marginBottom: 10, borderStyle: "solid", borderColor: "var(--violet)" }}>
                <span style={{ color: "var(--ink-2)" }}>Filming your attempts is part of Shredder</span>
              </div>
              <button className="btn sm wide" style={{ background: "var(--violet)" }} onClick={() => go("plans")}>See plans</button>
            </> : <>
            {clips.length ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              {clips.map((cl, i) => <div key={i} style={{ border: "2.5px solid var(--ink)", background: "var(--ink)", aspectRatio: "16/10", display: "grid", placeItems: "center", position: "relative", overflow: "hidden", cursor: cl.src ? "pointer" : "default" }}
                onClick={() => cl.src && setViewClip(i)}>
                {cl.src && cl.kind === "image" ? <img src={cl.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> :
                 cl.src ? <video src={cl.src} muted style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : null}
                {cl.kind !== "image" && <Ico name="play" w={22} fill="var(--yellow)" style={{ position: "absolute" }}/>}
                <span className="lab" style={{ position: "absolute", bottom: 5, left: 6, color: "#C9C2B4", fontSize: 9 }}>{cl.date}</span>
                <button onClick={e => { e.stopPropagation(); act.deleteClip(i); }}
                  style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.6)", color: "#fff", display: "grid", placeItems: "center", cursor: "pointer", fontSize: 13, lineHeight: 1 }}>×</button>
              </div>)}
            </div> : <Slot label="No clips yet: film the attempt" h={90} style={{ marginBottom: 10 }}/>}
            <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display: "none" }}
              onChange={e => { const f = e.target.files[0]; if (!f) return; act.addClip(t.id, URL.createObjectURL(f), f.type.startsWith("video") ? "video" : "image"); e.target.value = ""; }}/>
            <button className="btn sm wide ink" onClick={() => fileRef.current.click()}><span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><Ico name="cam" w={15}/> Add a clip</span></button>
            </>}
          </div>
          {viewClip !== null && clips[viewClip] && <div onClick={() => setViewClip(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)", zIndex: 999, display: "grid", placeItems: "center", padding: 24 }}>
            {clips[viewClip].kind === "image" ?
              <img src={clips[viewClip].src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}/> :
              <video src={clips[viewClip].src} controls autoPlay style={{ maxWidth: "100%", maxHeight: "100%" }} onClick={e => e.stopPropagation()}/>}
          </div>}

          <div className="panel flat" style={{ padding: 15 }}>
            <div className="lab" style={{ marginBottom: 8 }}>Session notes</div>
            <textarea rows={3} value={note} placeholder="What went wrong, what to try next time…"
              onChange={e => setNote(e.target.value)} onBlur={() => act.setNote(t.id, note)}
              style={{ border: "2.5px solid var(--ink)", padding: 10, fontSize: 14, width: "100%", resize: "vertical", background: "var(--paper)" }}/>
          </div>

          {(pres.length > 0 || unlocks.length > 0) && <div className="panel flat" style={{ padding: 15 }}>
            {pres.length > 0 && <>
              <div className="lab" style={{ marginBottom: 8 }}>{unlocked ? "Built on" : "Get these first"}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: unlocks.length ? 15 : 0 }}>
                {pres.map(p => <button key={p.id} className="pill" onClick={() => go("trick", p.id)}
                  style={{ fontSize: 12, padding: "5px 10px", background: LANDED.includes(s.byId[p.id]) ? "var(--lime)" : "var(--paper)" }}>
                  {LANDED.includes(s.byId[p.id]) ? "✓ " : ""}{p.name}
                </button>)}
              </div>
            </>}
            {unlocks.length > 0 && <>
              <div className="lab" style={{ marginBottom: 8 }}>Land this and you unlock</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {unlocks.map(p => <button key={p.id} className="pill" onClick={() => go("trick", p.id)} style={{ fontSize: 12, padding: "5px 10px", opacity: trickLocked(p, s) ? .6 : 1 }}>
                  {trickLocked(p, s) && <Ico name="lock" w={11} sw={2.8} style={{ marginRight: 5, verticalAlign: "-1px" }}/>}{p.name}</button>)}
              </div>
            </>}
          </div>}
        </div>
      </div>
    </div>
    {sharing && <ShareCard kind="trick" trick={t} s={s} stats={stats} toast={act.toast} onClose={() => setSharing(false)}/>}
    <style>{`@media(max-width:820px){.tk-grid{grid-template-columns:1fr!important}}`}</style>
  </div>;
}

Object.assign(window, { Home, Library, TrickDetail, LockedTrick, StatBlock });
