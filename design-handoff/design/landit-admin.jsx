/* Land It. Staff portal: riders, plans, trick library, spots, challenges */

const ADMINS = [
  { name: "Miles", email: "miles@landit.app", role: "Founder" },
  { name: "Ellie", email: "ellie@landit.app", role: "Owner" }
];
const ADMIN_CODE = "ramp";

/* Mock rider base. The signed-in rider is spliced in at render. */
const USERS = [
  { id: "u1", name: "Nia Fowler",    handle: "@niaflips",   plan: "shredder", sports: ["scooter"],          landed: 19, joined: "Mar 2026", active: "Today",      status: "ok" },
  { id: "u2", name: "Kofi Boateng",  handle: "@kofib",      plan: "crew",     sports: ["scooter", "skate"], landed: 14, joined: "Jan 2026", active: "Today",      status: "ok" },
  { id: "u3", name: "Jonah Reid",    handle: "@jonahwhips", plan: "shredder", sports: ["scooter"],          landed: 23, joined: "Nov 2025", active: "Yesterday",  status: "ok" },
  { id: "u4", name: "Ruby Tan",      handle: "@rubyt",      plan: "rookie",   sports: ["skate"],            landed: 9,  joined: "Jun 2026", active: "2 days",     status: "ok" },
  { id: "u5", name: "Sam Okafor",    handle: "@samdoesit",  plan: "rookie",   sports: ["skate"],            landed: 6,  joined: "Jul 2026", active: "Today",      status: "ok" },
  { id: "u6", name: "Priya Shah",    handle: "@priyapark",  plan: "crew",     sports: ["scooter", "skate"], landed: 31, joined: "Sep 2025", active: "Today",      status: "ok" },
  { id: "u7", name: "Dylan Marsh",   handle: "@dyl",        plan: "rookie",   sports: ["scooter"],          landed: 2,  joined: "Aug 2026", active: "Today",      status: "ok" },
  { id: "u8", name: "Aoife Byrne",   handle: "@aoifeb",     plan: "shredder", sports: ["skate"],            landed: 17, joined: "Feb 2026", active: "5 days",     status: "ok" },
  { id: "u9", name: "Theo Nakamura", handle: "@theon",      plan: "rookie",   sports: ["scooter", "skate"], landed: 11, joined: "May 2026", active: "Yesterday",  status: "ok" },
  { id: "u10", name: "Maja Kowal",   handle: "@majak",      plan: "shredder", sports: ["skate"],            landed: 24, joined: "Dec 2025", active: "3 days",     status: "ok" },
  { id: "u11", name: "Reece Adeyemi", handle: "@reecea",    plan: "rookie",   sports: ["scooter"],          landed: 4,  joined: "Aug 2026", active: "Today",      status: "flagged" },
  { id: "u12", name: "Lena Brandt",  handle: "@lenab",      plan: "crew",     sports: ["scooter", "skate"], landed: 28, joined: "Oct 2025", active: "Today",      status: "ok" },
  { id: "u13", name: "Finn Doherty", handle: "@finnd",      plan: "rookie",   sports: ["skate"],            landed: 1,  joined: "Aug 2026", active: "Today",      status: "ok" },
  { id: "u14", name: "Amara Diallo", handle: "@amarad",     plan: "shredder", sports: ["scooter"],          landed: 15, joined: "Apr 2026", active: "Yesterday",  status: "suspended" }
];

/* ---------- persistence for staff edits ---------- */
const AKEY = "landit.admin.lib";
const readEdits = () => { try { return JSON.parse(localStorage.getItem(AKEY)) || {}; } catch (e) { return {}; } };
const writeEdits = e => { try { localStorage.setItem(AKEY, JSON.stringify(e)); } catch (err) {} };

/* Replay saved staff edits onto the live library before anything renders */
(function applyEdits() {
  const e = readEdits();
  (e.added || []).forEach(t => { if (!TRICKS.some(x => x.id === t.id)) TRICKS.push(t); });
  (e.removed || []).forEach(id => { const i = TRICKS.findIndex(x => x.id === id); if (i > -1) TRICKS.splice(i, 1); });
  Object.entries(e.free || {}).forEach(([id, v]) => { const t = TRICKS.find(x => x.id === id); if (t) t.free = v; });
  Object.entries(e.overrides || {}).forEach(([id, patch]) => { const t = TRICKS.find(x => x.id === id); if (t) Object.assign(t, patch); });
  (e.spotsRemoved || []).forEach(key => { const i = PARKS.findIndex(p => (p.__key || p.name) === key); if (i > -1) PARKS.splice(i, 1); });
  (e.spotsAdded || []).forEach(p => { if (!PARKS.some(x => (x.__key || x.name) === (p.__key || p.name))) PARKS.push(p); });
  Object.entries(e.spotsEdited || {}).forEach(([key, patch]) => { const p = PARKS.find(x => (x.__key || x.name) === key); if (p) Object.assign(p, patch, { __key: key }); });
  (e.challengesRemoved || []).forEach(id => { const i = CHALLENGES.findIndex(c => c.id === id); if (i > -1) CHALLENGES.splice(i, 1); });
  (e.challengesAdded || []).forEach(c => { if (!CHALLENGES.some(x => x.id === c.id)) CHALLENGES.push(c); });
  Object.entries(e.challengesEdited || {}).forEach(([id, patch]) => { const c = CHALLENGES.find(x => x.id === id); if (c) Object.assign(c, patch); });
  Object.entries(e.stickers || {}).forEach(([id, patch]) => { const x = STICKERS.find(k => k.id === id); if (x) Object.assign(x, patch); });
  Object.entries(e.plansMeta || {}).forEach(([id, patch]) => { const p = PLANS.find(k => k.id === id); if (p) Object.assign(p, patch); });
  (e.eventsRemoved || []).forEach(id => { const i = EVENTS.findIndex(x => x.id === id); if (i > -1) EVENTS.splice(i, 1); });
  (e.eventsAdded || []).forEach(ev => { if (!EVENTS.some(x => x.id === ev.id)) EVENTS.push(ev); });
  Object.entries(e.eventsEdited || {}).forEach(([id, patch]) => { const ev = EVENTS.find(x => x.id === id); if (ev) Object.assign(ev, patch); });
  (e.notices || []).forEach(n => { if (!NOTICES.some(x => x.id === n.id)) NOTICES.push(n); });
  Object.entries(e.plans || {}).forEach(([id, plan]) => { const p = USERS.find(u => u.id === id); if (p) p.plan = plan; });
  Object.entries(e.status || {}).forEach(([id, st]) => { const p = USERS.find(u => u.id === id); if (p) p.status = st; });
})();

const freeByDefault = t => t.diff <= FREE_MAX_DIFF;
const isFree = t => (t.free === undefined ? freeByDefault(t) : !!t.free);

/* ---------- small shared bits ---------- */
function ACard({ n, label, hue, sub }) {
  return <div className="panel flat" style={{ padding: 16, background: hue || "var(--paper)" }}>
    <div className="lab" style={{ color: "var(--ink-2)" }}>{label}</div>
    <div className="d" style={{ fontSize: 32, marginTop: 6 }}>{n}</div>
    {sub && <div className="cond" style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4, letterSpacing: ".03em" }}>{sub}</div>}
  </div>;
}

function ARow({ children, head }) {
  return <div className="arow" style={{ background: head ? "var(--paper-2)" : "transparent", borderBottom: "2px solid var(--wash)" }}>{children}</div>;
}

