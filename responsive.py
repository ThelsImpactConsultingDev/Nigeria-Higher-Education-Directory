#!/usr/bin/env python3
"""Final check on the built page, after the data has already passed validation.

Catches breakage in the HTML itself rather than the data: a patch that silently
did nothing, placeholder text that reappeared, or a page that lost its script.

    python scripts/smoke_test.py [--page dist/index.html]
"""
import argparse, re, sys

MUST_CONTAIN = [
    ('const RAW_DATA',        'data payload missing'),
    ('function normalize',    'decoder missing'),
    ('const ALL = [',         'record list missing'),
    ('COMING_SOON',           'coming-soon handling missing'),
    ('id="comingSoon"',       'coming-soon panel missing'),
    ('const fmt =',           'number formatting missing'),
    ('Cut-off: coming soon',  'cut-off placeholder label missing'),
    ('Accreditation: coming soon', 'accreditation placeholder label missing'),
]

MUST_NOT_CONTAIN = [
    ("getElementById('accredSelect')",     'dead reference to the removed accreditation filter'),
    ("getElementById('scoreInput')",       'dead reference to the removed score input'),
    ("getElementById('cutoffYearSelect')", 'dead reference to the removed year selector'),
    ('cutoff_mark',                        'removed sort option is still referenced'),
    ('monotechnics and colleges of health in Nigeria', 'stale copy promising unloaded categories'),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--page', default='dist/index.html')
    args = ap.parse_args()

    html = open(args.page, encoding='utf-8').read()
    problems = []

    for needle, why in MUST_CONTAIN:
        if needle not in html:
            problems.append(f"{why}  (expected to find {needle!r})")

    for needle, why in MUST_NOT_CONTAIN:
        if needle in html:
            problems.append(f"{why}  (found {needle!r})")

    scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.S)
    if not scripts:
        problems.append('page contains no inline script')
    else:
        body = scripts[0]
        # cheap balance check; a truncated payload usually shows up here
        for open_c, close_c in (('{', '}'), ('[', ']'), ('(', ')')):
            if body.count(open_c) != body.count(close_c):
                problems.append(f"unbalanced {open_c}{close_c} in the inline script "
                                f"({body.count(open_c)} vs {body.count(close_c)})")

    size_mb = len(html) / 1024 / 1024
    if size_mb > 5:
        problems.append(f"page is {size_mb:.1f} MB — too heavy to ship")

    print(f"page: {args.page}  ({size_mb:.2f} MB)")
    if problems:
        print("\nSMOKE TEST FAILED")
        for p in problems:
            print(f"  x {p}")
        sys.exit(1)
    print("Smoke test passed.")


if __name__ == '__main__':
    main()
