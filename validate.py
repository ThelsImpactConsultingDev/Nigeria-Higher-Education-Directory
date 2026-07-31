# Nigerian Higher Education Directory — auto-building site

A single self-contained HTML page listing programmes across Nigerian
universities, colleges of education and polytechnics. Edit your Google Sheet,
and the site rebuilds itself.

**Current data:** 17,862 listings · 583 institutions · 37 states.

---

## How it works

```
Google Sheet  ──►  build_data.py  ──►  validate.py  ──►  build_html.py  ──►  dist/index.html
   (you edit)         cleans            THE GATE           injects            (published)
                                            │
                                            └── fails ──►  nothing publishes,
                                                           live site unchanged
```

You never touch the code. You edit the spreadsheet; a scheduled robot does the rest.

---

## One-time setup (about 30 minutes)

### 1. Create the repo

Create a new **public** repository on GitHub, then upload every file in this
folder, keeping the structure intact. Drag-and-drop on the GitHub website is
fine — no command line needed.

### 2. Choose how the sheet reaches the build

**Path A — pull from Google Drive automatically (recommended)**

1. Open your sheet → **Share** → General access → **Anyone with the link → Viewer**
2. Copy the ID from the URL. In
   `https://docs.google.com/spreadsheets/d/1srub2TQsRP.../edit`
   the ID is the long string between `/d/` and `/edit`.
3. In your repo: **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `SHEET_ID`
   - Value: the ID you copied
4. Done. Every nightly run pulls the current sheet.

**Path B — upload the file yourself**

Skip the secret entirely. When your data changes: **File → Download →
Microsoft Excel** in Google Sheets, then in your repo open `data/`, click
**Add file → Upload files**, and drop in the new `source.xlsx` (keep that
exact filename). The build starts on its own.

Path B is the fallback if your organisation forbids link-sharing.

### 3. Turn on Pages

**Settings → Pages → Source: Deploy from a branch → Branch: `gh-pages` → `/ (root)`**

The `gh-pages` branch appears after the first successful build. Your site
lands at `https://YOUR-USERNAME.github.io/YOUR-REPO/`.

### 4. Run it

**Actions → Build directory site → Run workflow.** Two or three minutes later
the site is live.

---

## Faster hosting for Nigerian users (optional, recommended)

GitHub Pages serves from outside Africa. **Cloudflare Pages** has a Lagos edge
node, so the page loads noticeably faster on Nigerian mobile.

1. [pages.cloudflare.com](https://pages.cloudflare.com) → **Create a project →
   Connect to Git** → pick your repo
2. Build command: leave **empty**
3. Build output directory: `dist`
4. Save and deploy

Cloudflare then redeploys on every commit the robot makes. Both hosts can run
at once; there is no conflict.

---

## Day-to-day use

| I want to… | Do this |
|---|---|
| Update the data | Edit the Google Sheet. Wait for the nightly run, or **Actions → Run workflow** to publish immediately |
| Check it worked | **Actions** tab — green tick is published, red X means the gate caught something |
| See what the gate found | Click the run → **Validate** step |
| Roll back | **Actions** → an earlier green run → re-run it |

The build also runs nightly at 02:00 UTC (03:00 Lagos), so scheduled edits
appear without you doing anything.

---

## What the gate checks

**Blocks publishing:**
- A required sheet is missing or renamed
- Any category came back empty
- Fewer than 15,000 rows total — catches a truncated or half-synced export
- Rows missing institution, unit, programme or award type
- A state outside the 36-states-plus-FCT list
- A zone outside the six geo-political zones
- Ownership other than Federal / State / Private
- Cut-off or accreditation columns reappearing (these must stay "coming soon")

**Warns but still publishes:**
- Rows with no website
- Institution names appearing in more than one state
- Rows where the sheet's own zone column disagrees with the state

That last one is worth watching. Zones are always **derived from the state**,
never read from the sheet, because the source had *Federal Polytechnic, Mubi*
(Adamawa) filed under South West across 49 rows. The build silently corrects
this and names the offender in the warnings so you can fix the spreadsheet.

---

## If the build fails

Open **Actions**, click the red run, and read the failing step. The messages
are written in plain English and name the problem. Common causes:

| Message | Cause |
|---|---|
| `workbook is missing required sheet(s)` | A tab was renamed in Google Sheets. Restore the exact name, or update `SHEETS` in `scripts/clean.py` |
| `Google returned a sign-in page` | The sheet is not link-shared. Redo setup step 2. |
| `only N rows built, expected at least 15,000` | Truncated export, or rows were deleted by accident |
| `template patch failed` | `template/prototype.html` was hand-edited. Restore it, or update the matching string in `build_html.py` |

**Your live site is never affected by a failed build.** It keeps serving the
last good version until a run passes.

---

## Files

```
data/source.xlsx           the workbook (overwritten by Drive pulls)
template/prototype.html    page design — edit for styling changes
scripts/clean.py           all cleaning rules and the state→zone map
scripts/build_data.py      workbook → compact JSON
scripts/validate.py        the gate
scripts/build_html.py      injects data into the template
scripts/smoke_test.py      checks the built page
dist/index.html            the published site (generated — do not edit)
```

To change wording or styling, edit `template/prototype.html`. Never edit
`dist/index.html`; it is overwritten on every build.

---

## Known data gaps

- **Cut-off marks** — not in the source; the UI shows "coming soon". Needs
  JAMB data per institution, programme and year.
- **Accreditation status** — not in the source; shows "coming soon". Needs the
  NUC / NCCE / NBTE registers.
- **Monotechnics and colleges of health** — no source data; both categories
  show a "coming soon" panel.
- **Award type** — only colleges of education carry a real one. Universities
  and polytechnics show "Not specified".
- **Websites** — missing for about 18% of rows.
- **16 polytechnics** are listed in the sheet by name only, with no programme
  rows, so they do not appear.

### Adding cut-off marks later

Add columns `CUTOFF 2024`, `CUTOFF 2025`, `CUTOFF 2026` to each sheet, then
update `load_category()` in `scripts/clean.py` to read them and
`build_html.py` to render them. The rest of the pipeline needs no changes.
