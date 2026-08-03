# Nigeria Higher Education Directory

A plain HTML/CSS/JS site listing programmes across Nigerian universities,
colleges of education and polytechnics — search by programme, filter by
state, zone and ownership, and compare up to 3 listings side by side.

No build step, no server-side code, no CI pipeline. The page fetches its
data live from a Google Sheet on every load — edit the sheet and reload,
nothing to regenerate.

## Files

```
index.html               the page — markup only
css/styles.css            all styling, including the mobile/tablet breakpoints
js/app.js                 fetches + parses the Google Sheet CSVs, filtering, search, sorting, compare tray, render logic
data/source.xlsx          legacy dataset, no longer read by the app (kept for reference)
assets/logo.png           site logo / favicon
```

## Running it locally

`index.html` fetches CSV data with `fetch()`, which browsers block on a
plain `file://` double-click (no CORS on local files). Serve the folder
instead:

```
python -m http.server 8000
```

then open `http://localhost:8000`. If you forget and open the file directly,
the page shows an on-page error telling you the same thing rather than
failing silently.

## Editing the data

The data source is this Google Sheet:
https://docs.google.com/spreadsheets/d/1srub2TQsRPIWYH9IqZZfB-hajgJj6B62hlnhqxZIV-g/edit

It has 3 tabs, each mapped to one category in `SHEET_SOURCES` in `js/app.js`:

| Tab | Category | Columns |
| --- | -------- | ------- |
| `Cleaned_Fed_State_Private_Uny_Faculty_Courses` | Universities | UNIVERSITIES, Faculty, Programmes, STATE, WEBSITE, TYPE OF PROPRIETARY |
| `Cleaned Colleges of Education` | Colleges of Education | COLLEGE OF EDUCATION, SCHOOLS, PROGRAMME, PROGRAMME TYPE, STATE, PROPRIETY, WEBSITES |
| `Fed_St_Pri_Polytechnics_programmes` | Polytechnics | Polytechnic, Programmes, Facilities, STATE, WEBSITE, TYPE OF PROPREITARY |

**Monotechnics** and **Colleges of Health** have no tab yet, so they stay
"coming soon" — add a tab for either and a matching entry in
`SHEET_SOURCES` to bring them online.

To edit: open the sheet, edit the relevant tab, done — the site re-fetches
on every page load, no re-publish step needed. If you rename a column
header, update the matching entry in `SHEET_SOURCES` (`js/app.js`) to match,
or that field will just come through blank.

**The sheet must stay published to the web** (`File > Share > Publish to
web` → Entire Document → CSV). Plain "Anyone with the link" sharing is not
enough on some Google accounts — Workspace/managed accounts can silently
require sign-in for viewers even when the share dialog looks fully public.
Publish to web bypasses that and is what the app actually fetches from
(see `SHEET_KEY`/`sheetCsvUrl()` in `js/app.js`). If a tab's `gid` changes
(e.g. the tab is deleted and recreated), update it in `SHEET_SOURCES` — find
the new value by clicking the tab and reading `?gid=...` out of the browser
URL bar.

- **State** must be one of the 36 states or a recognized spelling of the
  FCT (`FCT (Abuja)`, `FCT`, `Federal Capital Territory`, `Abuja` — see
  `STATE_ALIASES` in `js/app.js`). Anything else fails loudly (an on-page
  error naming the row and the typo) instead of shipping a mis-zoned or
  silently dropped listing. **Zone is not read from the sheet** — the app
  derives it from State on load, so a listing can never end up with a
  state/zone that disagree, even though the sheets do carry their own
  (sometimes inconsistent) zone column.
- **Proprietorship/Propriety/Type of Proprietary** should be `Federal`,
  `State`, or `Private` — anything else won't match the ownership filter
  checkboxes.
- **Programme Type** (Colleges of Education only) can be left blank; it
  falls back to "Not specified", same as Universities and Polytechnics,
  which don't have this column at all.
- **Website** values may include `http://`/`https://` already — the app
  strips it before storing, since the card/compare views add `https://`
  themselves.
- Add a new institution by just adding rows for it; there's no separate
  place to register an institution name.

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
needed). All of those serve over HTTP(S), so the `fetch()` calls to Google
Sheets work the same as they do locally under `python -m http.server`.
The page has no dependency on being served from any particular origin —
Google's published-CSV endpoint sends permissive CORS headers.
