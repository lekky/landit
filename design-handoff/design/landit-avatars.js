/* Land It. Built-in avatar set. Sliced from the illustrated sheet in uploads/. */
(function () {
  const a = (id, name, group, hue, file) => ({ id, name, group, hue, src: "avatars/" + file + ".png" });

  const AVATARS = [
    /* ---- lids: helmets, caps, beanies ---- */
    a("cap-green",    "Flat Cap",      "Lids", "#AECF9A", "cap-green"),
    a("helmet-white", "White Lid",     "Lids", "#F3B84E", "helmet-white"),
    a("beanie-purple","Beanie",        "Lids", "#C4B5E8", "beanie-purple"),
    a("snapback-pink","Snapback",      "Lids", "#F5B8C8", "snapback-pink"),
    a("helmet-land",  "Land It Lid",   "Lids", "#C9C6BE", "helmet-land"),
    a("bucket-tan",   "Bucket Hat",    "Lids", "#CFC2AC", "bucket-tan"),
    a("goggles",      "Shades + Lid",  "Lids", "#F3B84E", "goggles"),
    a("helmet-ld",    "LD Lid",        "Lids", "#F5B8C8", "helmet-ld"),
    a("helmet-black", "Black Lid",     "Lids", "#F5B8C8", "helmet-black"),
    a("helmet-ponytail","Lid + Ponytail","Lids","#AECF9A", "helmet-ponytail"),
    a("snapback-braids","Cap + Braids", "Lids", "#F3B84E", "snapback-braids"),
    a("helmet-hijab", "Lid + Hijab",   "Lids", "#F5B8C8", "helmet-hijab"),
    a("bucket-wavy",  "Bucket + Waves","Lids", "#AECF9A", "bucket-wavy"),
    a("cap-shades",   "Cap + Shades",  "Lids", "#C4B5E8", "cap-shades"),
    a("beanie-long",  "Beanie + Long", "Lids", "#9FC7E8", "beanie-long"),

    /* ---- heads: no lid ---- */
    a("hair-blue",    "Bed Head",      "Heads", "#9FC7E8", "hair-blue"),
    a("headphones",   "Headphones",    "Heads", "#9FC7E8", "headphones"),
    a("hood-cap",     "Hood + Cap",    "Heads", "#AECF9A", "hood-cap"),
    a("ponytail",     "Ponytail",      "Heads", "#C4B5E8", "ponytail"),
    a("curls",        "Curls",         "Heads", "#C4B5E8", "curls"),
    a("cap-flat",     "Cap, Peak Up",  "Heads", "#AECF9A", "cap-flat"),
    a("masked",       "Masked Up",     "Heads", "#F5B8C8", "masked"),
    a("fringe",       "Fringe",        "Heads", "#9FC7E8", "fringe"),
    a("hoodie-up",    "Hood Up",       "Heads", "#CFC2AC", "hoodie-up"),
    a("glasses",      "Glasses",       "Heads", "#F3B84E", "glasses"),
    a("bandana-bun",  "Bandana + Bun", "Heads", "#C4B5E8", "bandana-bun"),
    a("afro-curls",   "Afro",          "Heads", "#F5B8C8", "afro-curls"),
    a("headphones-bob","Bob + Cans",   "Heads", "#CFC2AC", "headphones-bob"),
    a("space-buns",   "Space Buns",    "Heads", "#9FC7E8", "space-buns"),
    a("hood-fringe",  "Hood + Fringe", "Heads", "#F3B84E", "hood-fringe"),
    a("mask-pixie",   "Masked Pixie",  "Heads", "#CFC2AC", "mask-pixie"),

    /* ---- kit: objects and glyphs ---- */
    a("scooter-green","The Scoot",     "Kit", "#AECF9A", "scooter-green"),
    a("scooter-blue", "Deck Up",       "Kit", "#9FC7E8", "scooter-blue"),
    a("flag",         "Chequered Flag","Kit", "#CFC2AC", "flag"),
    a("crown",        "Crown",         "Kit", "#C4B5E8", "crown"),
    a("bolt",         "Send Bolt",     "Kit", "#9FC7E8", "bolt")
  ];

  const AV_GROUPS = [
    { id: "Lids",  blurb: "Helmets, caps and beanies. How most riders show up" },
    { id: "Heads", blurb: "No lid, just hair. Pick the one closest to you" },
    { id: "Kit",   blurb: "Gear and glyphs, for anyone who'd rather not be a face" }
  ];

  window.LANDIT_AVATARS = { AVATARS, AV_GROUPS };
})();
