/* Land It. Footer and the legal pages behind it. Draft copy for review, not legal advice. */

const LEGAL_DOCS = [
  {
    id: "privacy", title: "Privacy policy", updated: "August 2026",
    intro: "What we collect, why we collect it, and how to get rid of it. Written to be read by a fourteen year old and their parent.",
    sections: [
      { h: "What we collect", p: [
        "An email address and a display name so you can sign in. Nothing else is required.",
        "The tricks you track, the stages you set, your streak, your stickers and any notes or clips you add. This is the point of the app.",
        "Optional details you choose to add: your picture, stance, riding level, goal and the events you mark yourself down for.",
        "Basic technical data every website gets: device type, browser and rough region, used to keep the service running and secure."
      ]},
      { h: "What we never do", p: [
        "We do not sell your data, and we do not share it with advertisers.",
        "We do not show your surname, email address or clips on any public profile.",
        "We do not track you across other websites."
      ]},
      { h: "Who can see your profile", p: [
        "You choose. Public means anyone with the link sees your tricks, stickers and streak. Riders only means people signed in to Land It. Private means nobody.",
        "New accounts start on riders only. Your crew always sees your name and score on the crew board, whichever setting you pick."
      ]},
      { h: "Clips and photos", p: [
        "Clips you upload are yours. They are visible only to you unless you choose to share one.",
        "Delete a clip and it goes. Delete your account and they all go with it."
      ]},
      { h: "Under 16s", p: [
        "If you are under 16 a parent or guardian should hold the account, or give permission for it. A Crew Pass lets an adult hold up to five rider accounts.",
        "We ask for as little as possible from younger riders and default their profiles to riders only."
      ]},
      { h: "Getting your data or deleting it", p: [
        "Ask us and we will send you everything we hold on you, or delete all of it. Both are free and we aim to do it within 30 days.",
        "Email privacy@landit.app."
      ]}
    ]
  },
  {
    id: "terms", title: "Terms of use", updated: "August 2026",
    intro: "The deal between you and us. Short version: ride safely, be decent to other riders, and we will keep the app running.",
    sections: [
      { h: "Your account", p: [
        "One account per rider. Keep your password to yourself.",
        "You need to be 13 or over to hold an account on your own. Under 13s can ride on a parent's Crew Pass."
      ]},
      { h: "Riding is the risky part, not the app", p: [
        "Land It describes tricks. It does not teach you to do them safely and it cannot judge whether you are ready for one.",
        "Wear a helmet. Learn the difficulty 4 and 5 tricks into foam or resi, with someone watching.",
        "You ride at your own risk. Skate parks and street spots have their own rules and you have to follow those."
      ]},
      { h: "What you post", p: [
        "You own your clips, photos and notes. You give us permission to store and show them back to you inside the app.",
        "Nothing illegal, nothing abusive, nothing that puts other riders at risk. We will remove content and close accounts that break this."
      ]},
      { h: "Paying", p: [
        "Paid plans renew monthly or yearly until you cancel. Cancel any time and you keep access until the period ends.",
        "Your tracked tricks and stickers stay yours if you drop back to the free plan. Tricks above the free tier become read only rather than being deleted."
      ]},
      { h: "Changing the app", p: [
        "The trick library, challenges and stickers change over time. We will tell you in the app when something meaningful changes.",
        "If we ever shut the service down we will give you notice and a way to export what you have tracked."
      ]}
    ]
  },
  {
    id: "safety", title: "Safeguarding", updated: "August 2026",
    intro: "Most riders here are young. This is how we try to keep the app a safe place for them.",
    sections: [
      { h: "Defaults are private", p: [
        "New profiles are visible to signed-in riders only. Public is a choice, not the starting point.",
        "Surnames, emails and clips never appear on a public profile."
      ]},
      { h: "Crews are invite only", p: [
        "You join a crew by invite from someone in it. There is no open directory of riders to browse.",
        "There is no private messaging in Land It, and no plan to add it without a proper moderation team behind it."
      ]},
      { h: "Reporting", p: [
        "Every profile and clip can be reported. Reports go to a human, not a queue nobody reads.",
        "Email safeguarding@landit.app and we will respond within one working day."
      ]},
      { h: "Parents and coaches", p: [
        "A Crew Pass gives an adult a read-only view of each rider: what they are working on, how consistent it is, how much of it is the risky end of the library, and whether they have ridden this week.",
        "Riders can see exactly what that view shows. Nothing is hidden from them."
      ]},
      { h: "Difficulty and risk", p: [
        "Every trick carries a difficulty from 1 to 5. Anything at 4 or 5 involves drops, inverts or both, and the app says so on the trick page.",
        "We will not gate tricks by age, because riders progress at different rates. We will keep flagging the ones that need a foam pit and a spotter."
      ]}
    ]
  },
  {
    id: "cookies", title: "Cookies", updated: "August 2026",
    intro: "We use as few as we can get away with.",
    sections: [
      { h: "Strictly necessary", p: [
        "One cookie to keep you signed in, and local storage on your device to hold your tracked tricks so the app works without a connection at the park.",
        "These cannot be switched off without breaking the app."
      ]},
      { h: "Analytics", p: [
        "Aggregate counts of which pages get used, so we know which parts of the app to improve. No advertising identifiers.",
        "You can opt out in your account settings and nothing else changes."
      ]},
      { h: "No advertising cookies", p: [
        "There are none, because there are no ads."
      ]}
    ]
  },
  {
    id: "about", title: "About Land It", updated: "August 2026",
    intro: "A trick tracker for scooter and skateboard riders, built because a paper checklist on a fridge worked better than any app we could find.",
    sections: [
      { h: "What it is", p: [
        "Two full trick libraries, tracked through five honest stages: want it, learning it, sometimes, most times, every time.",
        "No fake progress bars, no streak guilt, no feed of strangers doing tricks you cannot do yet."
      ]},
      { h: "How we make money", p: [
        "Subscriptions, and eventually posted sticker packs. Not advertising, and not by selling data about children.",
        "The free tier is a real one. It covers both libraries up to the Easy tier and it does not expire."
      ]},
      { h: "Get in touch", p: [
        "hello@landit.app for anything, safeguarding@landit.app for anything urgent about a rider's safety.",
        "If you run a park, a shop or a comp and want your events on the calendar, email events@landit.app."
      ]}
    ]
  }
];

