name: Build directory site

# Runs when you: push a change, click "Run workflow", or nightly at 02:00 UTC
# (03:00 Lagos). The nightly run picks up Google Sheet edits automatically.
on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      use_drive:
        description: 'Pull the latest sheet from Google Drive first'
        type: boolean
        default: true
  schedule:
    - cron: '0 2 * * *'

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: pip

      - name: Install dependencies
        run: pip install -r requirements.txt

      # Pulls the sheet fresh from Drive. Skipped automatically if you have not
      # set the SHEET_ID secret, in which case the committed data/source.xlsx
      # is used instead (Path B).
      - name: Fetch latest sheet from Google Drive
        if: ${{ github.event_name != 'workflow_dispatch' || inputs.use_drive }}
        env:
          SHEET_ID: ${{ secrets.SHEET_ID }}
        run: |
          if [ -z "$SHEET_ID" ]; then
            echo "No SHEET_ID secret set — using the committed data/source.xlsx"
            exit 0
          fi
          URL="https://docs.google.com/spreadsheets/d/$SHEET_ID/export?format=xlsx"
          echo "Downloading sheet $SHEET_ID ..."
          curl -sSL --fail --max-time 120 -o /tmp/fresh.xlsx "$URL" || {
            echo "::error::Could not download the sheet. Is it shared as 'Anyone with the link can view'?"
            exit 1
          }
          # Google returns an HTML sign-in page instead of a file when access is denied.
          if file /tmp/fresh.xlsx | grep -qi 'HTML'; then
            echo "::error::Google returned a sign-in page, not a spreadsheet. Check the sharing setting."
            exit 1
          fi
          mv /tmp/fresh.xlsx data/source.xlsx
          echo "Sheet downloaded ($(du -h data/source.xlsx | cut -f1))"

      - name: Build data payload
        run: python scripts/build_data.py --source data/source.xlsx --out build/data.json

      # The gate. If this fails, later steps do not run, nothing is committed,
      # and the live site keeps serving the previous version.
      - name: Validate
        run: python scripts/validate.py --data build/data.json --source data/source.xlsx

      - name: Build page
        run: python scripts/build_html.py --template template/prototype.html --data build/data.json --out dist/index.html

      - name: Verify the built page
        run: python scripts/smoke_test.py --page dist/index.html

      - name: Commit the rebuilt site
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -f dist/index.html data/source.xlsx
          if git diff --staged --quiet; then
            echo "No changes to publish."
          else
            git commit -m "Rebuild site from latest sheet [skip ci]"
            git push
          fi

      - name: Publish to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
