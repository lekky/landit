/* Land It. Progress + skill tree, Sticker wall, Crew, Challenge, Parks */

function Progress({ s, stats, act, go, view, setView }) {
  const free = s.plan === "rookie";
  const pool = tricksFor(view);
  const branches = Object.keys(CATS).filter(k => stats.catTotal[k] > 0);
  const lockedCount = pool.filter(t => trickLocked(t, s)).length;

  return <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
    <div>
      <span className="eyebrow">Progress</span>
      <h1 className="d" style={{ fontSize: "clamp(30px,5vw,44px)", marginTop: 6 }}>Where you're at</h1>
    </div>
    <SportTabs s={s} view={view} setView={setView} extra={id => stats.bySport[id].pct + "%"}/>

    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18 }} className="pg-top">
      <div className="panel" style={{ padding: 20 }}>
        <div className="lab" style={{ marginBottom: 12 }}>{SPORTS[view].label} by category</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {branches.map(k => <div key={k}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span className="cond" style={{ fontSize: 14.5 }}>{CATS[k].label}</span>
              <span className="lab" style={{ color: "var(--ink-3)" }}>{stats.catCount[k]} / {stats.catTotal[k]}</span>
            </div>
            <Bar pct={stats.catCount[k] / stats.catTotal[k] * 100} color={CATS[k].color} h={13}/>
          </div>)}
        </div>
      </div>
      <div className="panel" style={{ padding: 20 }}>
        <div className="lab" style={{ marginBottom: 12 }}>By stage</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {STAGES.map(st => {
            const n = Object.keys(s.byId).filter(id => s.byId[id] === st.id && (trickById(id) || {}).sport === view).length;
            return <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ width: 15, height: 15, background: st.color, border: "2.5px solid var(--ink)", flex: "none" }}/>
              <span className="cond" style={{ fontSize: 14.5 }}>{st.label}</span>
              <span style={{ flex: 1, height: 3, background: "var(--wash)" }}/>
              <span className="d" style={{ fontSize: 20 }}>{n}</span>
            </div>;
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 11, borderTop: "2.5px solid var(--ink)", paddingTop: 10, marginTop: 4 }}>
            <span className="cond" style={{ fontSize: 14.5, color: "var(--ink-3)" }}>Untouched</span>
            <span style={{ flex: 1, height: 3, background: "var(--wash)" }}/>
            <span className="d" style={{ fontSize: 20, color: "var(--ink-3)" }}>{stats.total - stats.tracked}</span>
          </div>
        </div>
      </div>
    </div>

    <div>
      <SecHead>Over time</SecHead>
      <div className="panel" style={{ padding: 20 }}>
        {(() => {
          const months = landedByMonth(s, view);
          const peak = Math.max(1, ...months.map(m => m.n));
          const recent = Object.values(firstLanded(s))
            .filter(e => (trickById(e.id) || {}).sport === view)
            .sort((x, y) => y.at - x.at).slice(0, 4);
          const total = months.reduce((n, m) => n + m.n, 0);
          const estimated = months.reduce((n, m) => n + m.est, 0);
          return <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 24 }} className="pg-time">
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                <span className="d" style={{ fontSize: 30 }}>{total}</span>
                <span className="cond" style={{ fontSize: 14.5, color: "var(--ink-2)" }}>{SPORTS[view].short.toLowerCase()} tricks landed in the last six months</span>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 132 }}>
                {months.map(m => <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span className="d" style={{ fontSize: 15, color: m.n ? "var(--ink)" : "var(--ink-3)" }}>{m.n}</span>
                  <div style={{ width: "100%", height: Math.round(8 + (m.n / peak) * 88), background: m.n ? "var(--lime)" : "var(--wash)", border: "2.5px solid var(--ink)" }}/>
                  <span className="lab" style={{ color: "var(--ink-3)" }}>{m.label}</span>
                </div>)}
              </div>
              {estimated > 0 && <p className="cond" style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--ink-3)", letterSpacing: ".03em" }}>
                {estimated} of these were tracked before dates were recorded, so their month is estimated.
              </p>}
            </div>
            <div>
              <div className="lab" style={{ marginBottom: 12 }}>Latest lands</div>
              {recent.length ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {recent.map(e => {
                  const t = trickById(e.id);
                  return <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 11, height: 11, background: catColor(t.cat), border: "2px solid var(--ink)", flex: "none" }}/>
                    <button className="cond" onClick={() => go("trick", t.id)} style={{ background: "none", border: "none", padding: 0, fontSize: 15, textAlign: "left" }}>{t.name}</button>
                    <span style={{ flex: 1, height: 3, background: "var(--wash)" }}/>
                    <span className="lab" style={{ color: "var(--ink-3)" }}>{shortDate(e.at)}</span>
                  </div>;
                })}
              </div> : <p style={{ margin: 0, fontSize: 14.5, color: "var(--ink-2)" }}>Nothing landed on the {SPORTS[view].short.toLowerCase()} yet. The first one dates itself.</p>}
            </div>
          </div>;
        })()}
      </div>
    </div>

    <div>
      <SecHead>Skill tree</SecHead>
      <p style={{ margin: "-6px 0 16px", color: "var(--ink-2)", maxWidth: 620 }}>Tricks unlock tricks. Land the ones on the left and the next column opens up.{free && lockedCount > 0 ? " The " + TIERS_LABEL[3] + " and " + TIERS_LABEL[4] + " nodes need Shredder." : ""}</p>
      <div className="tree">
        {branches.map(k => {
          const inCat = pool.filter(t => t.cat === k);
          const depth = t => t.pre.length ? 1 + Math.max(...t.pre.map(p => { const q = trickById(p); return q ? depth(q) : 0; })) : 0;
          const maxD = Math.max(...inCat.map(depth));
          const tiers = Array.from({ length: maxD + 1 }, (_, d) => inCat.filter(t => depth(t) === d));
          return <div key={k} className="branch" style={{ position: "relative", background: "var(--paper)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span className="tag" style={{ background: CATS[k].color, fontSize: 12 }}>{CATS[k].label}</span>
              <span className="cond" style={{ fontSize: 14, color: "var(--ink-3)" }}>{CATS[k].blurb}</span>
              <span className="lab" style={{ marginLeft: "auto", color: "var(--ink-3)" }}>{stats.catCount[k]}/{stats.catTotal[k]}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
              {tiers.filter(g => g.length).map((g, gi) => <div key={gi} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span className="lab" style={{ color: "var(--ink-3)" }}>Stage {gi + 1}</span>
                {g.map(t => {
                  const done = LANDED.includes(s.byId[t.id]), open = isUnlocked(t, s.byId), paywalled = trickLocked(t, s);
                  return <button key={t.id} className={"node" + (paywalled ? " paid" : done ? " done" : open ? "" : " lock")} onClick={() => go("trick", t.id)}>
                    <span className="nn">{t.name}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <Diff n={t.diff} sm/>
                      {paywalled && <span className="lab" style={{ color: "var(--violet)", display: "flex", alignItems: "center", gap: 4 }}><Ico name="lock" w={12} sw={2.8}/>Shredder</span>}
                      {!paywalled && done && <span className="lab" style={{ color: "var(--green)" }}>Landed</span>}
                      {!paywalled && !done && !open && <Ico name="lock" w={13} sw={2.6}/>}
                    </span>
                  </button>;
                })}
              </div>)}
            </div>
          </div>;
        })}
      </div>
    </div>

    <div className="panel" style={{ padding: 20, background: free ? "var(--paper-2)" : "var(--lime)", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <span style={{ width: 46, height: 46, background: "var(--ink)", display: "grid", placeItems: "center", flex: "none" }}><Ico name="print" w={23} sw={2.2} style={{ color: "var(--paper)" }}/></span>
      <div style={{ minWidth: 200, flex: 1 }}>
        <div className="d" style={{ fontSize: 21 }}>Printable sheets</div>
        <p style={{ margin: "5px 0 0", fontSize: 14, color: "var(--ink-2)" }}>{free ? "Shredder riders can print their own list as the original A4 tracker sheets." : "Print your current list as A4 tracker sheets, four tricks a page."}</p>
      </div>
      <button className="btn" onClick={() => free ? go("plans") : act.toast("Sheet sent to your printer", "var(--sky)")}>{free ? "Unlock" : "Print my sheets"}</button>
    </div>
    <style>{`@media(max-width:800px){.pg-top,.pg-time{grid-template-columns:1fr!important}}`}</style>
  </div>;
}

function StickerWall({ s, stats, act, go, view, setView }) {
  const earned = earnedStickers(stats);
  const [open, setOpen] = React.useState(null);
  const [sharing, setSharing] = React.useState(null);
  const free = s.plan === "rookie";
  const two = sportsOf(s).length > 1;
  /* shared stickers sit on both walls, sport ones only on their own */
  const wall = stickersFor(sportsOf(s)).filter(x => !two || !x.sport || x.sport === view);
  const got = wall.filter(x => earned.includes(x.id));
  return <div>
    <SportTabs s={s} view={view} setView={setView} extra={id => stickersFor(sportsOf(s)).filter(x => (!x.sport || x.sport === id) && earned.includes(x.id)).length + " earned"}/>
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
      <div>
        <span className="eyebrow">Sticker wall{two ? " · " + SPORTS[view].label + " and shared" : ""}</span>
        <h1 className="d" style={{ fontSize: "clamp(30px,5vw,44px)", marginTop: 6 }}>{got.length} of {wall.length}</h1>
      </div>
      <div style={{ flex: 1, minWidth: 200, marginBottom: 6 }}><Bar pct={got.length / wall.length * 100} color="var(--pink)"/></div>
    </div>

    <div className="panel" style={{ padding: "26px 22px", background: "var(--ink)", marginBottom: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(118px,1fr))", gap: 18 }}>
        {wall.map(x => <StickerBadge key={x.id} s={x} earned={earned.includes(x.id)} onClick={() => setOpen(x)}/>)}
      </div>
    </div>

    <div className="panel" style={{ padding: 20, background: "var(--yellow)", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
      <div style={{ minWidth: 220, flex: 1 }}>
        <span className="tag" style={{ background: "var(--ink)" }}>Real vinyl</span>
        <div className="d" style={{ fontSize: 24, margin: "10px 0 6px" }}>Get them posted to your door</div>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--ink-2)", maxWidth: 460 }}>Crew Pass riders get a die-cut pack of everything they've earned, posted out every season. Stick them on your deck, not just your profile.</p>
      </div>
      <button className="btn ink" onClick={() => go("plans")}>{free ? "See Crew Pass" : "Manage delivery"}</button>
    </div>

    {open && <Modal onClose={() => setOpen(null)} w={400}>
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ width: 150, margin: "0 auto 18px" }}><StickerBadge s={open} earned={earned.includes(open.id)}/></div>
        <div className="d" style={{ fontSize: 26 }}>{open.name}</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 9 }}>{open.sport ? <SportTag sport={open.sport}/> : <span className="sportchip" style={{ borderColor: "var(--ink-3)", color: "var(--ink-3)" }}>Any sport</span>}</div>
        <p className="cond" style={{ margin: "8px 0 0", fontSize: 15, color: "var(--ink-2)", letterSpacing: ".04em" }}>{stickerCond(open)}</p>
        <div className="lab" style={{ marginTop: 14, color: earned.includes(open.id) ? "var(--green)" : "var(--ink-3)" }}>{earned.includes(open.id) ? "✓ Earned" : "Still locked"}</div>
        <div style={{ display: "flex", gap: 9, marginTop: 20 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => setOpen(null)}>Close</button>
          {earned.includes(open.id) && <button className="btn" style={{ flex: 1 }} onClick={() => { setSharing(open); setOpen(null); }}>Share it</button>}
        </div>
      </div>
    </Modal>}
    {sharing && <ShareCard kind="sticker" sticker={sharing} s={s} stats={stats} toast={act.toast} onClose={() => setSharing(null)}/>}
  </div>;
}

function Crew({ s, stats, act, go }) {
  const [inviting, setInviting] = React.useState(false);
  const board = CREW.map(c => c.me ? { ...c, name: s.name, handle: "@" + (s.name.split(" ")[0] || "you").toLowerCase(), landed: stats.global.landed, streak: s.streak } : c)
    .sort((a, b) => b.landed - a.landed);
  const feed = [
    { who: "Jonah", hue: "#8A3BE0", sport: "scooter", what: "landed a Double Whip", when: "20 min ago" },
    { who: "Ruby T.", hue: "#10A06A", sport: "skate", what: "moved Kickflip to Every time", when: "1 hr ago" },
    { who: "Nia F.", hue: "#FF5A8A", sport: "scooter", what: "moved Feeble Grind to Every time", when: "2 hrs ago" },
    { who: "Kofi B.", hue: "#3AC0FF", sport: "skate", what: "earned the Ledge Rat sticker", when: "Yesterday" },
    { who: "Sam O.", hue: "#FF9F1C", sport: "skate", what: "started learning the Tre Flip", when: "Yesterday" }
  ];
  return <div>
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <span className="eyebrow">{s.crew ? "Ramp Rats · 6 riders" : "Crew"}</span>
        <h1 className="d" style={{ fontSize: "clamp(30px,5vw,44px)", marginTop: 6 }}>{s.crew ? "Ramp Rats" : "Ride with mates"}</h1>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 9, flexWrap: "wrap" }}>
        <button className="btn sm ghost" onClick={() => go("rider", "me")}>Your public profile</button>
        <button className="btn sm" onClick={() => s.crew ? setInviting(true) : act.joinCrew()}>{s.crew ? "Invite a mate" : "Join a crew"}</button>
      </div>
    </div>

    {!s.crew && <div style={{ marginBottom: 22 }}>
      <Empty icon="users" title="You're riding solo" sub="Join a crew to see what your mates are landing and where you sit on the board. This one's a demo crew you can hop into." cta="Join Ramp Rats" onCta={act.joinCrew}/>
    </div>}

    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,340px)", gap: 20, opacity: s.crew ? 1 : .55, pointerEvents: s.crew ? "auto" : "none" }} className="crew-grid">
      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: "13px 16px", borderBottom: "3px solid var(--ink)", background: "var(--paper-2)" }}><span className="lab">This month's board</span></div>
        {board.map((c, i) => <button key={c.handle} onClick={() => go("rider", c.me ? "me" : c.handle)}
          style={{ width: "100%", textAlign: "left", border: "none", background: c.me ? "var(--yellow)" : "transparent", display: "flex", alignItems: "center", gap: 13, padding: "13px 16px", borderBottom: i < board.length - 1 ? "2px solid var(--wash)" : "none" }}>
          <span className="d" style={{ fontSize: 22, width: 26, color: i === 0 ? "var(--orange)" : "var(--ink-3)" }}>{i + 1}</span>
          <Av pic={c.me ? s.avatar : null} name={c.name} size={38} hue={c.hue}/>
          <div style={{ minWidth: 0 }}>
            <div className="cond" style={{ fontSize: 16 }}>{c.name.trim()}{c.me && " (you)"}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
              {(c.me ? sportsOf(s) : c.sports || []).map(x => <SportTag key={x} sport={x} sm/>)}
            </div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 18, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}><div className="d" style={{ fontSize: 20 }}>{c.streak}</div><div className="lab" style={{ fontSize: 9.5, color: "var(--ink-3)" }}>streak</div></div>
            <div style={{ textAlign: "right" }}><div className="d" style={{ fontSize: 20 }}>{c.landed}</div><div className="lab" style={{ fontSize: 9.5, color: "var(--ink-3)" }}>landed</div></div>
            <Ico name="back" w={16} sw={2.4} style={{ transform: "rotate(180deg)", color: "var(--ink-3)" }}/>
          </div>
        </button>)}
      </div>

      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: "13px 16px", borderBottom: "3px solid var(--ink)", background: "var(--paper-2)" }}><span className="lab">Just happened</span></div>
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>
          {feed.map((f, i) => <div key={i} style={{ display: "flex", gap: 11 }}>
            <span style={{ width: 32, height: 32, borderRadius: "50%", background: f.hue, border: "2.5px solid var(--ink)", display: "grid", placeItems: "center", fontFamily: "var(--fd)", fontSize: 13, color: "#fff", flex: "none" }}>{f.who[0]}</span>
            <div>
              <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.35 }}>
                <button onClick={() => { const m = CREW.find(c => c.name === f.who); m && go("rider", m.handle); }}
                  style={{ background: "none", border: "none", padding: 0, font: "inherit", fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 3 }}>{f.who}</button> {f.what}</p>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                <span className="lab" style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: ".1em" }}>{f.when}</span>
                <SportTag sport={f.sport} sm/>
              </div>
            </div>
          </div>)}
        </div>
      </div>
    </div>
    {inviting && <InviteCard s={s} crew="Ramp Rats" toast={act.toast} onClose={() => setInviting(false)}/>}
    <style>{`@media(max-width:860px){.crew-grid{grid-template-columns:1fr!important}}`}</style>
  </div>;
}