const FOOTER_COLS = [
  { title: "The app", links: [["Trick library", "library"], ["Progress", "progress"], ["Stickers", "stickers"], ["Events", "events"], ["Spots", "parks"]] },
  { title: "Riders", links: [["Crew", "crew"], ["Weekly challenge", "challenge"], ["Plans and pricing", "plans"], ["Avatar set", "avatars"]] },
  { title: "Company", links: [["About Land It", "legal:about"], ["Contact", "legal:about"], ["Safeguarding", "legal:safety"]] },
  { title: "Legal", links: [["Privacy policy", "legal:privacy"], ["Terms of use", "legal:terms"], ["Cookies", "legal:cookies"]] }
];

/* Shared by the signed-out landing page and the app shell */
function SiteFooter({ onNav, onLegal, compact }) {
  const go = target => {
    if (target === "avatars") { window.location.href = "Land It - Avatars.html"; return; }
    if (target.startsWith("legal:")) return onLegal(target.slice(6));
    onNav && onNav(target);
  };
  return <footer style={{ background: "var(--ink)", color: "#8d8679", padding: "40px 18px 30px", marginTop: "auto" }}>
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) repeat(auto-fit,minmax(130px,1fr))", gap: 28 }} className="ft-grid">
        <div style={{ maxWidth: 300 }}>
          <div className="logo" style={{ marginBottom: 12 }}>
            <span className="glyph"><Ico name="scoot" w={19} sw={2.4} style={{ color: "var(--ink)" }}/></span>
            <span className="wm">Land<em>It</em></span>
          </div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "#9d968a" }}>
            Every trick you can do, on a scooter or a board, tracked properly. Log it, learn it, land it.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {["Instagram", "YouTube", "TikTok"].map(x => <span key={x} className="lab" style={{ border: "2px solid #3a352c", padding: "5px 10px", color: "#C9C2B4" }}>{x}</span>)}
          </div>
        </div>
        {FOOTER_COLS.map(col => <div key={col.title}>
          <div className="lab" style={{ color: "#C9C2B4", marginBottom: 12 }}>{col.title}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9, alignItems: "flex-start" }}>
            {col.links.map(([label, target]) => <button key={label} className="cond" onClick={() => go(target)}
              style={{ background: "none", border: "none", padding: 0, color: "#8d8679", fontSize: 13.5, letterSpacing: ".04em", textAlign: "left", lineHeight: 1.35 }}>{label}</button>)}
          </div>
        </div>)}
      </div>
      <div style={{ borderTop: "2px solid #2a2620", marginTop: 30, paddingTop: 18, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <span className="cond" style={{ fontSize: 13, letterSpacing: ".04em" }}>© {new Date().getFullYear()} Land It. Made in the north of England.</span>
        <span className="lab" style={{ color: "#6b6459" }}>Ride within your ability. Wear a helmet.</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 14, flexWrap: "wrap" }}>
          <button className="cond" onClick={() => onLegal("privacy")} style={{ background: "none", border: "none", padding: 0, color: "#8d8679", fontSize: 13 }}>Privacy</button>
          <button className="cond" onClick={() => onLegal("terms")} style={{ background: "none", border: "none", padding: 0, color: "#8d8679", fontSize: 13 }}>Terms</button>
          {!compact && <button className="cond" onClick={() => onNav && onNav("admin")} style={{ background: "none", border: "none", padding: 0, color: "#6b6459", fontSize: 13 }}>Staff</button>}
        </div>
      </div>
    </div>
    <style>{`@media(max-width:760px){.ft-grid{grid-template-columns:1fr 1fr!important;gap:22px!important}}`}</style>
  </footer>;
}

