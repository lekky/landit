/* Land It. Events and competitions */

const evDate = iso => {
  const d = new Date(iso + "T00:00:00");
  return { day: d.getDate(), month: d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase(),
    full: d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }), ts: d.getTime() };
};
const EV_KINDS = { Comp: "#FF5A1F", Session: "#10A06A", Class: "#246BFF", Jam: "#8A3BE0" };

function Events({ s, act, go, view, setView }) {
  const [kind, setKind] = React.useState("all");
  const [onlyMine, setOnlyMine] = React.useState(true);
  const [open, setOpen] = React.useState(null);
  const going = s.eventsGoing || [];

  const list = EVENTS
    .filter(e => (kind === "all" || e.kind === kind) && (!onlyMine || (e.sports || []).includes(view)))
    .sort((a, b) => evDate(a.date).ts - evDate(b.date).ts);
  const kinds = [...new Set(EVENTS.map(e => e.kind))];

  return <div>
    <SportTabs s={s} view={view} setView={setView} extra={id => EVENTS.filter(e => (e.sports || []).includes(id)).length + " on"}/>
    <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
      <div>
        <span className="eyebrow">Events</span>
        <h1 className="d" style={{ fontSize: "clamp(30px,5vw,44px)", marginTop: 6 }}>What's coming up</h1>
      </div>
      <p className="note" style={{ margin: "0 0 6px", maxWidth: 380, fontSize: 14.5, lineHeight: 1.45, color: "var(--ink-2)" }}>
        Comps, coached sessions and one-skill classes near you. Staff add them, so the list stays real.
      </p>
    </div>

    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 18 }}>
      <button className={"pill" + (kind === "all" ? " on" : "")} onClick={() => setKind("all")}>Everything</button>
      {kinds.map(k => <button key={k} className="pill" onClick={() => setKind(k)}
        style={kind === k ? { background: EV_KINDS[k] || "var(--ink)", color: "#fff", boxShadow: "3px 3px 0 var(--ink)" } : null}>{k}</button>)}
      <span style={{ flex: 1 }}/>
      <button className={"pill" + (onlyMine ? " on" : "")} onClick={() => setOnlyMine(v => !v)}>{onlyMine ? "Good for " + SPORTS[view].short : "Every sport"}</button>
    </div>

    {list.length ? <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {list.map(e => {
        const d = evDate(e.date), hue = EV_KINDS[e.kind] || "var(--ink)", on = going.includes(e.id);
        return <div key={e.id} className="panel flat" style={{ padding: 0, display: "flex", alignItems: "stretch", overflow: "hidden" }}>
          <div style={{ background: hue, borderRight: "3px solid var(--ink)", padding: "14px 12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: "none", minWidth: 74, color: "#fff" }}>
            <span className="d" style={{ fontSize: 30, lineHeight: .9, textShadow: "2px 2px 0 var(--ink)" }}>{d.day}</span>
            <span className="lab" style={{ marginTop: 4 }}>{d.month}</span>
          </div>
          <div style={{ padding: "13px 15px", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", flex: 1, minWidth: 0 }}>
            <div style={{ minWidth: 180, flex: 1 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                <span className="tag" style={{ background: hue, fontSize: 10 }}>{e.kind}</span>
                {(e.sports || []).map(x => <SportTag key={x} sport={x} sm/>)}
              </div>
              <div className="d" style={{ fontSize: 21 }}>{e.name}</div>
              <div className="lab" style={{ color: "var(--ink-3)", marginTop: 5 }}>{e.venue} · {e.town} · {e.level}</div>
            </div>
            <div style={{ textAlign: "right", minWidth: 92 }}>
              <div className="cond" style={{ fontSize: 15 }}>{e.price}</div>
              <div className="lab" style={{ color: "var(--ink-3)", marginTop: 3 }}>{e.spots}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn sm ghost" onClick={() => setOpen(e)}>Details</button>
              <button className="btn sm" style={on ? { background: "var(--green)" } : null} onClick={() => act.toggleEvent(e)}>{on ? "✓ Going" : "I'm going"}</button>
            </div>
          </div>
        </div>;
      })}
    </div> : <Empty icon="flag" title="Nothing listed yet" sub={"No " + SPORTS[view].short.toLowerCase() + " events on the calendar for that filter. Try every sport, or check back."} cta="Show everything" onCta={() => { setKind("all"); setOnlyMine(false); }}/>}

    {going.length > 0 && <div className="panel" style={{ padding: 18, marginTop: 22, background: "var(--paper-2)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <span style={{ width: 40, height: 40, background: "var(--yellow)", border: "2.5px solid var(--ink)", display: "grid", placeItems: "center", flex: "none" }}><Ico name="flag" w={21} sw={2.3}/></span>
      <div style={{ minWidth: 200, flex: 1 }}>
        <div className="cond" style={{ fontSize: 15.5 }}>You're down for {going.length} event{going.length === 1 ? "" : "s"}</div>
        <p style={{ margin: "3px 0 0", fontSize: 14, color: "var(--ink-2)" }}>Entry and payment happen at the venue for now. We'll add booking once organisers are on board.</p>
      </div>
    </div>}

    {open && <Modal onClose={() => setOpen(null)} w={460}>
      <div style={{ padding: 0 }}>
        <div style={{ background: EV_KINDS[open.kind] || "var(--ink)", padding: "20px 20px 18px", borderBottom: "3px solid var(--ink)" }}>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 10 }}>
            <span className="tag" style={{ background: "var(--ink)" }}>{open.kind}</span>
            {(open.sports || []).map(x => <span key={x} className="tag" style={{ background: "var(--paper)", color: "var(--ink)" }}>{SPORTS[x].label}</span>)}
          </div>
          <div className="d" style={{ fontSize: 30, color: "#fff", textShadow: "2.5px 2.5px 0 var(--ink)" }}>{open.name}</div>
          <div className="lab" style={{ color: "var(--ink)", marginTop: 8 }}>{evDate(open.date).full}</div>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.5, color: "var(--ink-2)" }}>{open.blurb}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["Where", open.venue + ", " + open.town], ["Who for", open.level], ["Cost", open.price], ["Places", open.spots]].map(([l, val]) =>
              <div key={l}><div className="lab" style={{ color: "var(--ink-3)" }}>{l}</div><div className="cond" style={{ fontSize: 15, marginTop: 3 }}>{val}</div></div>)}
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn ghost" onClick={() => setOpen(null)}>Close</button>
            <button className="btn" style={{ marginLeft: "auto", background: going.includes(open.id) ? "var(--green)" : null }} onClick={() => act.toggleEvent(open)}>
              {going.includes(open.id) ? "✓ You're going" : "I'm going"}
            </button>
          </div>
        </div>
      </div>
    </Modal>}
  </div>;
}

/* ---------------- public profile ---------------- */

/* Mock riders don't have a tracked list, so build a stable one from what they ride */
function riderTricks(r) {
  return TRICKS.filter(t => (r.sports || []).includes(t.sport) && t.diff <= 4).slice(0, r.landed || 0)
    .map((t, i) => ({ t, stage: ["every", "most", "some", "every", "most"][i % 5] }));
}

function RiderProfile({ id, s, stats, act, go, view }) {
  const [asVisitor, setAsVisitor] = React.useState(false);
  const me = id === "me" || id === "@you";
  const r = me ? null : CREW.find(c => c.handle === id);
  if (!me && !r) return <Empty icon="user" title="Rider not found" sub="That profile may have been closed." cta="Back to the crew" onCta={() => go("crew")}/>;

  const privacy = me ? s.privacy : r.privacy;
  const rule = PRIVACY.find(p => p.id === privacy);
  const blocked = privacy === "private" || (privacy === "members" && asVisitor);

  const name = me ? s.name : r.name;
  const handle = me ? "@" + (s.name.split(" ")[0] || "you").toLowerCase() : r.handle;
  const sports = me ? sportsOf(s) : (r.sports || []);
  const stance = me ? s.stance : r.stance;
  const earned = me ? earnedStickers(stats) : [];
  const landedList = me
    ? Object.values(firstLanded(s)).sort((a, b) => b.at - a.at).map(e => ({ t: trickById(e.id), at: e.at, stage: s.byId[e.id] })).filter(x => x.t)
    : riderTricks(r).map(x => ({ ...x, at: null }));
  const totals = me
    ? { landed: stats.global.landed, streak: s.streak, stickers: earned.length }
    : { landed: r.landed, streak: r.streak, stickers: r.stickers };

  return <div>
    <button className="cond" onClick={() => go("crew")} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 7, padding: 0, marginBottom: 14, color: "var(--ink-3)", fontSize: 13.5 }}><Ico name="back" w={16}/> Crew</button>

    <div className="panel" style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
      <div style={{ background: "var(--ink)", padding: "24px 22px", display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        <Av pic={me ? s.avatar : null} name={name} size={72} rw={4} ring="var(--paper)" hue={me ? "var(--pink)" : r.hue}/>
        <div style={{ minWidth: 0 }}>
          <div className="d" style={{ fontSize: 32, color: "var(--paper)" }}>{name}{me && " (you)"}</div>
          <div className="lab" style={{ color: "#C9C2B4", marginTop: 6 }}>
            {handle}{!me && r.town ? " · " + r.town : ""}{stance ? " · " + STANCES.find(x => x.id === stance).label : ""}
          </div>
          <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>{sports.map(x => <SportTag key={x} sport={x}/>)}</div>
        </div>
        <span className="tag tilt" style={{ background: privacy === "public" ? "var(--green)" : privacy === "members" ? "var(--sky)" : "var(--ink-3)", marginLeft: "auto" }}>{rule.short}</span>
      </div>
      {!blocked && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))" }}>
        {[[totals.landed, "Landed"], [totals.streak, "Day streak"], [totals.stickers, "Stickers"], [me ? (s.eventsGoing || []).length : 0, "Events"]].map(([n, l], i) =>
          <div key={l} style={{ padding: "16px 14px", borderRight: i < 3 ? "2.5px solid var(--ink)" : "none", borderTop: "3px solid var(--ink)" }}>
            <div className="d" style={{ fontSize: 26 }}>{n}</div><div className="lab" style={{ color: "var(--ink-3)", marginTop: 4 }}>{l}</div>
          </div>)}
      </div>}
    </div>

    <div className="panel flat" style={{ padding: "13px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--paper-2)" }}>
      <span className="lab">Viewing as</span>
      <button className={"pill" + (!asVisitor ? " on" : "")} onClick={() => setAsVisitor(false)}>Signed-in rider</button>
      <button className={"pill" + (asVisitor ? " on" : "")} onClick={() => setAsVisitor(true)}>Signed-out visitor</button>
      <span className="cond" style={{ fontSize: 13.5, color: "var(--ink-3)", letterSpacing: ".03em", marginLeft: "auto" }}>{me ? rule.blurb : rule.other}</span>
    </div>

    {blocked ? <Empty icon="lock" title={privacy === "private" ? "This profile is private" : "Riders only"}
      sub={me
        ? (privacy === "private"
            ? "Nobody can open your profile. You still show on your crew board with your name and score."
            : "Only riders signed in to Land It can open your profile. Signed-out visitors see this instead.")
        : (privacy === "private"
            ? name.split(" ")[0] + " has closed their profile. They still show on the crew board with their name and score."
            : name.split(" ")[0] + " only shows their profile to people signed in to Land It. Make an account and it opens up.")}
      cta={me ? "Change who can see it" : "Back to the crew"} onCta={() => go(me ? "profile" : "crew")}/>
    : <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,340px)", gap: 20 }} className="rp-grid">
      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: "13px 16px", borderBottom: "3px solid var(--ink)", background: "var(--paper-2)" }}>
          <span className="lab">{me ? "What you've landed" : "What they've landed"}</span>
        </div>
        {landedList.length ? <div style={{ padding: "6px 0" }}>
          {landedList.slice(0, 12).map(x => <div key={x.t.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 16px" }}>
            <span style={{ width: 11, height: 11, background: catColor(x.t.cat), border: "2px solid var(--ink)", flex: "none" }}/>
            <button className="cond" onClick={() => go("trick", x.t.id)} style={{ background: "none", border: "none", padding: 0, fontSize: 15, textAlign: "left" }}>{x.t.name}</button>
            <SportTag sport={x.t.sport} sm/>
            <span style={{ flex: 1, height: 3, background: "var(--wash)" }}/>
            {x.at && <span className="lab" style={{ color: "var(--ink-3)" }}>{shortDate(x.at)}</span>}
            {STAGE[x.stage] && <span className="tag" style={{ background: STAGE[x.stage].color, fontSize: 10 }}>{STAGE[x.stage].short}</span>}
          </div>)}
        </div> : <div style={{ padding: 22 }}><p style={{ margin: 0, color: "var(--ink-2)" }}>Nothing landed yet.</p></div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="panel" style={{ padding: 18 }}>
          <div className="lab" style={{ marginBottom: 12 }}>Stickers</div>
          {me ? (earned.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {STICKERS.filter(x => earned.includes(x.id)).slice(-6).map(x => <StickerBadge key={x.id} s={x} earned onClick={() => go("stickers")}/>)}
            </div> : <p style={{ margin: 0, fontSize: 14.5, color: "var(--ink-2)" }}>None yet. Log a trick and the first one drops.</p>)
            : <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
              <span className="d" style={{ fontSize: 30 }}>{r.stickers}</span>
              <span className="cond" style={{ fontSize: 14.5, color: "var(--ink-2)" }}>earned on their wall</span>
            </div>}
        </div>
        <div className="panel" style={{ padding: 18 }}>
          <div className="lab" style={{ marginBottom: 10 }}>Crew</div>
          <button className="cond" onClick={() => go("crew")} style={{ background: "none", border: "none", padding: 0, fontSize: 16 }}>{me ? (s.crew ? "Ramp Rats" : "Riding solo") : (r.crewName || "Riding solo")}</button>
          {!me && <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--ink-3)" }}>Riding since {r.joined}</p>}
        </div>
        {me && <div className="panel" style={{ padding: 18 }}>
          <div className="lab" style={{ marginBottom: 8 }}>Who can see this</div>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--ink-2)" }}>{rule.blurb}</p>
          <button className="btn sm wide ghost" onClick={() => go("profile")}>Change it</button>
        </div>}
      </div>
    </div>}
    <style>{`@media(max-width:860px){.rp-grid{grid-template-columns:1fr!important}}`}</style>
  </div>;
}

