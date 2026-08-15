/* Land It. Membership, Profile, Coach view */

function Plans({ s, act, go }) {
  const [annual, setAnnual] = React.useState(false);
  const price = p => {
    if (p.price === "Free") return "Free";
    const n = parseFloat(p.price.replace("£", ""));
    return annual ? "£" + (n * 10).toFixed(2) : p.price;
  };
  return <div>
    <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 26px" }}>
      <span className="eyebrow">Membership</span>
      <h1 className="d" style={{ fontSize: "clamp(32px,6vw,52px)", margin: "8px 0 10px" }}>A free tier that isn't a trial</h1>
      <p style={{ margin: 0, color: "var(--ink-2)", fontSize: 16.5, lineHeight: 1.5 }}>Both libraries up to the Easy tier, full tracking and the sticker wall cost nothing, forever. Paying opens the harder tiers, saves your clips, and puts vinyl through the letterbox.</p>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", border: "3px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)" }}>
          {[["Monthly", false], ["Yearly", true]].map(([l, v]) => <button key={l} onClick={() => setAnnual(v)} className="cond"
            style={{ padding: "9px 20px", fontSize: 13.5, background: annual === v ? "var(--ink)" : "var(--paper)", color: annual === v ? "var(--paper)" : "var(--ink)", border: "none" }}>{l}</button>)}
        </div>
        <span className="tag tilt" style={{ background: "var(--lime)", color: "var(--ink)" }}>2 months free</span>
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: 18, alignItems: "start" }}>
      {PLANS.map(p => {
        const current = s.plan === p.id;
        return <div key={p.id} className="panel" style={{ padding: 0, overflow: "hidden", boxShadow: p.popular ? "7px 7px 0 var(--ink)" : "var(--sh)", transform: p.popular ? "translateY(-6px)" : "none" }}>
          <div style={{ background: p.hue, padding: "18px 20px", borderBottom: "3px solid var(--ink)", position: "relative" }}>
            {p.popular && <span className="tag tilt" style={{ background: "var(--ink)", position: "absolute", top: -1, right: 12 }}>Most riders</span>}
            <div className="d" style={{ fontSize: 30, color: "#fff", textShadow: "2.5px 2.5px 0 var(--ink)" }}>{p.name}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 10 }}>
              <span className="d" style={{ fontSize: 34 }}>{price(p)}</span>
              <span className="lab" style={{ color: "var(--ink)" }}>{p.price === "Free" ? p.per : annual ? "per year" : p.per}</span>
            </div>
          </div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.45, color: "var(--ink-2)" }}>{p.pitch}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {p.perks.map(x => <div key={x} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                <span style={{ width: 17, height: 17, background: p.hue, border: "2px solid var(--ink)", display: "grid", placeItems: "center", flex: "none", marginTop: 1 }}><Ico name="check" w={10} sw={3.6} style={{ color: "#fff" }}/></span>
                <span style={{ fontSize: 14.5, lineHeight: 1.35 }}>{x}</span>
              </div>)}
              {p.missing.map(x => <div key={x} style={{ display: "flex", gap: 9, alignItems: "flex-start", opacity: .45 }}>
                <span style={{ width: 17, height: 17, border: "2px solid var(--ink-3)", flex: "none", marginTop: 1 }}/>
                <span style={{ fontSize: 14.5, lineHeight: 1.35, textDecoration: "line-through" }}>{x}</span>
              </div>)}
            </div>
            <button className={"btn wide" + (current ? " ghost" : p.id === "rookie" ? " ghost" : "")} disabled={current}
              style={!current && p.id !== "rookie" ? { background: p.hue } : null}
              onClick={() => act.setPlan(p.id)}>{current ? "Your plan" : p.id === "rookie" ? "Downgrade" : "Get " + p.name}</button>
          </div>
        </div>;
      })}
    </div>

    <div className="panel" style={{ marginTop: 26, padding: 20, background: "var(--paper-2)" }}>
      <div className="d" style={{ fontSize: 20, marginBottom: 12 }}>Questions we get asked</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 18 }}>
        {[["Does the free tier expire?", "No. No trial timer, no card needed. It stays free."],
          ["Can a parent pay?", "Crew Pass covers five riders and gives the bill-payer a coach view of everyone's progress."],
          ["What are the real stickers?", "Die-cut vinyl of the ones you've actually earned, posted every season on Crew Pass."],
          ["Can I cancel?", "Any time, in one tap. Your tracked tricks and stickers stay put."]].map(([q, a]) =>
          <div key={q}><div className="cond" style={{ fontSize: 15.5, marginBottom: 5 }}>{q}</div><p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: "var(--ink-2)" }}>{a}</p></div>)}
      </div>
    </div>
  </div>;
}