function Legal({ id, onClose, onPick }) {
  const doc = LEGAL_DOCS.find(d => d.id === id) || LEGAL_DOCS[0];
  React.useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" }); }, [id]);
  return <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--wash)", backgroundImage: "radial-gradient(rgba(18,16,11,.07) 1.1px,transparent 1.1px)", backgroundSize: "14px 14px" }}>
    <div style={{ background: "var(--ink)", color: "var(--paper)", padding: "12px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <button className="logo" onClick={onClose} style={{ background: "none", border: "none", padding: 0 }}>
        <span className="glyph"><Ico name="scoot" w={19} sw={2.4} style={{ color: "var(--ink)" }}/></span>
        <span className="wm">Land<em>It</em></span>
      </button>
      <button className="btn sm ghost" style={{ marginLeft: "auto" }} onClick={onClose}>Back</button>
    </div>

    <div style={{ maxWidth: 1000, width: "100%", margin: "0 auto", padding: "30px 18px 70px", flex: 1 }}>
      <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 28, alignItems: "start" }} className="lg-grid">
        <div className="panel flat" style={{ padding: 14, position: "sticky", top: 20 }}>
          <div className="lab" style={{ marginBottom: 11, color: "var(--ink-3)" }}>The small print</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {LEGAL_DOCS.map(dc => <button key={dc.id} className="cond" onClick={() => onPick(dc.id)}
              style={{ textAlign: "left", border: "none", background: dc.id === doc.id ? "var(--ink)" : "transparent", color: dc.id === doc.id ? "var(--paper)" : "var(--ink)", padding: "8px 10px", fontSize: 14 }}>{dc.title}</button>)}
          </div>
        </div>

        <div>
          <span className="eyebrow">Land It · {doc.updated}</span>
          <h1 className="d" style={{ fontSize: "clamp(32px,5.5vw,48px)", margin: "8px 0 12px" }}>{doc.title}</h1>
          <p style={{ margin: "0 0 8px", fontSize: 17, lineHeight: 1.5, color: "var(--ink-2)", maxWidth: 620, textWrap: "pretty" }}>{doc.intro}</p>
          <div className="panel flat" style={{ padding: "11px 14px", background: "var(--paper-2)", margin: "18px 0 26px" }}>
            <span className="lab" style={{ color: "var(--ink-2)" }}>Draft copy, pending legal review before launch</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            {doc.sections.map(sec => <div key={sec.h}>
              <div className="sechead" style={{ marginBottom: 10 }}>
                <h2 style={{ fontFamily: "var(--fd)", fontSize: 22, textTransform: "uppercase" }}>{sec.h}</h2>
                <span className="rule"/>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sec.p.map((line, i) => <p key={i} style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "var(--ink-2)", maxWidth: 640, textWrap: "pretty" }}>{line}</p>)}
              </div>
            </div>)}
          </div>
          <div className="panel" style={{ padding: 20, marginTop: 34, background: "var(--paper-2)", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ minWidth: 200, flex: 1 }}>
              <div className="d" style={{ fontSize: 20 }}>Something not right?</div>
              <p style={{ margin: "5px 0 0", fontSize: 14.5, color: "var(--ink-2)" }}>Tell us and we will fix it. hello@landit.app, or safeguarding@landit.app if it is about a rider's safety.</p>
            </div>
            <button className="btn" onClick={onClose}>Back to Land It</button>
          </div>
        </div>
      </div>
    </div>
    <style>{`@media(max-width:820px){.lg-grid{grid-template-columns:1fr!important}}`}</style>
  </div>;
}

Object.assign(window, { LEGAL_DOCS, FOOTER_COLS, SiteFooter, Legal });
