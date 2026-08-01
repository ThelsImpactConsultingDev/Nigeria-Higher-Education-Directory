# Nigeria Higher Education Directory

A plain HTML/CSS/JS site listing programmes across Nigerian universities,
colleges of education and polytechnics — search by programme, filter by
state, zone and ownership, and compare up to 3 listings side by side.

**Current data:** 17,862 listings · 583 institutions · 37 states.

No build step, no server-side code, no CI pipeline. The page reads its data
straight out of `data/source.xlsx` in the browser — edit that workbook and
reload.

## Files

```
index.html               the page — markup only
css/styles.css            all styling, including the mobile/tablet breakpoints
js/app.js                 fetches + parses source.xlsx, filtering, search, sorting, compare tray, render logic
js/vendor/xlsx.core.min.js  SheetJS (https://sheetjs.com) — reads the workbook client-side
data/source.xlsx          the dataset — this is what you edit
assets/logo.png           site logo / favicon
```

## Running it locally

`index.html` fetches `data/source.xlsx` with `fetch()`, which browsers block
on a plain `file://` double-click (no CORS on local files). Serve the folder
instead:

```
python -m http.server 8000
```

then open `http://localhost:8000`. If you forget and open the file directly,
the page shows an on-page error telling you the same thing rather than
failing silently.

## Editing the data

Open `data/source.xlsx` in Excel, Google Sheets, LibreOffice, whatever.
There are 5 sheets (tabs): **Universities**, **Colleges of Education**,
**Polytechnics**, **Monotechnics**, **Colleges of Health**. Each row is one
programme listing, with columns:

| Institution | State | Website | Proprietorship | Unit | Programme | Award Type |
|---|---|---|---|---|---|---|

- **State** must be one of the 36 states or `FCT (Abuja)`, spelled exactly
  as the app expects (see `STATE_ZONE` in `js/app.js` for the full list).
  **Zone is not a column** — the app derives it from State on load, so a
  listing can never end up with a state/zone that disagree. An unrecognized
  state name fails loudly (an on-page error naming the row and the typo)
  instead of shipping a mis-zoned or silently dropped listing.
- **Proprietorship** should be `Federal`, `State`, or `Private` — anything
  else won't match the ownership filter checkboxes.
- **Award Type** can be left blank; it falls back to "Not specified" (true
  today for most universities and polytechnics — only colleges of education
  reliably carry a real award type).
- **Monotechnics** and **Colleges of Health** are empty (header row only).
  As soon as either sheet gets real rows, its "coming soon" panel
  disappears automatically — nothing in the code needs to change.
- Add a new institution by just adding rows for it; there's no separate
  place to register an institution name.

After editing, just reload the page (or re-deploy) — there's nothing to
run, nothing to regenerate.

## Known data gaps

- **Cut-off marks** — not sourced; the UI shows "coming soon".
- **Accreditation status** — not sourced; the UI shows "coming soon".
- **Monotechnics and colleges of health** — no listings loaded yet.
- **Award type** — only colleges of education carry a real one; universities
  and polytechnics show "Not specified".
- **Websites** — missing for some institutions.

## Deploying

Static files — push this repo and point GitHub Pages / Netlify / Cloudflare
Pages at the repo root (no build command, no output directory override
needed). All of those serve over HTTP(S), so the `fetch()` of
`data/source.xlsx` works the same as it does locally under
`python -m http.server`.

## A note on file size

`data/source.xlsx` is ~6MB because a flat spreadsheet repeats institution
and programme names on every row — that's the tradeoff for making the data
directly editable in Excel instead of a compact indexed format. The page
parses it client-side with SheetJS in a few seconds. If that ever becomes a
problem on slow connections, the fix is to keep this workbook as the
editing source but add a tiny build step that compacts it into a smaller
JSON payload for the page to fetch instead — not needed today.