function Profile({ s, stats, act, go }) {
  const [picking, setPicking] = React.useState(false);
  const plan = PLANS.find(p => p.id === s.plan);
  const earned = earnedStickers(stats);
  const level = LEVELS.find(l => l.id === s.level);
  const g = stats.global;
  const mySports = sportsOf(s);
  return <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ background: "var(--ink)", padding: "24px 22px", display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "none" }}>
          <Av pic={s.avatar} name={s.name} size={74} rw={4} ring="var(--paper)" onClick={() => setPicking(true)} title="Change your picture"/>
          <span style={{ position: "absolute", bottom: -4, right: -4, width: 26, height: 26, borderRadius: "50%", background: "var(--yellow)", border: "2.5px solid var(--ink)", display: "grid", placeItems: "center", pointerEvents: "none" }}><Ico name="plus" w={13} sw={3.4}/></span>
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="d" style={{ fontSize: 34, color: "var(--paper)" }}>{s.name}</div>
          <div className="lab" style={{ color: "#C9C2B4", marginTop: 6 }}>@{(s.name.split(" ")[0] || "rider").toLowerCase()} · {level ? level.label : "Rider"}{s.stance ? " · " + STANCES.find(x => x.id === s.stance).label : ""}</div>
          <button className="cond" onClick={() => setPicking(true)} style={{ background: "none", border: "none", padding: 0, marginTop: 6, color: "var(--yellow)", fontSize: 13, textDecoration: "underline", textUnderlineOffset: 3, letterSpacing: ".05em" }}>{s.avatar ? "Change picture" : "Choose a picture"}</button>
        </div>
        <span className="tag tilt" style={{ background: plan.hue, marginLeft: "auto", fontSize: 12, padding: "5px 12px" }}>{plan.name}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))" }}>
        {[[g.landed, "Landed"], [g.mastered, "Every time"], [s.streak, "Day streak"], [earned.length, "Stickers"], [g.clips, "Clips"]].map(([n, l], i) =>
          <div key={l} style={{ padding: "16px 14px", borderRight: i < 4 ? "2.5px solid var(--ink)" : "none", borderTop: "3px solid var(--ink)" }}>
            <div className="d" style={{ fontSize: 28 }}>{n}</div><div className="lab" style={{ color: "var(--ink-3)", marginTop: 4 }}>{l}</div>
          </div>)}
      </div>
    </div>

    <div className="panel flat" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="lab">Your picture</div>
        <span className="lab" style={{ color: "var(--ink-3)" }}>{AVATARS.length} built in</span>
        <a className="cond" href="Land It - Avatars.html" style={{ fontSize: 13, letterSpacing: ".05em" }}>See the whole set →</a>
        <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => setPicking(true)}>Change</button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {AVATARS.slice(0, 12).map(a => <button key={a.id} onClick={() => act.set({ avatar: a.id })} title={a.name}
          style={{ background: "none", border: "none", padding: 0 }}>
          <Av pic={a.id} size={46} rw={s.avatar === a.id ? 4 : 2.5} ring={s.avatar === a.id ? "var(--orange)" : "var(--ink)"}/>
        </button>)}
      </div>
  <p style={{ margin: "12px 0 0", fontSize: 13.5, color: "var(--ink-3)" }}>Uploading your own photo lands in a later release.</p>
    </div>

    <div className="panel flat" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <div className="lab">What you ride</div>
        <span className="lab" style={{ color: "var(--ink-3)" }}>{mySports.length > 1 ? "Both libraries on, every page tabbed" : "One library"}</span>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--ink-2)" }}>Turning a sport off hides its library, stickers and challenge. Nothing you've tracked is deleted.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} className="sportpick">
        {SPORT_IDS.map(id => {
          const sp = SPORTS[id], on = mySports.includes(id), only = on && mySports.length === 1;
          return <button key={id} onClick={() => !only && act.setSports(on ? mySports.filter(x => x !== id) : [...mySports, id])}
            className="panel flat" title={only ? "Keep at least one" : ""}
            style={{ padding: "14px 15px", textAlign: "left", display: "flex", alignItems: "center", gap: 12, background: on ? sp.color : "var(--paper)", color: on ? "#fff" : "var(--ink)", opacity: only ? .9 : 1, cursor: only ? "default" : "pointer" }}>
            <span style={{ width: 34, height: 34, border: "2.5px solid var(--ink)", background: on ? "var(--paper)" : "var(--wash)", display: "grid", placeItems: "center", flex: "none" }}>
              <Ico name={sp.icon} w={19} sw={2.3} style={{ color: "var(--ink)" }}/>
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="cond" style={{ fontSize: 16, display: "block" }}>{sp.label}</span>
              <span className="lab" style={{ opacity: .85 }}>{on ? stats.bySport[id].landed + " of " + stats.bySport[id].total + " landed" : "Off"}</span>
            </span>
          </button>;
        })}
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18 }}>
      <div className="panel flat" style={{ padding: 18 }}>
        <div className="lab" style={{ marginBottom: 12 }}>Riding goal</div>
        <GoalPicker sports={mySports} goal={s.goal} custom={s.goalCustom}
          onGoal={id => act.set({ goal: id })} onCustom={v => act.set({ goalCustom: v })}/>
      </div>
      <div className="panel flat" style={{ padding: 18 }}>
        <div className="lab" style={{ marginBottom: 4 }}>Stance</div>
        <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--ink-2)" }}>Which foot leads. Tips are written for your stance.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {STANCES.map(st => <button key={st.id} className="pill" onClick={() => act.setStance(s.stance === st.id ? null : st.id)}
            title={st.sub} style={s.stance === st.id ? { background: "var(--ink)", color: "var(--paper)", boxShadow: "3px 3px 0 var(--ink)" } : null}>{st.label}</button>)}
        </div>
        {s.stance && <p className="cond" style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--ink-3)", letterSpacing: ".03em" }}>{STANCES.find(x => x.id === s.stance).sub}</p>}
      </div>
      <div className="panel flat" style={{ padding: 18 }}>
        <div className="lab" style={{ marginBottom: 12 }}>Riding level</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {LEVELS.map(l => <button key={l.id} className="pill" onClick={() => act.set({ level: l.id })}
            style={s.level === l.id ? { background: l.hue, boxShadow: "3px 3px 0 var(--ink)" } : null}>{l.label}</button>)}
        </div>
      </div>
    </div>

    <div className="panel flat" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <div className="lab">Who can see your profile</div>
        <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={() => go("rider", "me")}>View your profile</button>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--ink-2)" }}>Your tricks, stickers and streak. Never your email, your clips or your surname.</p>
      <div style={{ display: "grid", gap: 10 }}>
        {PRIVACY.map(p => {
          const on = s.privacy === p.id;
          return <button key={p.id} onClick={() => act.setPrivacy(p.id)} className="panel flat"
            style={{ padding: "13px 15px", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 13, background: on ? "var(--paper-2)" : "var(--paper)", boxShadow: on ? "4px 4px 0 var(--ink)" : "2px 2px 0 var(--ink)" }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", border: "3px solid var(--ink)", background: on ? "var(--ink)" : "var(--paper)", flex: "none", marginTop: 2 }}/>
            <span style={{ minWidth: 0 }}>
              <span className="cond" style={{ fontSize: 15.5, display: "block" }}>{p.label}</span>
              <span style={{ fontSize: 13.5, lineHeight: 1.45, color: "var(--ink-2)" }}>{p.blurb}</span>
            </span>
          </button>;
        })}
      </div>
    </div>

    <div className="panel flat" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div className="lab">Coach / parent view</div>
        <span className="tag" style={{ background: s.plan === "crew" ? "var(--green)" : "var(--violet)", fontSize: 10 }}>{s.plan === "crew" ? "On" : "Crew Pass"}</span>
        <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => s.plan === "crew" ? go("coach") : go("plans")}>{s.plan === "crew" ? "Open coach view" : "Unlock"}</button>
      </div>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: "var(--ink-2)", maxWidth: 620 }}>A read-only summary a parent or coach can check: what's being worked on, how consistent it is, how much of it is the risky stuff, and whether they've been riding at all this week.</p>
    </div>

    <div className="panel flat" style={{ padding: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ width: 34, height: 34, background: "var(--violet)", border: "2.5px solid var(--ink)", display: "grid", placeItems: "center", flex: "none" }}><Ico name="lock" w={17} sw={2.6} style={{ color: "#fff" }}/></span>
      <div style={{ minWidth: 180, flex: 1 }}>
        <div className="lab">Staff portal</div>
        <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--ink-2)" }}>Rider accounts, plan overrides, the trick library and the spot queue. Land It staff only.</p>
      </div>
      <button className="btn sm ink" onClick={() => go("admin")}>Open portal</button>
    </div>

    <div className="panel flat" style={{ padding: 18, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div className="lab" style={{ marginBottom: 5 }}>Account</div>
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink-2)" }}>On {plan.name}. Everything is stored on this device for the prototype.</p>
      </div>
      <button className="btn sm ghost" onClick={() => go("plans")}>Change plan</button>
      <button className="btn sm ghost" onClick={act.reset}>Reset progress</button>
      <button className="btn sm ink" onClick={act.signOut}>Sign out</button>
    </div>

    {picking && <AvatarPicker value={s.avatar} name={s.name} onClose={() => setPicking(false)} onPick={id => act.set({ avatar: id })}/>}
  </div>;
}

