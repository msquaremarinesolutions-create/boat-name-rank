#!/usr/bin/env node
/**
 * build_states.js — generate one static page per US state with that state's
 * most popular boat names, plus an index page and a sitemap.
 *
 * Usage: node scripts/build_states.js [path-to-vessels.csv]
 * Output: docs/states/index.html, docs/states/<xx>.html, docs/sitemap.xml
 *
 * Counts vessels with a Valid Certificate of Documentation, grouped by the
 * hailing-port state shown on the transom.
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const input = process.argv[2] || path.join(__dirname, "..", "..", "boat-names-dataset", "data", "vessels.csv");
const OUT = path.join(__dirname, "..", "docs", "states");
const SITE = "https://names.msquaremarine.com";

const STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "Washington, D.C.", FL: "Florida", GA: "Georgia", HI: "Hawaii",
  ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function parseLine(line) {
  const out = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
    else { if (ch === '"') inQ = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch; }
  }
  out.push(cur); return out;
}
const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
const fmt = (n) => n.toLocaleString("en-US");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const titleCase = (s) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bSt\b/g, "St.");

// ---------- structured data shared by every page ----------
// The same @id is used on every tool page, so search engines and AI systems
// resolve all of them to one organisation.
const ORG = {
  "@type": "Organization",
  "@id": "https://www.msquaremarine.com/#organization",
  name: "M.Square Marine",
  legalName: "M.Square Marine LLC",
  url: "https://www.msquaremarine.com",
  logo: "https://cdn.shopify.com/s/files/1/0946/5747/8974/files/M2_logo2.png?v=1754525013",
  email: "ahoy@msquaremarine.com",
  sameAs: [
    "https://github.com/msquaremarinesolutions-create",
    "https://www.reddit.com/user/MSquareMarine/",
  ],
};
const ORG_REF = { "@id": ORG["@id"] };

function breadcrumbs(items) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, url], i) => ({ "@type": "ListItem", position: i + 1, name, item: url })),
  };
}

// JSON-LD is embedded in a <script>; "<" is escaped so no value can close the tag early.
function jsonLd(graph) {
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

// ---------- shared page shell (same look as the rank checker) ----------
function shell({ title, description, canonical, body, graph = [] }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="M.Square Marine">
${jsonLd([ORG, ...graph])}
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='14' fill='%231a1917'/><text x='50' y='68' font-size='52' font-family='Arial' font-weight='bold' fill='white' text-anchor='middle'>M²</text></svg>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@500;600;700&family=Bitter:ital,wght@0,400;0,600;1,400&display=swap">
<style>
  :root { --bg:#fbf9f5; --card:#fff; --ink:#1a1917; --ink-soft:#5b564d; --ink-faint:#8c8578; --line:#e6e1d6; --accent:#14456b; --accent-soft:#eaf0f5; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--ink); font-family:"Bitter",Georgia,serif; line-height:1.65; min-height:100vh; display:flex; flex-direction:column; }
  main { flex:1; width:100%; max-width:760px; margin:0 auto; padding:0 20px; }
  .crumbs { font-family:"Jost",sans-serif; font-size:13px; color:var(--ink-faint); padding-top:28px; }
  .crumbs a { color:var(--ink-soft); text-decoration:none; }
  .crumbs a:hover { color:var(--accent); }
  header { padding:22px 0 8px; }
  .eyebrow { font-family:"Jost",sans-serif; font-size:12px; font-weight:600; letter-spacing:.22em; text-transform:uppercase; color:var(--accent); }
  h1 { font-family:"Jost",sans-serif; font-weight:700; font-size:clamp(28px,5.4vw,42px); line-height:1.12; margin:8px 0 12px; }
  .lede { color:var(--ink-soft); font-size:16.5px; max-width:60ch; }
  .lede strong { color:var(--ink); }
  .stats { display:flex; flex-wrap:wrap; gap:12px; margin:26px 0 8px; }
  .stat { flex:1 1 150px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .stat .k { font-family:"Jost",sans-serif; font-size:11px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-faint); }
  .stat .v { font-family:"Jost",sans-serif; font-size:24px; font-weight:700; line-height:1.3; }
  h2 { font-family:"Jost",sans-serif; font-weight:700; font-size:22px; margin:34px 0 10px; }
  table { width:100%; border-collapse:collapse; background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  th, td { text-align:left; padding:10px 14px; border-bottom:1px solid var(--line); font-size:15px; }
  th { font-family:"Jost",sans-serif; font-size:11px; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:var(--ink-faint); background:var(--bg); }
  tr:last-child td { border-bottom:none; }
  td.n, th.n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
  td.rank { color:var(--ink-faint); font-family:"Jost",sans-serif; width:44px; }
  td a { color:var(--ink); text-decoration:none; font-family:"Jost",sans-serif; font-weight:600; letter-spacing:.03em; }
  td a:hover { color:var(--accent); text-decoration:underline; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:8px; }
  .grid a { display:flex; justify-content:space-between; gap:8px; background:var(--card); border:1px solid var(--line); border-radius:10px; padding:10px 14px; text-decoration:none; color:var(--ink); font-family:"Jost",sans-serif; font-size:14.5px; font-weight:500; }
  .grid a:hover { border-color:var(--accent); color:var(--accent); }
  .grid a span { color:var(--ink-faint); font-variant-numeric:tabular-nums; font-weight:400; }
  .cta { background:var(--accent-soft); border-radius:14px; padding:20px 22px; margin-top:32px; font-size:15.5px; }
  .cta a { color:var(--accent); font-weight:600; }
  .cta form { display:flex; gap:8px; margin-top:12px; }
  .cta input { flex:1; border:1px solid var(--ink); border-radius:999px; padding:10px 18px; font-family:"Jost",sans-serif; font-size:15px; text-transform:uppercase; letter-spacing:.04em; background:var(--card); color:var(--ink); }
  .cta button { background:var(--ink); color:#fff; border:none; border-radius:999px; padding:10px 20px; font-family:"Jost",sans-serif; font-weight:600; font-size:14.5px; cursor:pointer; }
  .cta button:hover { background:var(--accent); }
  .method { color:var(--ink-soft); font-size:14.5px; margin-top:26px; }
  footer { border-top:1px solid var(--line); margin-top:52px; padding:22px 20px 30px; text-align:center; color:var(--ink-faint); font-size:13px; }
  footer a { color:var(--ink-soft); }
  @media (max-width:520px) { .cta form { flex-direction:column; } }
</style>
</head>
<body>
<main>
${body}
</main>
<footer>
  Data: US Coast Guard vessel documentation, Aug 2026 — <a href="../dataset/">about the dataset</a> · open on <a href="https://github.com/msquaremarinesolutions-create/boat-names-dataset">GitHub</a>
  · Made by <a href="https://www.msquaremarine.com">M.Square Marine</a> — 316L stainless steel boat lettering
  · <a href="https://size.msquaremarine.com">Size calculator</a> · <a href="https://mockup.msquaremarine.com">Transom mockup</a>
</footer>
</body>
</html>
`;
}

function nameLink(name) {
  return `<a href="../?name=${encodeURIComponent(name)}">${esc(name)}</a>`;
}

function statePage(code, s, allStates) {
  const name = STATES[code];
  const recPct = Math.round(100 * s.rec / s.total);
  const topNames = top(s.names, 25);
  const ports = top(s.ports, 5);
  const others = allStates.filter((x) => x.code !== code).slice(0, 12);

  const rows = topNames.map(([n, c], i) =>
    `<tr><td class="rank">${i + 1}</td><td>${nameLink(n)}</td><td class="n">${fmt(c)}</td></tr>`).join("\n");
  const portRows = ports.map(([p, c]) =>
    `<tr><td>${esc(titleCase(p))}</td><td class="n">${fmt(c)}</td></tr>`).join("\n");
  const otherLinks = others.map((x) =>
    `<a href="${x.code.toLowerCase()}.html">${esc(STATES[x.code])}<span>${fmt(x.total)}</span></a>`).join("\n");

  const title = `Most Popular Boat Names in ${name} (2026)`;
  const description = `The ${topNames.length} most common boat names among ${fmt(s.total)} documented vessels hailing from ${name}. ${topNames[0][0]} leads with ${fmt(topNames[0][1])} boats. Real US Coast Guard data.`;

  const body = `
<nav class="crumbs"><a href="../">Boat Name Rank</a> › <a href="index.html">By state</a> › ${esc(name)}</nav>
<header>
  <div class="eyebrow">Boat names by state</div>
  <h1>The most popular boat names in ${esc(name)}</h1>
  <p class="lede"><strong>${fmt(s.total)} documented vessels</strong> hail from ${esc(name)} ports. The name on the most transoms: <strong>${esc(topNames[0][0])}</strong>, carried by ${fmt(topNames[0][1])} boats.</p>
</header>

<div class="stats">
  <div class="stat"><div class="k">Documented vessels</div><div class="v">${fmt(s.total)}</div></div>
  <div class="stat"><div class="k">Recreational</div><div class="v">${recPct}%</div></div>
  <div class="stat"><div class="k">Distinct names</div><div class="v">${fmt(s.names.size)}</div></div>
</div>

<h2>Top ${topNames.length} boat names in ${esc(name)}</h2>
<table>
  <thead><tr><th>#</th><th>Name</th><th class="n">Boats</th></tr></thead>
  <tbody>
${rows}
  </tbody>
</table>

<div class="cta">
  <strong>Is your boat name on the list?</strong> Check any name against all ${fmt(s.nationalTotal)} documented US vessels.
  <form action="../" method="get">
    <input type="text" name="name" placeholder="Your boat name" aria-label="Boat name">
    <button type="submit">Check rank</button>
  </form>
</div>

<h2>Where ${esc(name)} boats hail from</h2>
<table>
  <thead><tr><th>Hailing port</th><th class="n">Boats</th></tr></thead>
  <tbody>
${portRows}
  </tbody>
</table>

<h2>Other states</h2>
<div class="grid">
${otherLinks}
</div>
<p style="margin-top:12px;font-family:'Jost',sans-serif;font-size:14px"><a href="index.html" style="color:var(--accent)">All 51 states and D.C. →</a></p>

<p class="method">Counts cover vessels with a valid US Coast Guard Certificate of Documentation whose hailing port is in ${esc(name)}, as of August 2026. Documentation is required for commercial vessels of 5+ net tons and optional for recreational boats of that size, so small state-registered boats are not included. Names are compared exactly as documented, uppercased.</p>
`;
  const url = `${SITE}/states/${code.toLowerCase()}.html`;
  const graph = [
    breadcrumbs([["Boat Name Rank", `${SITE}/`], ["By state", `${SITE}/states/`], [name, url]]),
    { "@type": "WebPage", "@id": url, url, name: title, description, publisher: ORG_REF,
      isBasedOn: { "@id": `${SITE}/dataset/#dataset` } },
  ];
  return shell({ title, description, canonical: url, body, graph });
}

function indexPage(allStates, nationalTotal) {
  const links = allStates.map((x) =>
    `<a href="${x.code.toLowerCase()}.html">${esc(STATES[x.code])}<span>${fmt(x.total)}</span></a>`).join("\n");
  const title = "Most Popular Boat Names by State (2026)";
  const description = `The most common boat names in every US state, from ${fmt(nationalTotal)} Coast Guard-documented vessels. Florida, California, Texas, New York and 47 more.`;
  const body = `
<nav class="crumbs"><a href="../">Boat Name Rank</a> › By state</nav>
<header>
  <div class="eyebrow">Boat names by state</div>
  <h1>The most popular boat names in every state</h1>
  <p class="lede">Pick a state to see its top 25 boat names, its busiest hailing ports and how many documented vessels call it home — from <strong>${fmt(nationalTotal)} US Coast Guard records</strong>.</p>
</header>
<h2>All states, by fleet size</h2>
<div class="grid">
${links}
</div>
<p class="method">Counts cover vessels with a valid Certificate of Documentation, grouped by the hailing-port state on the transom, as of August 2026.</p>
`;
  const graph = [
    breadcrumbs([["Boat Name Rank", `${SITE}/`], ["By state", `${SITE}/states/`]]),
    { "@type": "CollectionPage", "@id": `${SITE}/states/`, url: `${SITE}/states/`, name: title, description, publisher: ORG_REF },
  ];
  return shell({ title, description, canonical: `${SITE}/states/`, body, graph });
}

// ---------- dataset landing page (on our own domain, for Google Dataset Search) ----------
function datasetPage(nationalTotal, totalRecords) {
  const REPO = "https://github.com/msquaremarinesolutions-create/boat-names-dataset";
  const RAW = "https://raw.githubusercontent.com/msquaremarinesolutions-create/boat-names-dataset/main";
  const USCG = "https://www.dco.uscg.mil/Our-Organization/Assistant-Commandant-for-Prevention-Policy-CG-5P/Inspections-Compliance-CG-5PC-/Office-of-Investigations-Casualty-Analysis/Merchant-Vessels-of-the-United-States/";
  const url = `${SITE}/dataset/`;
  const title = "US Boat Names Dataset — 395,728 Coast Guard-Documented Vessels";
  const description = `Every boat name in America: ${fmt(totalRecords)} US Coast Guard-documented vessels cleaned into an analysis-ready CSV, with rankings by decade, boat size and state. Public-domain data, free to use.`;
  const chart = (file, alt) => `<picture><source media="(prefers-color-scheme: dark)" srcset="charts/${file}-dark.svg"><img src="charts/${file}-light.svg" alt="${esc(alt)}" style="width:100%;height:auto;border-radius:12px;margin:14px 0 4px" loading="lazy"></picture>`;

  const body = `
<nav class="crumbs"><a href="../">Boat Name Rank</a> › Dataset</nav>
<header>
  <div class="eyebrow">Open data</div>
  <h1>Every boat name in America</h1>
  <p class="lede"><strong>${fmt(totalRecords)} US Coast Guard-documented vessels</strong>, cleaned into one analysis-ready CSV. Free to use — the source is US federal government data in the public domain.</p>
</header>

<div class="stats">
  <div class="stat"><div class="k">Vessel records</div><div class="v">${fmt(totalRecords)}</div></div>
  <div class="stat"><div class="k">Currently documented</div><div class="v">${fmt(nationalTotal)}</div></div>
  <div class="stat"><div class="k">Data as of</div><div class="v">Aug 2026</div></div>
</div>

<div class="cta">
  <strong>Download:</strong> <a href="${RAW}/data/vessels.csv">vessels.csv</a> (35 MB) ·
  <a href="${REPO}/tree/main/data/aggregates">ranked tables</a> ·
  <a href="${REPO}">full repository, code and methodology</a>
</div>

<h2>SERENITY is America's most popular boat name</h2>
<p class="lede">361 currently documented vessels carry it, ahead of FREEDOM (342) and ANDIAMO (297).</p>
${chart("top-names", "Bar chart of the 15 most popular US boat names, led by SERENITY (361), FREEDOM (342) and ANDIAMO (297)")}

<h2>ANDIAMO is the boat name of the 2020s</h2>
<p class="lede">Among boats built since 2020, ANDIAMO (61) has overtaken the classics — and pun names are taking over: KNOT ON CALL, LIQUID ASSET, WHY KNOT and KNOT WORKING all sit in the 2020s top ten.</p>
${chart("trend", "Line chart of boats built per decade carrying the five all-time top names; ANDIAMO leads the 2020s")}

<h2>The bigger the boat, the shorter the name</h2>
<p class="lede">Vessels of 79 ft and up average 8.8 characters, and only 10.6% of their names run longer than 12 characters — against roughly 20% everywhere else.</p>
${chart("name-length", "Bar chart of the share of boat names longer than 12 characters by boat length; it drops to 10.6 percent for boats of 79 ft and up")}

<h2>Explore it</h2>
<div class="grid">
  <a href="../">Check any boat name<span>→</span></a>
  <a href="../states/">Top names by state<span>→</span></a>
  <a href="${REPO}">Code &amp; methodology<span>→</span></a>
</div>

<h2>Columns</h2>
<table>
  <thead><tr><th>Column</th><th>Description</th></tr></thead>
  <tbody>
<tr><td>vessel_name</td><td>uppercased, whitespace-normalised</td></tr>
<tr><td>official_number</td><td>USCG official number</td></tr>
<tr><td>length_ft</td><td>registered length in feet</td></tr>
<tr><td>build_year</td><td>year of completion</td></tr>
<tr><td>hailing_port, hailing_port_state</td><td>the port shown on the stern</td></tr>
<tr><td>service</td><td>e.g. Recreational, Commercial Fishing Vessel</td></tr>
<tr><td>recreational</td><td>1 if the Recreation endorsement or service applies</td></tr>
<tr><td>hull_material</td><td>e.g. FRP (Fiberglass), Steel, Wood, Aluminum</td></tr>
<tr><td>cod_status</td><td>Certificate of Documentation status</td></tr>
  </tbody>
</table>

<p class="method">Source: <a href="${USCG}">US Coast Guard, <em>Merchant Vessels of the United States</em></a>, release of August 2026 (data as of 2026-08-05), retrieved 2026-08-31. Rankings count the ${fmt(nationalTotal)} vessels with a valid Certificate of Documentation. Owner and personal information is not included. Documentation is required for commercial vessels of 5+ net tons and optional for recreational boats of that size, so small state-registered boats are not covered. Please cite as: M.Square Marine, <em>boat-names-dataset</em> (2026), based on US Coast Guard data.</p>
`;

  const graph = [
    breadcrumbs([["Boat Name Rank", `${SITE}/`], ["Dataset", url]]),
    {
      "@type": "Dataset",
      "@id": `${url}#dataset`,
      name: "US documented vessel names (US Coast Guard, August 2026)",
      alternateName: "boat-names-dataset",
      description: `Names and particulars of ${fmt(totalRecords)} vessels documented by the US Coast Guard, from the public-domain "Merchant Vessels of the United States" file (August 2026 release). Cleaned into an analysis-ready CSV with ranked tables by decade, boat length and state. Owner and personal information is excluded.`,
      url,
      sameAs: REPO,
      keywords: ["boat names", "vessel names", "US Coast Guard", "USCG", "documented vessels", "boating", "maritime", "open data"],
      license: "https://creativecommons.org/publicdomain/mark/1.0/",
      isAccessibleForFree: true,
      creator: ORG_REF,
      publisher: ORG_REF,
      datePublished: "2026-08-31",
      dateModified: "2026-08-31",
      temporalCoverage: "2026-08-05",
      spatialCoverage: { "@type": "Place", name: "United States" },
      isBasedOn: USCG,
      variableMeasured: ["vessel_name", "official_number", "length_ft", "build_year", "hailing_port", "hailing_port_state", "service", "recreational", "hull_material", "cod_status"],
      distribution: [
        { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: `${RAW}/data/vessels.csv` },
      ],
    },
  ];
  return shell({ title, description, canonical: url, body, graph });
}

async function main() {
  const byState = new Map();
  let header = true, nationalTotal = 0, totalRecords = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(input, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (header) { header = false; continue; }
    if (!line.trim()) continue;
    totalRecords++;
    const f = parseLine(line);
    if (f[9] !== "Valid") continue;
    nationalTotal++;
    const st = f[5];
    if (!STATES[st]) continue;
    if (!byState.has(st)) byState.set(st, { total: 0, rec: 0, names: new Map(), ports: new Map() });
    const s = byState.get(st);
    s.total++;
    if (f[7] === "1") s.rec++;
    if (f[0]) inc(s.names, f[0]);
    if (f[4] && f[4] !== "UNSPECIFIED") inc(s.ports, f[4]);
  }

  const allStates = [...byState.entries()].map(([code, s]) => ({ code, total: s.total }))
    .sort((a, b) => b.total - a.total);

  fs.mkdirSync(OUT, { recursive: true });
  const urls = [`${SITE}/`, `${SITE}/states/`];
  for (const [code, s] of byState) {
    s.nationalTotal = nationalTotal;
    fs.writeFileSync(path.join(OUT, code.toLowerCase() + ".html"), statePage(code, s, allStates));
    urls.push(`${SITE}/states/${code.toLowerCase()}.html`);
  }
  fs.writeFileSync(path.join(OUT, "index.html"), indexPage(allStates, nationalTotal));

  // dataset landing page + its charts (copied from the dataset repo)
  const DS = path.join(OUT, "..", "dataset");
  fs.mkdirSync(path.join(DS, "charts"), { recursive: true });
  const chartSrc = path.join(path.dirname(input), "..", "charts");
  for (const f of fs.readdirSync(chartSrc).filter((f) => f.endsWith(".svg"))) {
    fs.copyFileSync(path.join(chartSrc, f), path.join(DS, "charts", f));
  }
  fs.writeFileSync(path.join(DS, "index.html"), datasetPage(nationalTotal, totalRecords));
  urls.push(`${SITE}/dataset/`);

  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(OUT, "..", "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join("\n") + `\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, "..", "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);

  console.log(JSON.stringify({ states: byState.size, nationalTotal, pages: urls.length, top3: allStates.slice(0, 3) }));
}

main();