/* ---------------- invite ---------------- */

/* Draws the invite square itself, so there is a real image to hand to the share sheet */
function drawInvite(cv, { name, crew, code }) {
  const S = 1080, ctx = cv.getContext("2d");
  cv.width = S; cv.height = S;
  const ink = "#12100B", paper = "#FFFDF5", yellow = "#FFC23F", orange = "#FF5A1F";
  ctx.fillStyle = ink; ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = "rgba(255,253,245,.07)";
  for (let x = 40; x < S; x += 34) for (let y = 40; y < S; y += 34) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, 7); ctx.fill(); }

  ctx.save(); ctx.translate(84, 96); ctx.rotate(-.06);
  ctx.fillStyle = yellow; ctx.fillRect(0, 0, 76, 76);
  ctx.strokeStyle = paper; ctx.lineWidth = 7; ctx.strokeRect(0, 0, 76, 76);
  ctx.restore();
  ctx.fillStyle = paper; ctx.font = "400 62px Anton, Impact, sans-serif"; ctx.textBaseline = "alphabetic";
  ctx.fillText("LAND", 186, 158);
  const w = ctx.measureText("LAND").width;
  ctx.fillStyle = yellow; ctx.fillText("IT", 186 + w + 6, 158);

  ctx.fillStyle = orange;
  ctx.save(); ctx.translate(84, 250); ctx.rotate(-.02); ctx.fillRect(0, 0, S - 168, 300);
  ctx.strokeStyle = paper; ctx.lineWidth = 8; ctx.strokeRect(0, 0, S - 168, 300); ctx.restore();

  ctx.fillStyle = paper; ctx.font = "400 118px Anton, Impact, sans-serif";
  ctx.fillText("RIDE WITH", 130, 400);
  ctx.font = "400 118px Anton, Impact, sans-serif";
  const crewLine = (crew || "MY CREW").toUpperCase();
  ctx.fillText(crewLine.length > 13 ? crewLine.slice(0, 13) : crewLine, 130, 510);

  ctx.fillStyle = "#C9C2B4"; ctx.font = "600 40px 'Barlow Condensed', sans-serif";
  ctx.fillText((name || "A rider").toUpperCase() + " WANTS YOU ON THE BOARD", 88, 638);

  ctx.fillStyle = paper; ctx.font = "400 52px Anton, Impact, sans-serif";
  ctx.fillText("SCOOTER AND SKATEBOARD", 88, 748);
  ctx.fillText("TRICKS, TRACKED PROPERLY.", 88, 812);

  ctx.fillStyle = yellow; ctx.fillRect(88, 872, S - 176, 118);
  ctx.fillStyle = ink; ctx.font = "400 56px Anton, Impact, sans-serif";
  ctx.fillText("JOIN CODE " + code, 120, 950);
  ctx.fillStyle = "#8d8679"; ctx.font = "600 34px 'Barlow Condensed', sans-serif";
  ctx.fillText("LANDIT.APP", S - 260, 1030);
}