function CoachView({ s, stats, go }) {
  const g = stats.global;
  const risky = g.landedIds.map(trickById).filter(t => t && t.diff === 5).length;
  const active = s.lastRide === new Date().toDateString();
  const working = Object.keys(s.byId).filter(id => s.byId[id] === "trying").map(trickById).filter(Boolean);
  const mySports = sportsOf(s);
  return <div>
    <button className="cond" onClick={() => go("profile")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 7, padding: 0, marginBottom: 14, color: "var(--ink-3)", fontSize: 13.5 }}><Ico name="back" w={16}/> Profile</button>
    <span className="eyebrow">Coach / parent view · read only</span>
    <h1 className="d" style={{ fontSize: "clamp(28px,5vw,42px)", margin: "6px 0 18px" }}>{s.name}'s week</h1>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 22 }}>
      {[["Rode today", active ? "Yes" : "Not yet", active ? "var(--lime)" : "var(--paper-2)"],
        ["Streak", s.streak + " days", "var(--yellow)"],
        ["Rides", mySports.map(x => SPORTS[x].label).join(" and "), "var(--paper-2)"],
        ["Tricks landed", g.landed + " of " + mySports.reduce((n, x) => n + stats.bySport[x].total, 0), "var(--sky)"],
        ["Difficulty 5 tricks", String(risky), risky ? "#FFB3C9" : "var(--paper-2)"]].map(([l, v, hue]) =>
        <div key={l} className="panel flat" style={{ padding: 16, background: hue }}>
          <div className="lab" style={{ color: "var(--ink-2)" }}>{l}</div>
          <div className="d" style={{ fontSize: v.length > 12 ? 19 : 28, marginTop: 7 }}>{v}</div>
        </div>)}
    </div>
    <div className="panel" style={{ padding: 20 }}>
      <div className="lab" style={{ marginBottom: 12 }}>Currently working on</div>
      {working.length ? <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {working.map(t => <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="tag" style={{ background: catColor(t.cat), fontSize: 10 }}>{CATS[t.cat].label}</span>
          <span className="cond" style={{ fontSize: 16 }}>{t.name}</span>
          <SportTag sport={t.sport} sm/>
          <span style={{ flex: 1, height: 3, background: "var(--wash)" }}/>
          <Diff n={t.diff} sm/>
          {t.diff >= 5 && <span className="lab" style={{ color: "var(--red)" }}>Supervise</span>}
        </div>)}
      </div> : <p style={{ margin: 0, color: "var(--ink-2)" }}>Nothing logged as in progress this week.</p>}
      <p style={{ margin: "18px 0 0", fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.5, borderTop: "2.5px solid var(--wash)", paddingTop: 14 }}>
        Difficulty 4 and 5 tricks involve inverts and drops. The library flags which of those should be learned into a foam pit or resi ramp first.
      </p>
    </div>
  </div>;
}

Object.assign(window, { Plans, Profile, CoachView });