/* Staff editor used for both tricks and spots */
function AdminEditor({ title, fields, value, onSave, onClose }) {
  const [v, setV] = React.useState(value);
  const set = (k, x) => setV(p => ({ ...p, [k]: x }));
  return <Modal onClose={onClose} w={560}>
    <div style={{ padding: 22 }}>
      <div className="eyebrow">Staff edit</div>
      <h3 className="d" style={{ fontSize: 26, margin: "7px 0 18px" }}>{title}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
        {fields.map(fl => <div key={fl.k} className="field" style={{ gridColumn: fl.wide ? "1/-1" : "auto" }}>
          <label>{fl.label}</label>
          {fl.type === "select" ? <select value={v[fl.k]} onChange={e => set(fl.k, e.target.value)}>
              {fl.options.map(o => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
            </select>
          : fl.type === "text" ? <textarea rows={fl.rows || 2} value={v[fl.k] || ""} onChange={e => set(fl.k, e.target.value)}/>
          : fl.type === "sports" ? <div style={{ display: "flex", gap: 7 }}>
              {SPORT_IDS.map(x => <button key={x} className={"pill" + ((v[fl.k] || []).includes(x) ? " on" : "")}
                onClick={() => set(fl.k, (v[fl.k] || []).includes(x) ? v[fl.k].filter(y => y !== x) : [...(v[fl.k] || []), x])}>{SPORTS[x].label}</button>)}
            </div>
          : <input value={v[fl.k] || ""} onChange={e => set(fl.k, e.target.value)} placeholder={fl.placeholder || ""}/>}
        </div>)}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" style={{ marginLeft: "auto" }} onClick={() => { onSave(v); onClose(); }}>Save changes</button>
      </div>
    </div>
  </Modal>;
}

function AdminGate({ onIn }) {
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [err, setErr] = React.useState(null);
  const submit = e => {
    e.preventDefault();
    const who = ADMINS.find(a => a.email.toLowerCase() === email.trim().toLowerCase());
    if (!who || code.trim().toLowerCase() !== ADMIN_CODE) return setErr("That pair doesn't match a staff account");
    onIn(who);
  };
  return <div style={{ maxWidth: 420, margin: "40px auto" }}>
    <div className="panel" style={{ padding: 24, boxShadow: "8px 8px 0 var(--violet)" }}>
      <span className="tag" style={{ background: "var(--violet)" }}>Staff only</span>
      <h1 className="d" style={{ fontSize: 32, margin: "12px 0 4px" }}>Admin portal</h1>
      <p className="cond" style={{ margin: "0 0 20px", fontSize: 14, color: "var(--ink-3)", letterSpacing: ".04em" }}>Riders, plans, the trick library and the spot queue.</p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="field"><label>Staff email</label>
          <input value={email} onChange={e => { setEmail(e.target.value); setErr(null); }} placeholder="miles@landit.app" autoComplete="off"/></div>
        <div className="field"><label>Passcode</label>
          <input type="password" value={code} onChange={e => { setCode(e.target.value); setErr(null); }} placeholder="••••"/></div>
        {err && <span className="err" style={{ fontFamily: "var(--fc)", fontWeight: 600, fontSize: 12.5, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--red)" }}>{err}</span>}
        <button className="btn wide" type="submit" style={{ background: "var(--violet)" }}>Open portal</button>
      </form>
      <p className="cond" style={{ margin: "16px 0 0", fontSize: 12.5, color: "var(--ink-3)", letterSpacing: ".04em" }}>
        Prototype accounts: {ADMINS.map(a => a.email).join(" or ")}, passcode {ADMIN_CODE}.
      </p>
    </div>
  </div>;
}

/* One rider, opened from the table */
function AdminRiderSheet({ u, s, onClose, setPlan, setStatus }) {
  const plan = PLANS.find(p => p.id === u.plan) || PLANS[0];
  const dates = u.me ? firstLanded(s) : {};
  const tracked = u.me
    ? Object.keys(s.byId).map(id => ({ t: trickById(id), stage: s.byId[id], at: (dates[id] || {}).at })).filter(x => x.t)
    : TRICKS.filter(t => (u.sports || []).includes(t.sport) && t.diff <= 3).slice(0, u.landed)
        .map((t, i) => ({ t, stage: ["every", "most", "some", "trying"][i % 4], at: null }));
  const landed = tracked.filter(x => LANDED.includes(x.stage)).length;
  return <Modal onClose={onClose} w={620}>
    <div style={{ padding: 0 }}>
      <div style={{ background: "var(--ink)", padding: "20px 22px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Av pic={u.me ? s.avatar : null} name={u.name} size={54} rw={3} ring="var(--paper)" hue={u.hue || "var(--sky)"}/>
        <div style={{ minWidth: 0 }}>
          <div className="d" style={{ fontSize: 26, color: "var(--paper)" }}>{u.name}</div>
          <div className="lab" style={{ color: "#C9C2B4", marginTop: 5 }}>{u.handle} · joined {u.joined} · active {u.active.toLowerCase()}</div>
        </div>
        <span className="tag tilt" style={{ background: plan.hue, marginLeft: "auto" }}>{plan.name}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(96px,1fr))" }}>
        {[[tracked.length, "Tracked"], [landed, "Landed"], [u.me ? (s.clips || []).length : 0, "Clips"], [(u.sports || []).length, "Sports"]].map(([n, l], i) =>
          <div key={l} style={{ padding: "14px 14px", borderRight: i < 3 ? "2.5px solid var(--ink)" : "none", borderTop: "3px solid var(--ink)", borderBottom: "3px solid var(--ink)" }}>
            <div className="d" style={{ fontSize: 24 }}>{n}</div><div className="lab" style={{ color: "var(--ink-3)", marginTop: 3 }}>{l}</div>
          </div>)}
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div className="lab" style={{ marginBottom: 10 }}>What they're tracking</div>
          {tracked.length ? <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflow: "auto" }}>
            {tracked.map(x => <div key={x.t.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SportTag sport={x.t.sport} sm/>
              <span className="cond" style={{ fontSize: 14.5 }}>{x.t.name}</span>
              <span style={{ flex: 1, height: 3, background: "var(--wash)" }}/>
              {x.at && <span className="lab" style={{ color: "var(--ink-3)" }}>{shortDate(x.at)}</span>}
              <span className="tag" style={{ background: STAGE[x.stage] ? STAGE[x.stage].color : "var(--ink-3)", fontSize: 10 }}>{STAGE[x.stage] ? STAGE[x.stage].short : x.stage}</span>
            </div>)}
          </div> : <p style={{ margin: 0, fontSize: 14.5, color: "var(--ink-2)" }}>Nothing tracked yet.</p>}
          {!u.me && <p className="cond" style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--ink-3)", letterSpacing: ".03em" }}>Sample account. Real records land here once the backend is wired.</p>}
        </div>
        <div style={{ borderTop: "2.5px solid var(--wash)", paddingTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div className="lab">Plan override</div>
          <select value={u.plan} onChange={e => setPlan(u, e.target.value)}
            style={{ border: "2.5px solid var(--ink)", background: "var(--paper)", padding: "7px 9px", fontSize: 13.5, fontFamily: "var(--fc)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
            {PLANS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {!u.me && <button className="btn sm" style={{ background: u.status === "suspended" ? "var(--green)" : "var(--red)" }}
            onClick={() => setStatus(u, u.status === "suspended" ? "ok" : "suspended")}>{u.status === "suspended" ? "Restore account" : "Suspend account"}</button>}
          <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  </Modal>;
}

/* ---------- tabs ---------- */
function AdminOverview({ s, rows, go }) {
  const byPlan = id => rows.filter(u => u.plan === id).length;
  const paid = rows.filter(u => u.plan !== "rookie").length;
  const mrr = rows.reduce((n, u) => n + (u.plan === "shredder" ? 3.99 : u.plan === "crew" ? 8.99 : 0), 0);
  const pending = (s.submittedSpots || []).length;
  const locked = TRICKS.filter(t => !isFree(t)).length;
  return <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
      <ACard n={rows.length} label="Riders" hue="var(--paper-2)" sub={rows.filter(u => u.active === "Today").length + " active today"}/>
      <ACard n={paid} label="Paying" hue="var(--lime)" sub={Math.round(paid / rows.length * 100) + "% conversion"}/>
      <ACard n={"£" + mrr.toFixed(2)} label="Monthly revenue" hue="var(--yellow)" sub="Across all plans"/>
      <ACard n={TRICKS.length} label="Tricks live" hue="var(--paper-2)" sub={locked + " behind Shredder"}/>
      <ACard n={PARKS.length} label="Spots live" hue="var(--paper-2)" sub={pending + " waiting for review"}/>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 18 }}>
      <div className="panel flat" style={{ padding: 18 }}>
        <div className="lab" style={{ marginBottom: 13 }}>Riders by plan</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {PLANS.map(p => <div key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span className="cond" style={{ fontSize: 14.5 }}>{p.name}</span>
              <span className="lab" style={{ color: "var(--ink-3)" }}>{byPlan(p.id)}</span>
            </div>
            <Bar pct={byPlan(p.id) / rows.length * 100} color={p.hue} h={13}/>
          </div>)}
        </div>
      </div>
      <div className="panel flat" style={{ padding: 18 }}>
        <div className="lab" style={{ marginBottom: 13 }}>Riders by sport</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {SPORT_IDS.map(id => {
            const n = rows.filter(u => (u.sports || []).includes(id)).length;
            return <div key={id}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span className="cond" style={{ fontSize: 14.5 }}>{SPORTS[id].label}</span>
                <span className="lab" style={{ color: "var(--ink-3)" }}>{n}</span>
              </div>
              <Bar pct={n / rows.length * 100} color={SPORTS[id].color} h={13}/>
            </div>;
          })}
          <div className="cond" style={{ fontSize: 13.5, color: "var(--ink-3)", letterSpacing: ".03em", marginTop: 2 }}>
            {rows.filter(u => (u.sports || []).length > 1).length} riders do both.
          </div>
        </div>
      </div>
      <div className="panel flat" style={{ padding: 18 }}>
        <div className="lab" style={{ marginBottom: 13 }}>Needs a human</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[[pending + " spot" + (pending === 1 ? "" : "s") + " awaiting review", pending > 0],
            [(n => n + " flagged account" + (n === 1 ? "" : "s"))(rows.filter(u => u.status === "flagged").length), rows.some(u => u.status === "flagged")],
            [(n => n + " suspended account" + (n === 1 ? "" : "s"))(rows.filter(u => u.status === "suspended").length), rows.some(u => u.status === "suspended")]].map(([label, on]) =>
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 12, height: 12, border: "2.5px solid var(--ink)", background: on ? "var(--orange)" : "var(--paper)", flex: "none" }}/>
              <span className="cond" style={{ fontSize: 14.5 }}>{label}</span>
            </div>)}
        </div>
      </div>
    </div>
  </div>;
}

function AdminRiders({ s, act, rows, setPlan, setStatus }) {
  const [q, setQ] = React.useState("");
  const [plan, setPlan_] = React.useState("all");
  const [open, setOpen] = React.useState(null);
  const list = rows.filter(u =>
    (plan === "all" || u.plan === plan) &&
    (u.name + u.handle).toLowerCase().includes(q.trim().toLowerCase()));
  return <div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
      <div className="search" style={{ flex: 1, minWidth: 220, padding: "9px 12px" }}>
        <Ico name="search" w={17} sw={2.6}/>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Name or handle…"/>
      </div>
      <button className={"pill" + (plan === "all" ? " on" : "")} onClick={() => setPlan_("all")}>All</button>
      {PLANS.map(p => <button key={p.id} className={"pill" + (plan === p.id ? " on" : "")} onClick={() => setPlan_(p.id)}>{p.name}</button>)}
    </div>

    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <ARow head>
        <span className="lab">Rider</span><span className="lab">Rides</span><span className="lab">Landed</span>
        <span className="lab">Joined</span><span className="lab">Last active</span><span className="lab">Plan override</span><span className="lab">Account</span>
      </ARow>
      {list.map(u => <ARow key={u.id}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Av pic={u.me ? s.avatar : null} name={u.name} size={32} hue={u.hue || "var(--sky)"}/>
          <div style={{ minWidth: 0 }}>
            <div className="cond" style={{ fontSize: 15 }}>{u.name}{u.me && " (you)"}</div>
            <div className="lab" style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: ".08em" }}>{u.handle}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{(u.sports || []).map(x => <SportTag key={x} sport={x} sm/>)}</div>
        <span className="d" style={{ fontSize: 19 }}>{u.landed}</span>
        <span className="cond" style={{ fontSize: 13.5, color: "var(--ink-2)" }}>{u.joined}</span>
        <span className="cond" style={{ fontSize: 13.5, color: u.active === "Today" ? "var(--green)" : "var(--ink-2)" }}>{u.active}</span>
        <select value={u.plan} onChange={e => setPlan(u, e.target.value)}
          style={{ border: "2.5px solid var(--ink)", background: "var(--paper)", padding: "6px 8px", fontSize: 13.5, fontFamily: "var(--fc)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
          {PLANS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span className="tag" style={{ background: u.status === "ok" ? "var(--green)" : u.status === "flagged" ? "var(--yellow)" : "var(--red)", color: u.status === "flagged" ? "var(--ink)" : "#fff", fontSize: 10 }}>{u.status}</span>
          <button className="btn sm ghost" style={{ fontSize: 11, padding: "4px 9px" }} onClick={() => setOpen(u)}>Open</button>
        </div>
      </ARow>)}
      {!list.length && <div style={{ padding: 26, textAlign: "center" }} className="cond">No riders match that.</div>}
    </div>
    <p className="cond" style={{ margin: "12px 0 0", fontSize: 13, color: "var(--ink-3)", letterSpacing: ".03em" }}>
      Plan overrides take effect immediately and skip billing. Changing your own row switches the app you're signed into.
    </p>
    {open && <AdminRiderSheet u={open} s={s} onClose={() => setOpen(null)} setPlan={setPlan} setStatus={setStatus}/>}
  </div>;
}

function AdminTricks({ bump }) {
  const [sport, setSport] = React.useState("scooter");
  const [q, setQ] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [form, setForm] = React.useState({ name: "", cat: "flat", diff: 1, free: true, about: "", tips: "" });
  const list = TRICKS.filter(t => t.sport === sport && t.name.toLowerCase().includes(q.trim().toLowerCase()));

  const toggleFree = t => {
    const e = readEdits(); e.free = e.free || {};
    const next = !isFree(t); t.free = next; e.free[t.id] = next;
    writeEdits(e); bump();
  };
  const saveEdit = (t, v) => {
    const patch = { name: v.name.trim() || t.name, cat: v.cat, diff: Number(v.diff), about: v.about, tips: v.tips, free: v.free === "yes" };
    Object.assign(t, patch);
    const e = readEdits();
    e.overrides = { ...(e.overrides || {}), [t.id]: { ...((e.overrides || {})[t.id] || {}), ...patch } };
    const added = (e.added || []).find(x => x.id === t.id);
    if (added) Object.assign(added, patch);
    writeEdits(e); bump();
  };
  const remove = t => {
    if (!confirm("Remove " + t.name + " from the library? Riders lose it from their lists.")) return;
    const e = readEdits(); e.removed = [...(e.removed || []), t.id];
    e.added = (e.added || []).filter(x => x.id !== t.id);
    const i = TRICKS.findIndex(x => x.id === t.id); if (i > -1) TRICKS.splice(i, 1);
    writeEdits(e); bump();
  };
  const add = () => {
    const name = form.name.trim();
    if (!name) return;
    const id = sport.slice(0, 2) + "-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Math.random().toString(36).slice(2, 5);
    const t = { id, name, sport, cat: form.cat, diff: Number(form.diff), pre: [], free: form.free,
      about: form.about.trim() || "Added by staff. No description written yet.",
      tips: form.tips.trim() || "No tips written yet.",
      fact: "Staff added this trick on " + new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) + "." };
    TRICKS.push(t);
    const e = readEdits(); e.added = [...(e.added || []), t]; writeEdits(e);
    setForm({ name: "", cat: "flat", diff: 1, free: true, about: "", tips: "" });
    setAdding(false); bump();
  };

  return <div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
      {SPORT_IDS.map(id => <button key={id} className={"pill" + (sport === id ? " on" : "")} onClick={() => setSport(id)}>
        {SPORTS[id].label} · {TRICKS.filter(t => t.sport === id).length}
      </button>)}
      <div className="search" style={{ flex: 1, minWidth: 200, padding: "9px 12px" }}>
        <Ico name="search" w={17} sw={2.6}/>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a trick…"/>
      </div>
      <button className="btn sm" onClick={() => setAdding(v => !v)}>{adding ? "Cancel" : "+ Add trick"}</button>
    </div>

    {adding && <div className="panel flat" style={{ padding: 16, marginBottom: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
      <div className="field" style={{ gridColumn: "1/-1" }}><label>Name</label>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nose Bonk"/></div>
      <div className="field"><label>Sport</label>
        <input value={SPORTS[sport].label} readOnly style={{ background: "var(--wash)" }}/></div>
      <div className="field"><label>Category</label>
        <select value={form.cat} onChange={e => setForm({ ...form, cat: e.target.value })}>
          {Object.entries(CATS).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
        </select></div>
      <div className="field"><label>Difficulty</label>
        <select value={form.diff} onChange={e => setForm({ ...form, diff: e.target.value })}>
          {[1,2,3,4,5].map(d => <option key={d} value={d}>{d} · {TIERS_LABEL[d-1]}</option>)}
        </select></div>
      <div className="field"><label>Free plan</label>
        <select value={form.free ? "yes" : "no"} onChange={e => setForm({ ...form, free: e.target.value === "yes" })}>
          <option value="yes">Included on Rookie</option><option value="no">Shredder and up</option>
        </select></div>
      <div className="field" style={{ gridColumn: "1/-1" }}><label>The lowdown</label>
        <textarea rows={2} value={form.about} onChange={e => setForm({ ...form, about: e.target.value })} placeholder="What the trick actually is."/></div>
      <div className="field" style={{ gridColumn: "1/-1" }}><label>Tips</label>
        <textarea rows={2} value={form.tips} onChange={e => setForm({ ...form, tips: e.target.value })} placeholder="How to get it."/></div>
      <button className="btn wide" style={{ gridColumn: "1/-1" }} onClick={add}>Publish to the library</button>
    </div>}

    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <ARow head>
        <span className="lab">Trick</span><span className="lab">Category</span><span className="lab">Difficulty</span>
        <span className="lab">Builds on</span><span className="lab">Free plan</span><span className="lab">Actions</span>
      </ARow>
      {list.map(t => <ARow key={t.id}>
        <div style={{ minWidth: 0 }}>
          <div className="cond" style={{ fontSize: 15 }}>{t.name}</div>
          <div className="lab" style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: ".08em" }}>{t.id}</div>
        </div>
        <span className="tag" style={{ background: catColor(t.cat), fontSize: 10 }}>{CATS[t.cat].label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Diff n={t.diff} sm/><span className="lab" style={{ color: "var(--ink-3)" }}>{TIERS_LABEL[t.diff-1]}</span></span>
        <span className="cond" style={{ fontSize: 13, color: "var(--ink-2)" }}>{t.pre.length ? t.pre.map(p => (trickById(p) || {}).name).filter(Boolean).join(", ") : "Nothing"}</span>
        <button className="pill" onClick={() => toggleFree(t)}
          style={{ fontSize: 11.5, padding: "5px 10px", background: isFree(t) ? "var(--lime)" : "var(--violet)", color: isFree(t) ? "var(--ink)" : "#fff" }}>
          {isFree(t) ? "Rookie" : "Shredder"}
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn sm ghost" style={{ fontSize: 11, padding: "4px 9px" }} onClick={() => setEditing(t)}>Edit</button>
          <button className="btn sm" style={{ fontSize: 11, padding: "4px 9px", background: "var(--red)" }} onClick={() => remove(t)}>Remove</button>
        </div>
      </ARow>)}
      {!list.length && <div style={{ padding: 26, textAlign: "center" }} className="cond">No tricks match that.</div>}
    </div>
    <p className="cond" style={{ margin: "12px 0 0", fontSize: 13, color: "var(--ink-3)", letterSpacing: ".03em" }}>
      Tapping a plan chip moves that trick between the free and paid tier straight away. By default anything above {TIERS_LABEL[FREE_MAX_DIFF - 1]} is paid.
    </p>

    {editing && <AdminEditor title={"Edit " + editing.name} onClose={() => setEditing(null)}
      value={{ name: editing.name, cat: editing.cat, diff: String(editing.diff), free: isFree(editing) ? "yes" : "no", about: editing.about, tips: editing.tips }}
      onSave={v => saveEdit(editing, v)}
      fields={[
        { k: "name", label: "Name", wide: true },
        { k: "cat", label: "Category", type: "select", options: Object.entries(CATS).map(([k, c]) => [k, c.label]) },
        { k: "diff", label: "Difficulty", type: "select", options: [1,2,3,4,5].map(n => [String(n), n + " · " + TIERS_LABEL[n-1]]) },
        { k: "free", label: "Free plan", type: "select", options: [["yes", "Included on Rookie"], ["no", "Shredder and up"]] },
        { k: "about", label: "The lowdown", type: "text", rows: 3, wide: true },
        { k: "tips", label: "Tips", type: "text", rows: 3, wide: true }
      ]}/>}
  </div>;
}

function AdminSpots({ s, act, bump }) {
  const pending = s.submittedSpots || [];
  const [editing, setEditing] = React.useState(null);
  const [form, setForm] = React.useState({ name: "", town: "", type: "Street spot", tags: "", sports: ["scooter", "skate"] });
  const saveSpot = (p, v) => {
    const key = p.__key || p.name;
    const patch = { name: v.name.trim() || p.name, town: v.town.trim(), type: v.type, dist: v.dist, sports: v.sports, tags: (v.tags || "").split(",").map(t => t.trim()).filter(Boolean) };
    Object.assign(p, patch, { __key: key });
    const e = readEdits();
    e.spotsEdited = { ...(e.spotsEdited || {}), [key]: { ...((e.spotsEdited || {})[key] || {}), ...patch } };
    const added = (e.spotsAdded || []).find(x => (x.__key || x.name) === key);
    if (added) Object.assign(added, patch, { __key: key });
    writeEdits(e); bump();
  };
  const removeSpot = p => {
    if (!confirm("Take " + p.name + " off the map?")) return;
    const key = p.__key || p.name;
    const e = readEdits(); e.spotsRemoved = [...(e.spotsRemoved || []), key];
    e.spotsAdded = (e.spotsAdded || []).filter(x => (x.__key || x.name) !== key);
    const i = PARKS.findIndex(x => (x.__key || x.name) === key); if (i > -1) PARKS.splice(i, 1);
    writeEdits(e); bump();
  };
  const addSpot = () => {
    if (!form.name.trim() || !form.town.trim()) return;
    const p = { name: form.name.trim(), town: form.town.trim(), type: form.type, dist: "New",
      sports: form.sports.length ? form.sports : ["scooter", "skate"],
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean) };
    PARKS.push(p);
    const e = readEdits(); e.spotsAdded = [...(e.spotsAdded || []), p]; writeEdits(e);
    setForm({ name: "", town: "", type: "Street spot", tags: "", sports: ["scooter", "skate"] });
    bump();
  };
  return <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
    <div>
      <SecHead>Waiting for review</SecHead>
      {pending.length ? <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {pending.map((p, i) => <div key={p.name + i} style={{ display: "flex", gap: 14, alignItems: "center", padding: "13px 16px", borderBottom: i < pending.length - 1 ? "2px solid var(--wash)" : "none", flexWrap: "wrap" }}>
          <div style={{ minWidth: 160, flex: 1 }}>
            <div className="cond" style={{ fontSize: 16 }}>{p.name}</div>
            <div className="lab" style={{ color: "var(--ink-3)", marginTop: 3 }}>{p.town} · {p.type}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(p.tags || []).map(t => <span key={t} className="tag" style={{ background: "var(--ink-3)", fontSize: 10 }}>{t}</span>)}
            {(p.sports || []).map(x => <SportTag key={x} sport={x} sm/>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button className="btn sm ink" onClick={() => act.approveSpot(i)}>Approve</button>
            <button className="btn sm ghost" onClick={() => act.rejectSpot(i)}>Reject</button>
          </div>
        </div>)}
      </div> : <Empty icon="map" title="Queue is clear" sub="Rider submissions land here before they go on the map."/>}
    </div>

    <div>
      <SecHead>Live spots</SecHead>
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        {PARKS.map((p, i) => <div key={p.name} style={{ display: "flex", gap: 14, alignItems: "center", padding: "12px 16px", borderBottom: i < PARKS.length - 1 ? "2px solid var(--wash)" : "none", flexWrap: "wrap" }}>
          <div style={{ minWidth: 150, flex: 1 }}>
            <div className="cond" style={{ fontSize: 15.5 }}>{p.name}</div>
            <div className="lab" style={{ color: "var(--ink-3)", marginTop: 3 }}>{p.town} · {p.type} · {p.dist}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(p.sports || []).map(x => <SportTag key={x} sport={x} sm/>)}</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn sm ghost" style={{ fontSize: 11, padding: "4px 9px" }} onClick={() => setEditing(p)}>Edit</button>
            <button className="btn sm" style={{ fontSize: 11, padding: "4px 9px", background: "var(--red)" }} onClick={() => removeSpot(p)}>Remove</button>
          </div>
        </div>)}
      </div>
    </div>

    <div className="panel flat" style={{ padding: 16 }}>
      <div className="lab" style={{ marginBottom: 12 }}>Add a spot yourself</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
        <div className="field"><label>Name</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Rampworx"/></div>
        <div className="field"><label>Town</label><input value={form.town} onChange={e => setForm({ ...form, town: e.target.value })} placeholder="Liverpool"/></div>
        <div className="field"><label>Type</label>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option>Street spot</option><option>Indoor park</option><option>Concrete</option>
          </select></div>
        <div className="field"><label>Tags</label><input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="Bowl, Ledges"/></div>
        <div className="field" style={{ gridColumn: "1/-1" }}><label>Good for</label>
          <div style={{ display: "flex", gap: 7 }}>
            {SPORT_IDS.map(x => <button key={x} className={"pill" + (form.sports.includes(x) ? " on" : "")}
              onClick={() => setForm({ ...form, sports: form.sports.includes(x) ? form.sports.filter(y => y !== x) : [...form.sports, x] })}>{SPORTS[x].label}</button>)}
          </div>
        </div>
        <button className="btn wide" style={{ gridColumn: "1/-1" }} onClick={addSpot}>Publish spot</button>
      </div>
    </div>

    {editing && <AdminEditor title={"Edit " + editing.name} onClose={() => setEditing(null)}
      value={{ name: editing.name, town: editing.town, type: editing.type, dist: editing.dist, tags: (editing.tags || []).join(", "), sports: (editing.sports || []).slice() }}
      onSave={v => saveSpot(editing, v)}
      fields={[
        { k: "name", label: "Name", wide: true },
        { k: "town", label: "Town" },
        { k: "type", label: "Type", type: "select", options: [["Street spot","Street spot"],["Indoor park","Indoor park"],["Concrete","Concrete"]] },
        { k: "dist", label: "Distance shown" },
        { k: "tags", label: "Tags, comma separated", wide: true, placeholder: "Bowl, Ledges" },
        { k: "sports", label: "Good for", type: "sports", wide: true }
      ]}/>}
  </div>;
}

function AdminChallenges({ bump, act }) {
  const [sport, setSport] = React.useState("scooter");
  const [state, setState] = React.useState("all");
  const [editing, setEditing] = React.useState(null);
  const [adding, setAdding] = React.useState(false);

  const rows = challengesFor(sport).filter(c => state === "all" || chalState(c) === state).reverse();
  const counts = st => challengesFor(sport).filter(c => chalState(c) === st).length;

  const persist = (c, patch, isNew) => {
    const e = readEdits();
    if (isNew) { CHALLENGES.push(c); e.challengesAdded = [...(e.challengesAdded || []), c]; }
    else {
      Object.assign(c, patch);
      e.challengesEdited = { ...(e.challengesEdited || {}), [c.id]: { ...((e.challengesEdited || {})[c.id] || {}), ...patch } };
      const added = (e.challengesAdded || []).find(x => x.id === c.id);
      if (added) Object.assign(added, patch);
    }
    writeEdits(e); bump();
  };
  const remove = c => {
    if (!confirm("Delete " + c.week + " " + c.title + "? Riders lose any progress logged against it.")) return;
    const e = readEdits(); e.challengesRemoved = [...(e.challengesRemoved || []), c.id];
    e.challengesAdded = (e.challengesAdded || []).filter(x => x.id !== c.id);
    const i = CHALLENGES.findIndex(x => x.id === c.id); if (i > -1) CHALLENGES.splice(i, 1);
    writeEdits(e); bump();
  };

  const fields = [
    { k: "week", label: "Label", placeholder: "Week 36" },
    { k: "title", label: "Title", placeholder: "Switch Week" },
    { k: "starts", label: "Starts", placeholder: "2026-09-07" },
    { k: "ends", label: "Ends", placeholder: "2026-09-13" },
    { k: "goal", label: "Target", type: "select", options: [1,2,3,4,5].map(n => [String(n), n + " logged trick" + (n === 1 ? "" : "s")]) },
    { k: "verb", label: "Button says", placeholder: "Log a switch trick" },
    { k: "reward", label: "Reward", placeholder: "Switch Hitter sticker" },
    { k: "riders", label: "Riders line", placeholder: "1,284 riders in" },
    { k: "hue", label: "Colour", placeholder: "#3AC0FF" },
    { k: "blurb", label: "Brief", type: "text", rows: 3, wide: true }
  ];
  const blank = { week: "", title: "", starts: "", ends: "", goal: "3", verb: "Log a trick", reward: "", riders: "Opens Monday", hue: "#3AC0FF", blurb: "" };
  const clean = v => ({ week: v.week.trim(), title: v.title.trim(), starts: v.starts.trim(), ends: v.ends.trim(),
    goal: Number(v.goal) || 3, verb: v.verb.trim(), reward: v.reward.trim(), riders: v.riders.trim(), hue: v.hue.trim(), blurb: v.blurb });

  const live = liveChallenge(sport);
  const stateHue = { live: "var(--green)", upcoming: "var(--sky)", past: "var(--ink-3)" };
  const stateWord = { live: "Live", upcoming: "Scheduled", past: "Finished" };

  return <div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
      {SPORT_IDS.map(id => <button key={id} className={"pill" + (sport === id ? " on" : "")} onClick={() => setSport(id)}>
        {SPORTS[id].label} · {challengesFor(id).length}
      </button>)}
      <span style={{ width: 1, height: 26, background: "var(--ink)", opacity: .2 }}/>
      {[["all", "All weeks"], ["live", "Live"], ["upcoming", "Scheduled"], ["past", "Finished"]].map(([k, l]) =>
        <button key={k} className={"pill" + (state === k ? " on" : "")} onClick={() => setState(k)}>{l}{k !== "all" ? " · " + counts(k) : ""}</button>)}
      <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => setAdding(true)}>+ Schedule a week</button>
    </div>

    {live && <div className="panel" style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
      <div style={{ background: live.hue, padding: "16px 18px", borderBottom: "3px solid var(--ink)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span className="tag" style={{ background: "var(--ink)" }}>{chalState(live) === "live" ? "Live now" : "Next up"}</span>
        <span className="d" style={{ fontSize: 22 }}>{live.week} · {live.title}</span>
        <span className="lab" style={{ marginLeft: "auto", color: "var(--ink)" }}>{chalRange(live)}</span>
      </div>
      <div style={{ padding: "14px 18px", display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--ink-2)", flex: 1, minWidth: 220 }}>{live.blurb}</p>
        <span className="lab" style={{ color: "var(--ink-3)" }}>Target {live.goal} · {live.reward}</span>
        <button className="btn sm ghost" onClick={() => setEditing(live)}>Edit this week</button>
      </div>
    </div>}

    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <ARow head>
        <span className="lab">Week</span><span className="lab">Runs</span><span className="lab">Target</span>
        <span className="lab">Reward</span><span className="lab">State</span><span className="lab">Actions</span>
      </ARow>
      {rows.map(c => {
        const st = chalState(c);
        return <ARow key={c.id}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ width: 10, height: 34, background: c.hue, border: "2px solid var(--ink)", flex: "none" }}/>
            <div style={{ minWidth: 0 }}>
              <div className="cond" style={{ fontSize: 15 }}>{c.title}</div>
              <div className="lab" style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: ".08em" }}>{c.week}</div>
            </div>
          </div>
          <span className="cond" style={{ fontSize: 13.5, color: "var(--ink-2)" }}>{chalRange(c)}</span>
          <span className="cond" style={{ fontSize: 14 }}>{c.goal} logged</span>
          <span className="cond" style={{ fontSize: 13.5, color: "var(--ink-2)" }}>{c.reward}</span>
          <span className="tag" style={{ background: stateHue[st], fontSize: 10 }}>{stateWord[st]}</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn sm ghost" style={{ fontSize: 11, padding: "4px 9px" }} onClick={() => setEditing(c)}>Edit</button>
            <button className="btn sm" style={{ fontSize: 11, padding: "4px 9px", background: "var(--red)" }} onClick={() => remove(c)}>Delete</button>
          </div>
        </ARow>;
      })}
      {!rows.length && <div style={{ padding: 26, textAlign: "center" }} className="cond">No weeks match that filter.</div>}
    </div>

    <p className="cond" style={{ margin: "12px 0 0", fontSize: 13, color: "var(--ink-3)", letterSpacing: ".03em" }}>
      Dates decide everything. A week goes live at midnight on its start date and closes at the end of its last day. Riders only see one live challenge per sport, plus what's scheduled after it.
    </p>

    {editing && <AdminEditor title={"Edit " + editing.week} onClose={() => setEditing(null)} fields={fields}
      value={{ ...editing, goal: String(editing.goal) }} onSave={v => persist(editing, clean(v))}/>}

    {adding && <AdminEditor title={"Schedule a " + SPORTS[sport].label.toLowerCase() + " week"} onClose={() => setAdding(false)} fields={fields} value={blank}
      onSave={v => {
        const c = clean(v);
        if (!c.title || !c.starts || !c.ends) return;
        persist({ ...c, sport, id: sport.slice(0, 2) + "-" + Date.now().toString(36) }, null, true);
        act.toast("Week scheduled", c.hue);
      }}/>}
  </div>;
}

function AdminStickers({ bump, act }) {
  const [editing, setEditing] = React.useState(null);
  const save = (x, v) => {
    const patch = { name: v.name.trim() || x.name, cond: v.cond, hue: v.hue, off: v.off === "yes" };
    if (x.n !== undefined) patch.n = Number(v.n) || x.n;
    Object.assign(x, patch);
    const e = readEdits(); e.stickers = { ...(e.stickers || {}), [x.id]: { ...((e.stickers || {})[x.id] || {}), ...patch } };
    writeEdits(e); bump();
    act.toast(patch.name + " updated", patch.hue);
  };
  const toggle = x => {
    const off = !x.off; x.off = off;
    const e = readEdits(); e.stickers = { ...(e.stickers || {}), [x.id]: { ...((e.stickers || {})[x.id] || {}), off } };
    writeEdits(e); bump();
  };
  return <div>
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <ARow head>
        <span className="lab">Sticker</span><span className="lab">Sport</span><span className="lab">Earned by</span>
        <span className="lab">Threshold</span><span className="lab">Live</span><span className="lab">Actions</span>
      </ARow>
      {STICKERS.map(x => <ARow key={x.id}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span style={{ width: 30, height: 30, borderRadius: "50%", background: x.hue, border: "2.5px solid var(--ink)", flex: "none" }}/>
          <div style={{ minWidth: 0 }}>
            <div className="cond" style={{ fontSize: 15 }}>{x.name}</div>
            <div className="lab" style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: ".08em" }}>{x.id}</div>
          </div>
        </div>
        {x.sport ? <SportTag sport={x.sport} sm/> : <span className="lab" style={{ color: "var(--ink-3)" }}>Any</span>}
        <span className="cond" style={{ fontSize: 13.5, color: "var(--ink-2)" }}>{stickerCond(x)}</span>
        <span className="cond" style={{ fontSize: 14 }}>{x.n !== undefined ? x.n : "Fixed rule"}</span>
        <button className="pill" onClick={() => toggle(x)} style={{ fontSize: 11.5, padding: "5px 10px", background: x.off ? "var(--ink-3)" : "var(--lime)", color: x.off ? "#fff" : "var(--ink)" }}>{x.off ? "Hidden" : "Live"}</button>
        <button className="btn sm ghost" style={{ fontSize: 11, padding: "4px 9px" }} onClick={() => setEditing(x)}>Edit</button>
      </ARow>)}
    </div>
    <p className="cond" style={{ margin: "12px 0 0", fontSize: 13, color: "var(--ink-3)", letterSpacing: ".03em" }}>
      Thresholds are editable where the rule counts something. The rest are tied to a specific trick and need a developer.
    </p>
    {editing && <AdminEditor title={"Edit " + editing.name} onClose={() => setEditing(null)}
      value={{ name: editing.name, cond: editing.cond, n: String(editing.n === undefined ? "" : editing.n), hue: editing.hue, off: editing.off ? "yes" : "no" }}
      onSave={v => save(editing, v)}
      fields={[
        { k: "name", label: "Name", wide: true },
        { k: "cond", label: "Earned by", wide: true },
        ...(editing.n !== undefined ? [{ k: "n", label: "Threshold" }] : []),
        { k: "hue", label: "Colour", placeholder: "#FF5A8A" },
        { k: "off", label: "Visible to riders", type: "select", options: [["no", "Live on the wall"], ["yes", "Hidden"]] }
      ]}/>}
  </div>;
}

function AdminEvents({ bump, act }) {
  const [editing, setEditing] = React.useState(null);
  const [adding, setAdding] = React.useState(false);
  const blank = { name: "", kind: "Comp", town: "", venue: "", date: "", level: "All levels", price: "", spots: "", blurb: "", sports: ["scooter", "skate"] };
  const persist = (ev, patch, isNew) => {
    const e = readEdits();
    if (isNew) { EVENTS.push(ev); e.eventsAdded = [...(e.eventsAdded || []), ev]; }
    else {
      Object.assign(ev, patch);
      e.eventsEdited = { ...(e.eventsEdited || {}), [ev.id]: { ...((e.eventsEdited || {})[ev.id] || {}), ...patch } };
      const added = (e.eventsAdded || []).find(x => x.id === ev.id);
      if (added) Object.assign(added, patch);
    }
    writeEdits(e); bump();
  };
  const remove = ev => {
    if (!confirm("Take " + ev.name + " off the calendar?")) return;
    const e = readEdits(); e.eventsRemoved = [...(e.eventsRemoved || []), ev.id];
    e.eventsAdded = (e.eventsAdded || []).filter(x => x.id !== ev.id);
    const i = EVENTS.findIndex(x => x.id === ev.id); if (i > -1) EVENTS.splice(i, 1);
    writeEdits(e); bump();
  };
  const fields = [
    { k: "name", label: "Name", wide: true },
    { k: "kind", label: "Type", type: "select", options: [["Comp","Comp"],["Session","Session"],["Class","Class"],["Jam","Jam"]] },
    { k: "date", label: "Date", placeholder: "2026-09-05" },
    { k: "venue", label: "Venue" },
    { k: "town", label: "Town" },
    { k: "level", label: "Who for" },
    { k: "price", label: "Cost" },
    { k: "spots", label: "Places" },
    { k: "sports", label: "Good for", type: "sports", wide: true },
    { k: "blurb", label: "Details", type: "text", rows: 3, wide: true }
  ];
  return <div>
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
      <button className="btn sm" onClick={() => setAdding(true)}>+ Add event</button>
    </div>
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <ARow head>
        <span className="lab">Event</span><span className="lab">Type</span><span className="lab">Date</span>
        <span className="lab">Where</span><span className="lab">Good for</span><span className="lab">Actions</span>
      </ARow>
      {EVENTS.map(ev => <ARow key={ev.id}>
        <div style={{ minWidth: 0 }}>
          <div className="cond" style={{ fontSize: 15 }}>{ev.name}</div>
          <div className="lab" style={{ color: "var(--ink-3)", fontSize: 10, letterSpacing: ".08em" }}>{ev.level} · {ev.price}</div>
        </div>
        <span className="tag" style={{ background: EV_KINDS[ev.kind] || "var(--ink)", fontSize: 10 }}>{ev.kind}</span>
        <span className="cond" style={{ fontSize: 13.5 }}>{evDate(ev.date).day + " " + evDate(ev.date).month}</span>
        <span className="cond" style={{ fontSize: 13.5, color: "var(--ink-2)" }}>{ev.venue}, {ev.town}</span>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{(ev.sports || []).map(x => <SportTag key={x} sport={x} sm/>)}</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn sm ghost" style={{ fontSize: 11, padding: "4px 9px" }} onClick={() => setEditing(ev)}>Edit</button>
          <button className="btn sm" style={{ fontSize: 11, padding: "4px 9px", background: "var(--red)" }} onClick={() => remove(ev)}>Remove</button>
        </div>
      </ARow>)}
      {!EVENTS.length && <div style={{ padding: 26, textAlign: "center" }} className="cond">Nothing on the calendar.</div>}
    </div>

    {editing && <AdminEditor title={"Edit " + editing.name} onClose={() => setEditing(null)} fields={fields}
      value={{ ...editing, sports: (editing.sports || []).slice() }}
      onSave={v => persist(editing, { name: v.name.trim() || editing.name, kind: v.kind, date: v.date, venue: v.venue, town: v.town, level: v.level, price: v.price, spots: v.spots, blurb: v.blurb, sports: v.sports })}/>}

    {adding && <AdminEditor title="New event" onClose={() => setAdding(false)} fields={fields} value={blank}
      onSave={v => {
        if (!v.name.trim() || !v.date.trim()) return;
        persist({ ...v, name: v.name.trim(), id: "ev" + Date.now().toString(36) }, null, true);
        act.toast("Event published", "var(--sky)");
      }}/>}
  </div>;
}

function AdminNotices({ bump, act }) {
  const [form, setForm] = React.useState({ title: "", body: "", tag: "Land It", sport: "", hue: "#FFC23F" });
  const post = () => {
    if (!form.title.trim()) return;
    const n = { id: "n" + Date.now().toString(36), title: form.title.trim(), body: form.body.trim(), tag: form.tag.trim() || "Land It", sport: form.sport || null, hue: form.hue };
    NOTICES.push(n);
    const e = readEdits(); e.notices = [...(e.notices || []), n]; writeEdits(e);
    setForm({ title: "", body: "", tag: "Land It", sport: "", hue: "#FFC23F" });
    bump(); act.toast("Posted to riders", n.hue);
  };
  const pull = n => {
    const i = NOTICES.findIndex(x => x.id === n.id); if (i > -1) NOTICES.splice(i, 1);
    const e = readEdits(); e.notices = (e.notices || []).filter(x => x.id !== n.id); writeEdits(e);
    bump();
  };
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18, alignItems: "start" }}>
    <div className="panel" style={{ padding: 18 }}>
      <div className="lab" style={{ marginBottom: 4 }}>New announcement</div>
      <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--ink-2)" }}>Shows as a banner at the top of Home until each rider dismisses it.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="field"><label>Title</label>
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Skate library just landed"/></div>
        <div className="field"><label>Body</label>
          <textarea rows={3} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} placeholder="Thirty one skateboard tricks, tracked the same way."/></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field"><label>Label</label><input value={form.tag} onChange={e => setForm({ ...form, tag: e.target.value })}/></div>
          <div className="field"><label>Who sees it</label>
            <select value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })}>
              <option value="">Everyone</option>
              {SPORT_IDS.map(x => <option key={x} value={x}>{SPORTS[x].label} riders</option>)}
            </select></div>
        </div>
        <div className="field"><label>Colour</label>
          <div style={{ display: "flex", gap: 7 }}>
            {["#FFC23F","#9CE05B","#3AC0FF","#FF3D78","#8A3BE0"].map(h => <button key={h} onClick={() => setForm({ ...form, hue: h })}
              style={{ width: 34, height: 34, background: h, border: form.hue === h ? "4px solid var(--ink)" : "2.5px solid var(--ink)", cursor: "pointer" }}/>)}
          </div></div>
        <button className="btn wide" onClick={post}>Post to riders</button>
      </div>
    </div>
    <div>
      <div className="lab" style={{ marginBottom: 12 }}>Live now</div>
      {NOTICES.length ? <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {NOTICES.slice().reverse().map(n => <div key={n.id} className="panel flat" style={{ padding: "14px 16px", background: n.hue }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <span className="tag" style={{ background: "var(--ink)" }}>{n.tag}</span>
            {n.sport && <SportTag sport={n.sport} sm/>}
            <button className="btn sm" style={{ marginLeft: "auto", fontSize: 11, padding: "4px 9px", background: "var(--red)" }} onClick={() => pull(n)}>Pull</button>
          </div>
          <div className="cond" style={{ fontSize: 16 }}>{n.title}</div>
          {n.body && <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.4 }}>{n.body}</p>}
        </div>)}
      </div> : <Empty icon="bolt" title="Nothing posted" sub="Announcements you post show up here and on every rider's dashboard."/>}
    </div>
  </div>;
}