function Challenge({ s, stats, act, go, view, setView }) {
  const free = s.plan === "rookie";
  const logged = id => (s.challengeLogged || {})[id] || 0;
  const all = challengesFor(view);
  const chal = liveChallenge(view);
  const state = chal ? chalState(chal) : null;
  const n = chal ? logged(chal.id) : 0;
  const done = chal && n >= chal.goal;
  const upcoming = all.filter(c => chalState(c) === "upcoming" && (!chal || c.id !== chal.id));
  const past = all.filter(c => chalState(c) === "past").reverse();
  const other = sportsOf(s).find(x => x !== view);

  return <div>
    <SportTabs s={s} view={view} setView={setView} extra={id => (liveChallenge(id) || {}).title}/>
    <span className="eyebrow">Weekly challenge · {SPORTS[view].label}</span>
    <h1 className="d" style={{ fontSize: "clamp(30px,5vw,44px)", margin: "6px 0 18px" }}>{chal ? chal.week : "Nothing scheduled"}</h1>

    {chal ? <div className="panel" style={{ padding: 0, overflow: "hidden", marginBottom: 26 }}>
      <div style={{ background: chal.hue, padding: "24px 22px", borderBottom: "3px solid var(--ink)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
          <span className="tag" style={{ background: state === "live" ? "var(--ink)" : "var(--paper)", color: state === "live" ? "#fff" : "var(--ink)" }}>{state === "live" ? "Live now" : "Starts soon"}</span>
          <span className="lab" style={{ color: "var(--ink)" }}>{chalRange(chal)}</span>
        </div>
        <div className="d" style={{ fontSize: "clamp(32px,6vw,54px)", color: "#fff", textShadow: "3px 3px 0 var(--ink)" }}>{chal.title}</div>
        <p style={{ margin: "12px 0 0", fontSize: 16, maxWidth: 540, lineHeight: 1.45 }}>{chal.blurb}</p>
      </div>
      <div style={{ padding: 22, display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
            <span className="lab">Your progress</span><span className="lab">{n} / {chal.goal}</span>
          </div>
          <Bar pct={n / chal.goal * 100} color={chal.hue}/>
          <p className="cond" style={{ margin: "10px 0 0", fontSize: 14, color: "var(--ink-2)", letterSpacing: ".03em" }}>Reward · {chal.reward} · {chal.riders}</p>
        </div>
        <button className="btn" disabled={done || state !== "live"} onClick={() => act.logChallenge(chal.id)}>
          {state !== "live" ? "Opens " + chalRange(chal).split(" to ")[0] : done ? "✓ Done this week" : chal.verb}
        </button>
      </div>
    </div> : <Empty icon="bolt" title="No challenge running" sub={"Nothing scheduled for " + SPORTS[view].label.toLowerCase() + " right now. Staff set these a few weeks ahead."}/>}

    {other && <div className="panel flat" style={{ padding: "14px 16px", marginBottom: 26, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--paper-2)" }}>
      <span className="lab">The other one</span>
      <span className="cond" style={{ fontSize: 15 }}>{(liveChallenge(other) || {}).title || "Nothing on"}</span>
      {liveChallenge(other) && <span className="lab" style={{ color: "var(--ink-3)" }}>{logged(liveChallenge(other).id)} of {liveChallenge(other).goal} logged</span>}
      <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => setView(other)}>Switch to it</button>
    </div>}

    {upcoming.length > 0 && <div style={{ marginBottom: 28 }}>
      <SecHead>Coming up</SecHead>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
        {upcoming.map(c => <div key={c.id} className="panel flat" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 8, background: c.hue, borderBottom: "2.5px solid var(--ink)" }}/>
          <div style={{ padding: 15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="lab" style={{ color: "var(--ink-3)" }}>{c.week}</span>
              <span className="lab" style={{ color: "var(--ink-3)", marginLeft: "auto" }}>{chalRange(c)}</span>
            </div>
            <div className="d" style={{ fontSize: 21, margin: "8px 0 7px" }}>{c.title}</div>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: "var(--ink-2)" }}>{c.blurb}</p>
          </div>
        </div>)}
      </div>
    </div>}

    <SecHead>Past weeks</SecHead>
    <div style={{ position: "relative" }}>
      {past.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 14, filter: free ? "blur(3px)" : "none", pointerEvents: free ? "none" : "auto" }}>
        {past.map(c => {
          const got = logged(c.id), win = got >= c.goal;
          return <div key={c.id} className="panel flat" style={{ padding: 15 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="lab" style={{ color: "var(--ink-3)" }}>{c.week}</span>
              <span className="lab" style={{ color: "var(--ink-3)", marginLeft: "auto" }}>{chalRange(c)}</span>
            </div>
            <div className="d" style={{ fontSize: 20, margin: "7px 0 9px" }}>{c.title}</div>
            <span className="tag" style={{ background: win ? "var(--green)" : got ? "#FF9F1C" : "var(--ink-3)" }}>{win ? "Completed" : got ? got + " of " + c.goal : "Missed"}</span>
          </div>;
        })}
      </div> : <Empty icon="bolt" title="No history yet" sub="Finished weeks land here with what you managed."/>}
      {free && past.length > 0 && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center", background: "var(--paper)", border: "3px solid var(--ink)", boxShadow: "5px 5px 0 var(--ink)", padding: "18px 22px" }}>
          <div className="d" style={{ fontSize: 20 }}>Challenge history</div>
          <p className="cond" style={{ margin: "6px 0 12px", fontSize: 13.5, color: "var(--ink-2)" }}>Kept on Shredder and above</p>
          <button className="btn sm" onClick={() => go("plans")}>See plans</button>
        </div>
      </div>}
    </div>
  </div>;
}

function Parks({ s, act, view, setView }) {
  const [q, setQ] = React.useState("");
  const [onlyMine, setOnlyMine] = React.useState(true);
  const [sel, setSel] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", town: "", type: "Street spot", tags: "", coords: "", sports: sportsOf(s).slice() });
  const isAdmin = new URLSearchParams(location.search).get("admin") === "1";
  const match = p => (p.name + p.town + p.tags.join(" ")).toLowerCase().includes(q.toLowerCase()) && (!onlyMine || !p.sports || p.sports.includes(view));
  const list = PARKS.filter(match);
  const pending = (s.submittedSpots || []).filter(match);
  const submit = () => {
    if (!form.name.trim() || !form.town.trim()) return;
    act.addSpot({ name: form.name.trim(), town: form.town.trim(), type: form.type, dist: "New", ...(parseCoords(form.coords) || {}), sports: form.sports.length ? form.sports : sportsOf(s), tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) });
    setForm({ name: "", town: "", type: "Street spot", tags: "", coords: "", sports: sportsOf(s).slice() });
    setShowForm(false);
  };
  const pin = list.find(p => p.name === sel && hasCoords(p)) || list.find(hasCoords);
  return <div>
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
      <div>
        <span className="eyebrow">Spots</span>
        <h1 className="d" style={{ fontSize: "clamp(30px,5vw,44px)", margin: "6px 0 0" }}>Where to ride</h1>
      </div>
      <button className="btn sm ink" onClick={() => setShowForm(v => !v)}>{showForm ? "Cancel" : "+ Add a spot"}</button>
    </div>
    {showForm && <div className="panel flat" style={{ padding: 15, marginBottom: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Spot name" style={{ padding: "9px 12px", border: "2.5px solid var(--ink)", font: "inherit" }}/>
      <input value={form.town} onChange={e => setForm({ ...form, town: e.target.value })} placeholder="Town" style={{ padding: "9px 12px", border: "2.5px solid var(--ink)", font: "inherit" }}/>
      <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={{ padding: "9px 12px", border: "2.5px solid var(--ink)", font: "inherit" }}>
        <option>Street spot</option><option>Indoor park</option><option>Concrete</option>
      </select>
      <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="Tags, comma separated (e.g. Bowl, Ledges)" style={{ padding: "9px 12px", border: "2.5px solid var(--ink)", font: "inherit" }}/>
      <input value={form.coords} onChange={e => setForm({ ...form, coords: e.target.value })} placeholder="Paste a Google Maps link, or 53.4084, -2.9916" style={{ padding: "9px 12px", border: "2.5px solid var(--ink)", font: "inherit" }}/>
      {form.coords && !parseCoords(form.coords) && <span className="lab" style={{ color: "var(--red)" }}>Can't read a location out of that</span>}
      <div>
        <div className="lab" style={{ marginBottom: 8 }}>Who's it good for?</div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {SPORT_IDS.map(x => <button key={x} className={"pill" + (form.sports.includes(x) ? " on" : "")}
            onClick={() => setForm({ ...form, sports: form.sports.includes(x) ? form.sports.filter(y => y !== x) : [...form.sports, x] })}>{SPORTS[x].label}</button>)}
        </div>
      </div>
      <button className="btn sm wide ink" onClick={submit}>Submit spot</button>
      <p className="cond" style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)" }}>Submitted spots are reviewed before they go on the map, so people can't just make places up.</p>
    </div>}
    <div className="search" style={{ marginBottom: 12 }}>
      <Ico name="search" w={19} sw={2.6}/>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Town, park name or feature…"/>
    </div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
      <span className="lab" style={{ color: "var(--ink-3)" }}>Show</span>
      <button className={"pill" + (onlyMine ? " on" : "")} onClick={() => setOnlyMine(true)}>Good for {SPORTS[view].short}</button>
      <button className={"pill" + (!onlyMine ? " on" : "")} onClick={() => setOnlyMine(false)}>Every spot</button>
      {sportsOf(s).length > 1 && onlyMine && <button className="pill" onClick={() => setView(sportsOf(s).find(x => x !== view))}>Switch to {SPORTS[sportsOf(s).find(x => x !== view)].short}</button>}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 20 }} className="parks-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {list.map(p => <div key={p.name} onClick={() => setSel(p.name)} className="panel flat"
          style={{ padding: 15, display: "flex", gap: 14, alignItems: "flex-start", cursor: hasCoords(p) ? "pointer" : "default", background: (pin && pin.name === p.name) ? "var(--paper-2)" : "var(--paper)", boxShadow: (pin && pin.name === p.name) ? "5px 5px 0 var(--ink)" : "3px 3px 0 var(--ink)" }}>
          <span style={{ width: 40, height: 40, background: "var(--sky)", border: "2.5px solid var(--ink)", display: "grid", placeItems: "center", flex: "none" }}><Ico name="map" w={20} sw={2.2}/></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="d" style={{ fontSize: 19 }}>{p.name}</div>
            <div className="lab" style={{ color: "var(--ink-3)", margin: "4px 0 8px" }}>{p.town} · {p.type} · {p.dist}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {p.tags.map(t => <span key={t} className="tag" style={{ background: "var(--ink)", fontSize: 10 }}>{t}</span>)}
              {(p.sports || []).map(x => <SportTag key={x} sport={x} sm/>)}
            </div>
            {hasCoords(p) && <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn sm ghost" onClick={e => { e.stopPropagation(); setSel(p.name); }}>Show on map</button>
              <a className="cond" href={mapLink(p)} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} style={{ fontSize: 13, letterSpacing: ".05em" }}>Directions</a>
            </div>}
          </div>
        </div>)}
        {!list.length && !pending.length && <Empty icon="map" title="No spots there yet" sub="Riders add the spots. Tell us about yours and it goes on the map." cta="Add a spot" onCta={() => setShowForm(true)}/>}
        {pending.map((p, i) => <div key={p.name + i} className="panel flat" style={{ padding: 15, display: "flex", gap: 14, alignItems: "flex-start", opacity: .8 }}>
          <span style={{ width: 40, height: 40, background: "var(--paper-2)", border: "2.5px solid var(--ink)", display: "grid", placeItems: "center", flex: "none" }}><Ico name="map" w={20} sw={2.2}/></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="d" style={{ fontSize: 19 }}>{p.name}</div>
            <div className="lab" style={{ color: "var(--ink-3)", margin: "4px 0 8px" }}>{p.town} · {p.type} · Pending review</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: isAdmin ? 10 : 0 }}>{p.tags.map(t => <span key={t} className="tag" style={{ background: "var(--ink-3)", fontSize: 10 }}>{t}</span>)}</div>
            {isAdmin && <div style={{ display: "flex", gap: 8 }}>
              <button className="btn sm ink" onClick={() => act.approveSpot(s.submittedSpots.indexOf(p))}>Approve</button>
              <button className="btn sm ghost" onClick={() => act.rejectSpot(s.submittedSpots.indexOf(p))}>Reject</button>
            </div>}
          </div>
        </div>)}
      </div>
      <div className="panel" style={{ padding: 0, minHeight: 340, display: "flex", flexDirection: "column", position: "sticky", top: 84 }}>
        <div style={{ padding: "11px 16px", borderBottom: "3px solid var(--ink)", background: "var(--paper-2)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="lab">Map</span>
          {pin && <span className="cond" style={{ fontSize: 14 }}>{pin.name}</span>}
          {pin && <a className="cond" href={mapLink(pin)} target="_blank" rel="noopener" style={{ marginLeft: "auto", fontSize: 13, letterSpacing: ".05em" }}>Open in Maps</a>}
        </div>
        {pin ? <iframe title={"Map of " + pin.name} src={mapEmbed(pin)} loading="lazy" referrerPolicy="no-referrer-when-downgrade"
          style={{ border: 0, width: "100%", flex: 1, minHeight: 320, display: "block" }}/>
          : <Slot label="No spot on this list has coordinates yet" h={300} style={{ flex: 1, border: "none" }}/>}
        <div style={{ padding: "10px 14px", borderTop: "3px solid var(--ink)" }}>
          <p className="cond" style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)", letterSpacing: ".03em" }}>Tap a spot to move the map. Plotting every spot at once needs a Maps API key, which comes with the real build.</p>
        </div>
      </div>
    </div>
    <style>{`@media(max-width:860px){.parks-grid{grid-template-columns:1fr!important}}`}</style>
  </div>;
}

Object.assign(window, { Progress, StickerWall, Crew, Challenge, Parks });
