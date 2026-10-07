# boat-name-rank

**How popular is your boat name?** A tiny, dependency-free web tool that checks any boat name against 234,468 currently documented US vessels — real US Coast Guard data.

**Live:** https://names.msquaremarine.com

Type a name, get its rank, how many boats share it, and how rare it is among all 135,377 documented boat names — then download a share card or copy a deep link (`?name=SERENITY`).

## How it works

- Static site, no backend: [`docs/index.html`](docs/index.html) plus pre-built JSON lookup shards in [`docs/data/`](docs/data/) (one file per first letter, ~100 KB each, loaded on demand).
- Data comes from the open [boat-names-dataset](https://github.com/msquaremarinesolutions-create/boat-names-dataset) (public-domain USCG *Merchant Vessels of the United States*, release of August 2026). Only vessels with a **Valid** Certificate of Documentation are counted.
- Ranks are dense: names tied on the same boat count share a rank. "Rarer than X%" compares against all distinct documented names.

## Rebuild the data

```bash
node scripts/build_data.js path/to/vessels.csv
```

`vessels.csv` is the main table of the dataset repo; with both repos side by side the path can be omitted.

## License

Code: [MIT](LICENSE). Underlying vessel data: US federal government work, public domain (17 U.S.C. § 105) — no owner or personal information is included.

---

Made by [M.Square Marine](https://www.msquaremarine.com) — we hand-polish and laser-cut 316L stainless steel boat lettering, so we care about boat names professionally.

Our free tools: [Boat Name Rank](https://names.msquaremarine.com/) · [Boat Lettering Size Calculator](https://size.msquaremarine.com/) · [Transom Mockup](https://mockup.msquaremarine.com/) · [Names by state](https://names.msquaremarine.com/states/) · [The dataset](https://names.msquaremarine.com/dataset/) ([on GitHub](https://github.com/msquaremarinesolutions-create/boat-names-dataset))