function AdminPlans({ bump, act }) {
  const [editing, setEditing] = React.useState(null);
  const save = (p, v) => {
    const patch = { name: v.name.trim() || p.name, price: v.price.trim(), per: v.per.trim(), pitch: v.pitch,
      perks: v.perks.split("\n").map(x => x.trim()).filter(Boolean),
      missing: v.missing.split("\n").map(x => x.trim()).filter(Boolean) };
    Object.assign(p, patch);
    const e = readEdits(); e.plansMeta = { ...(e.plansMeta || {}), [p.id]: { ...((e.plansMeta || {})[p.id] || {}), ...patch } };
    writeEdits(e); bump(); act.toast(patch.name + " updated", p.hue);
  };
  return <div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, alignItems: "start" }}>
      {PLANS.map(p => <div key={p.id} className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ background: p.hue, padding: "16px 18px", borderBottom: "3px solid var(--ink)" }}>
          <div className="d" style={{ fontSize: 24, color: "#fff", textShadow: "2px 2px 0 var(--ink)" }}>{p.name}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 8 }}>
            <span className="d" style={{ fontSize: 26 }}>{p.price}</span><span className="lab" style={{ color: "var(--ink)" }}>{p.per}</span>
          </div>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: "var(--ink-2)" }}>{p.pitch}</p>
          <div className="lab" style={{ color: "var(--ink-3)" }}>{p.perks.length} perks · {p.missing.length} crossed out</div>
          <button className="btn sm wide ghost" onClick={() => setEditing(p)}>Edit plan</button>
        </div>
      </div>)}
    </div>
    <p className="cond" style={{ margin: "14px 0 0", fontSize: 13, color: "var(--ink-3)", letterSpacing: ".03em" }}>
      Copy and pricing only. Which tricks each plan unlocks is set per trick in the library, and the default cut-off sits at {TIERS_LABEL[FREE_MAX_DIFF - 1]}.
    </p>
    {editing && <AdminEditor title={"Edit " + editing.name} onClose={() => setEditing(null)}
      value={{ name: editing.name, price: editing.price, per: editing.per, pitch: editing.pitch, perks: editing.perks.join("\n"), missing: editing.missing.join("\n") }}
      onSave={v => save(editing, v)}
      fields={[
        { k: "name", label: "Plan name" },
        { k: "price", label: "Price", placeholder: "£3.99" },
        { k: "per", label: "Billing", placeholder: "per month" },
        { k: "pitch", label: "One line pitch", type: "text", rows: 2, wide: true },
        { k: "perks", label: "Included, one per line", type: "text", rows: 6, wide: true },
        { k: "missing", label: "Crossed out, one per line", type: "text", rows: 3, wide: true }
      ]}/>}
  </div>;
}

