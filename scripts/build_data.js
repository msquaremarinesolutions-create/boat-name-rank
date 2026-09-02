#!/usr/bin/env node
/**
 * build_data.js — build the lookup shards for the rank checker from the
 * boat-names-dataset vessels.csv (sibling repo or any path given as argv).
 *
 * Usage: node scripts/build_data.js [path-to-vessels.csv]
 *
 * Output: docs/data/meta.json and docs/data/shards/<A-Z|0>.json
 * Each shard maps NAME -> [boatCount, rank]. Ranks are dense (ties share a
 * rank) over all names of currently documented (Valid COD) vessels.
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const input = process.argv[2] || path.join(__dirname, "..", "..", "boat-names-dataset", "data", "vessels.csv");
const OUT = path.join(__dirname, "..", "docs", "data");

function parseLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function main() {
  const counts = new Map();
  let header = true, boats = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(input, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (header) { header = false; continue; }
    if (!line.trim()) continue;
    const f = parseLine(line);
    if (f[9] !== "Valid") continue;
    const name = f[0];
    if (!name) continue;
    boats++;
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  // dense ranks by count
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  let rank = 0, lastCount = Infinity;
  const shards = new Map();
  for (const [name, count] of sorted) {
    if (count < lastCount) { rank++; lastCount = count; }
    const key = /^[A-Z]/.test(name[0]) ? name[0] : "0";
    if (!shards.has(key)) shards.set(key, {});
    shards.get(key)[name] = [count, rank];
  }

  fs.mkdirSync(path.join(OUT, "shards"), { recursive: true });
  let totalBytes = 0;
  for (const [key, obj] of shards) {
    const j = JSON.stringify(obj);
    totalBytes += j.length;
    fs.writeFileSync(path.join(OUT, "shards", key + ".json"), j);
  }
  // histogram: boat-count -> number of distinct names with that count
  const hist = {};
  for (const [, count] of counts) hist[count] = (hist[count] || 0) + 1;

  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({
    source: "USCG Merchant Vessels of the United States, Aug 2026 (data as of 2026-08-05)",
    boats,
    uniqueNames: counts.size,
    maxRank: rank,
    hist,
    dataset: "https://github.com/msquaremarinesolutions-create/boat-names-dataset",
  }));
  console.log(JSON.stringify({ boats, uniqueNames: counts.size, ranks: rank, shards: shards.size, totalMB: (totalBytes / 1048576).toFixed(1) }));
}

main();