function InviteCard({ s, crew, onClose, toast }) {
  const ref = React.useRef(null);
  const [busy, setBusy] = React.useState(false);
  const code = React.useMemo(() => (s.name.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "RIDE") + "-" + String(1000 + (s.name.length * 137) % 8999), [s.name]);
  const url = "https://landit.app/join/" + code;
  const text = s.name.split(" ")[0] + " wants you on " + crew + " in Land It. Two trick libraries, scooter and skate, tracked properly. Join with code " + code + ".";

  React.useEffect(() => {
    let dead = false;
    const paint = () => { if (!dead && ref.current) drawInvite(ref.current, { name: s.name, crew, code }); };
    paint();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
    return () => { dead = true; };
  }, [s.name, crew, code]);

  const blob = () => new Promise(res => ref.current.toBlob(res, "image/png"));

  const share = async () => {
    setBusy(true);
    try {
      const b = await blob();
      const file = new File([b], "land-it-invite.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Land It", text, url });
      } else if (navigator.share) {
        await navigator.share({ title: "Land It", text, url });
      } else {
        await navigator.clipboard.writeText(text + " " + url);
        toast("No share sheet here. Link copied instead", "var(--sky)");
      }
    } catch (e) {
      if (e && e.name !== "AbortError") toast("Couldn't open the share sheet", "var(--red)");
    }
    setBusy(false);
  };

  const save = async () => {
    const b = await blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "land-it-invite.png"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Invite image saved", "var(--green)");
  };

  return <Modal onClose={onClose} w={440}>
    <div style={{ padding: 20 }}>
      <div className="eyebrow">Invite a mate</div>
      <h3 className="d" style={{ fontSize: 26, margin: "7px 0 4px" }}>Send them this</h3>
      <p className="cond" style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--ink-3)", letterSpacing: ".03em" }}>Share opens your phone's own sheet, so it goes straight to WhatsApp, Instagram or wherever.</p>
      <canvas ref={ref} style={{ width: "100%", display: "block", border: "3px solid var(--ink)", boxShadow: "4px 4px 0 var(--ink)" }}/>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 18 }}>
        <button className="btn" onClick={share} disabled={busy} style={{ flex: 1, minWidth: 130 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Ico name="plus" w={15} sw={3}/>{busy ? "Opening…" : "Share"}</span>
        </button>
        <button className="btn ghost sm" onClick={save}>Save image</button>
        <button className="btn ghost sm" onClick={() => { try { navigator.clipboard.writeText(url); } catch (e) {} toast("Invite link copied", "var(--sky)"); }}>Copy link</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, borderTop: "2.5px solid var(--wash)", paddingTop: 14, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div className="lab" style={{ color: "var(--ink-3)" }}>Join code</div>
          <div className="d" style={{ fontSize: 22, marginTop: 3 }}>{code}</div>
        </div>
        <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={onClose}>Done</button>
      </div>
    </div>
  </Modal>;
}

Object.assign(window, { Events, evDate, EV_KINDS, RiderProfile, riderTricks, InviteCard, drawInvite });