/* ---------- shell ---------- */
const A_TABS = [
  { id: "overview", label: "Overview" },
  { id: "riders", label: "Riders" },
  { id: "tricks", label: "Trick library" },
  { id: "stickers", label: "Stickers" },
  { id: "spots", label: "Spots" },
  { id: "events", label: "Events" },
  { id: "challenges", label: "Challenges" },
  { id: "notices", label: "Announcements" },
  { id: "plans", label: "Plans" }
];

function Admin({ s, act, go }) {
  const [who, setWho] = React.useState(() => {
    try { const e = sessionStorage.getItem("landit.admin.who"); return e ? ADMINS.find(a => a.email === e) : null; } catch (err) { return null; }
  });
  const [tab, setTab] = React.useState("overview");
  const [, setTick] = React.useState(0);
  const bump = React.useCallback(() => setTick(n => n + 1), []);

  if (!who) return <AdminGate onIn={a => { try { sessionStorage.setItem("landit.admin.who", a.email); } catch (e) {} setWho(a); }}/>;

  const me = { id: "me", name: s.name || "You", handle: "@" + (s.name.split(" ")[0] || "you").toLowerCase(), plan: s.plan,
    sports: sportsOf(s), landed: computeStats(s, null).landed, joined: "This session", active: "Today", status: "ok", me: true, hue: "var(--yellow)" };
  const rows = [me, ...USERS];

  const setPlan = (u, plan) => {
    if (u.me) { act.set({ plan }); }
    else {
      u.plan = plan;
      const e = readEdits(); e.plans = { ...(e.plans || {}), [u.id]: plan }; writeEdits(e);
    }
    bump();
    act.toast(u.name.split(" ")[0] + " moved to " + PLANS.find(p => p.id === plan).name, PLANS.find(p => p.id === plan).hue);
  };
  const setStatus = (u, status) => {
    u.status = status;
    const e = readEdits(); e.status = { ...(e.status || {}), [u.id]: status }; writeEdits(e);
    bump();
    act.toast(u.name.split(" ")[0] + " " + (status === "suspended" ? "suspended" : "restored"), status === "suspended" ? "var(--red)" : "var(--green)");
  };

  const body = {
    overview: <AdminOverview s={s} rows={rows} go={go}/>,
    riders: <AdminRiders s={s} act={act} rows={rows} setPlan={setPlan} setStatus={setStatus}/>,
    tricks: <AdminTricks bump={bump}/>,
    stickers: <AdminStickers bump={bump} act={act}/>,
    spots: <AdminSpots s={s} act={act} bump={bump}/>,
    events: <AdminEvents bump={bump} act={act}/>,
    challenges: <AdminChallenges bump={bump} act={act}/>,
    notices: <AdminNotices bump={bump} act={act}/>,
    plans: <AdminPlans bump={bump} act={act}/>
  };

  return <div>
    <div className="panel" style={{ padding: "16px 20px", background: "var(--ink)", color: "var(--paper)", marginBottom: 18, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <span className="tag" style={{ background: "var(--violet)" }}>Staff</span>
      <div style={{ minWidth: 0 }}>
        <div className="d" style={{ fontSize: 26 }}>Admin portal</div>
        <div className="lab" style={{ color: "#C9C2B4", marginTop: 4 }}>{who.name} · {who.role}</div>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 9, flexWrap: "wrap" }}>
        <button className="btn sm ghost" onClick={() => go("home")}>Back to the app</button>
        <button className="btn sm" style={{ background: "var(--violet)" }} onClick={() => { try { sessionStorage.removeItem("landit.admin.who"); } catch (e) {} setWho(null); }}>Sign out</button>
      </div>
    </div>

    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
      {A_TABS.map(t => <button key={t.id} className={"pill" + (tab === t.id ? " on" : "")} onClick={() => setTab(t.id)}>{t.label}</button>)}
    </div>

    {body[tab]}

    <p className="cond" style={{ margin: "24px 0 0", fontSize: 12.5, color: "var(--ink-3)", letterSpacing: ".04em", borderTop: "2.5px solid var(--wash)", paddingTop: 14 }}>
      Prototype portal. Rider records are sample data. Library, spot and challenge edits are real and persist on this device, so riders see them straight away.
    </p>
  </div>;
}

Object.assign(window, { Admin, AdminGate, AdminEditor, AdminRiderSheet, ADMINS, USERS, isFree });
