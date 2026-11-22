# Ward Wise · Bengaluru Trade Atlas

Team Codyssey built Ward Wise for the BAICONF Datathon Stage 2. The atlas follows 345,123 unique BBMP trade-licence applications filed in calendar years 2020–2024. Officers can explore 198 historical wards, inspect a short quarterly queue of unusual changes in applications and keep a review log.

![The interactive Bengaluru atlas](docs/figures/ward-wise-atlas.jpg)

## Final-round application

[Live atlas](https://ward-wise-bengaluru.vercel.app/) · [Evidence lab, ward 85](https://ward-wise-bengaluru.vercel.app/#lab/85/1/19) · [Two-ward comparison](https://ward-wise-bengaluru.vercel.app/#lab/85/1/19/150) · [15-minute final briefing](https://ward-wise-bengaluru.vercel.app/#brief/1)

- **Atlas.** Search any historical ward, filter the period, trade or filing type, inspect its profile and export counts. A filtered map address reopens the selected view.
- **Evidence lab.** Inspect any of the 198 wards, eight scored trades and 20 quarters. The lab shows raw local and peer denominators, the published expected count and band when eligible, the preceding quarter’s score and the reason for selection or exclusion. Compare any two wards using the same trade and quarter. Export the evidence as JSON or copy a link. All 5,472 eligible scores come from the Python run. Ineligible combinations still display their recorded counts.
- **Review radar.** Open a quarter or search all 22 historical cards. Save and revisit an assessment. Export your review log as JSON, or import a colleague’s export after previewing the number of new entries. Import keeps existing assessments and validates the complete file before saving. Historical device-local reviews remain readable. Public evidence links contain only record identifiers. Assessment notes stay in the browser until exported.
- **Final briefing.** Ten slides with a 15-minute speaking schedule, presenter notes, screenshots and live demo links. Use the previous/next controls, slide picker, or arrow keys with focus outside the controls. The navigation remembers your current slide when you return from the demo. Print/save slides produces all ten slides; printing with browser headers and footers disabled gives the cleanest result.

**Suggested demo.** Start on the map and select Bellanduru in 2024. Open the evidence lab for ward 85 and show 36 accommodation filings against 92.4 expected in Q4. Inspect the source-count table and calculation. Change to Q3 and show why one qualifying quarter did not enter the queue. Return to Q4, assess the case and export the review log. Demonstration notes should be labelled as such.

## Run locally

To obtain the finalist edition before or after the main release:

```sh
git clone --branch final-round-workbench https://github.com/ParvBhawsar/ward-wise-bengaluru.git
cd ward-wise-bengaluru
```

Alternatively, download the [finalist source ZIP](https://github.com/ParvBhawsar/ward-wise-bengaluru/archive/refs/heads/final-round-workbench.zip), extract it and open a terminal in the folder containing `dist/`. The same server command below works for both paths.

The committed `dist/` is a deployable offline-capable static asset directory. The app makes no third-party runtime requests and needs no API keys. Start a local HTTP server from the repository root with Python 3.

```sh
python3 -m http.server 5173 --bind 127.0.0.1 --directory dist
```

Open <http://127.0.0.1:5173>. The app must be served over HTTP. Everything needed to show the real map, lake outlines, category filters, model cases and evaluation is bundled. New reviews are device-local and are tied to the site's origin. Use **Export reviews** for a shareable JSON copy. Clearing browser data clears local reviews.

## Demonstrate in two minutes

1. Open **Atlas**. Hover over a ward to see its application count. Click to select it, or type its number or name under **Find a ward**. Zoom centres on the selected ward. Switch on **Relief view**, then press **Play timeline** to see annual filing volume change from 2020 to 2024. The six boundaries between colour bands stay fixed across annual views for a given set of filters.
2. Scroll to **Ward spotlight**. Pause on Bellanduru, select **Locate on map**, then open **Ward profile**. The 1,812 applications include 561 new filings and 1,251 renewals. The profile shows the five-year history and its trade mix.
3. Open **Review radar → Q4 2024 → Dodda Nekkundi**. The accommodation category has 36 filings, against a model estimate of 92.4. View the expected band, city share and data caveat, then enter a clearly labelled demonstration assessment.
4. Open **Methodology**. Show how the records were reconciled, how the expected counts are estimated, the controlled drop tests and the small held-out persistence comparison. Change to Q3 2024 in the radar to demonstrate a genuine empty queue.

## Reproduce the research

Use Python 3.11+ for the research scripts, and Node 20+ for the optional JavaScript syntax check. There are no runtime package dependencies. To regenerate the analysis from the committed public aggregate and run the checks:

```sh
python3 scripts/build_analysis.py
npm test
```

To recreate the aggregate from the upstream BBMP release:

```sh
python3 scripts/aggregate_bbmp.py --output dist/data
python3 scripts/build_analysis.py
```

The extraction script checks the compressed input SHA-256 before processing. Use `--source /path/to/source.csv.gz` for a locally archived copy of the specified release. Raw trader names, addresses and application IDs are excluded from application assets. The tests reconcile the checked-in aggregate digest, annual and type totals, map joins, uniqueness, review budgets and a common-city-shift scenario. CI checks that rebuilding reproduces the committed outputs.

## Project layout

| Path | Purpose |
| --- | --- |
| `dist/index.html`, `dist/assets/`, `dist/fonts/` | Responsive single-page web client, locally hosted fonts, cartography and interaction |
| `dist/data/application-counts.csv` | Shareable counts grouped by ward, quarter, category and application type |
| `dist/data/coverage.json` | Provenance, dates, denominators and completeness |
| `dist/data/atlas.json` | Browser representation, review queue and validation output |
| `dist/data/audit.json` | Eligible model scores and final selection decisions for the evidence lab |
| `dist/data/wards.json`, `lakes.json` | Projected boundary paths and lake outlines |
| `scripts/` | Reproducible data acquisition, ward crosswalk, geography and analysis |
| `tests/`, `.github/workflows/` | Integrity checks and deterministic rebuild verification |
| `docs/figures/` | Seven report-ready screenshots of the running application |
| `docs/DATA.md`, `docs/GEOGRAPHY.md` | Published data sources, transformations and third-party licences |

## Interpretation

The model measures unusual **application mix** conditional on ward volume. The city adjustment excludes the focal ward. Quarters are comparable against the same quarter in preceding years. No closure labels, licence due dates, causal effect estimates or business survival outcomes are available. The working uncertainty bands have not been calibrated against field audits. Only two of six evaluable early-2024 selected cases persisted for one more quarter. The screenshots include a simulated human review clearly labelled within its note.

## Deployment and source control

Serve `dist/` on any static web host. For Vercel, import this repository and use the checked-in `vercel.json`. The output directory is `dist`; production assets are already built. No installation or build step is needed for serving. Changes to research inputs should rebuild and pass CI before deployment.

For a new GitHub remote, create an empty repository, set it as a remote and push the local `main` branch. Preserve existing remotes for separate deployments. The downloadable source bundle contains commit history in `ward-wise.bundle`, which you can clone with `git clone ward-wise.bundle ward-wise`.

## Attribution

Application database adapted from BBMP via Vivek Matthew (Vonter), ODbL 1.0. Historical boundary data adapted from DataMeet, CC BY-SA 2.5 India. Lake outlines are adapted from ATREE-CSEI via OpenCity. Font files are subsets of DM Sans and Instrument Serif under the SIL Open Font License. Individual dataset licences and source links are in `docs/`.
