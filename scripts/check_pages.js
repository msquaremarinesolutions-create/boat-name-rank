#!/usr/bin/env node
/**
 * check_pages.js — sanity checks for every generated/published HTML page.
 * Validates the JSON-LD block, the organisation entity, the brand spelling
 * and the canonical link. Exits non-zero on any problem.
 *
 * Usage: node scripts/check_pages.js <dir> [<dir> ...]
 */
const fs = require("fs");
const path = require("path");

const ORG_ID = "https://www.msquaremarine.com/#organization";
let pages = 0, errors = 0;
const types = {};

const fail = (f, m) => { errors++; console.log("ERROR  " + f + ": " + m); };

function check(file) {
  pages++;
  const html = fs.readFileSync(file, "utf8");
  if (/M2LETTERS|M\. Square Marine/.test(html)) fail(file, "wrong brand spelling");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (blocks.length !== 1) return fail(file, `expected 1 JSON-LD block, found ${blocks.length}`);
  let data;
  try { data = JSON.parse(blocks[0][1]); } catch (e) { return fail(file, "invalid JSON-LD: " + e.message); }
  const graph = data["@graph"] || [];
  const org = graph.find((o) => o["@type"] === "Organization");
  if (!org || org["@id"] !== ORG_ID || org.name !== "M.Square Marine") fail(file, "organisation entity missing or wrong");
  for (const o of graph) {
    types[o["@type"]] = (types[o["@type"]] || 0) + 1;
    if (o["@type"] === "Dataset") {
      const d = (o.description || "").length;
      if (!o.name || d < 50 || d > 5000 || !o.license || !o.distribution) fail(file, "Dataset incomplete");
    }
    if (o["@type"] === "BreadcrumbList") o.itemListElement.forEach((it, i) => {
      if (it.position !== i + 1 || !it.name || !/^https:\/\//.test(it.item)) fail(file, "breadcrumb " + (i + 1) + " incomplete");
    });
  }
  if (!/<link rel="canonical" href="https:\/\/[^"]+">/.test(html)) fail(file, "no canonical");
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".html")) check(p);
  }
}

for (const d of process.argv.slice(2)) walk(d);
console.log(`${pages} pages checked, ${errors} problems`);
console.log("types:", JSON.stringify(types));
process.exit(errors ? 1 : 0);
