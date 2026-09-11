#!/usr/bin/env bash
# Backfill the release tags that were never pushed.
#
# CLAUDE.md documents every version from v2.9 on, but the remote only carries
# tags up to v2.8-stable — the sessions that shipped v2.9+ could not push to
# refs/tags/*. Each tag below points at the commit that shipped that version
# (the one that added its row to the version-history table), matching how the
# existing v2.x tags were made. All are ancestors of master; re-running is safe.
#
#   bash tools/backfill-tags.sh          # create locally
#   bash tools/backfill-tags.sh --push   # create and push
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PUSH=0; [ "${1:-}" = "--push" ] && PUSH=1
git fetch origin --quiet
created=()

if git rev-parse -q --verify "refs/tags/v2.9-stable" >/dev/null; then
  echo "  = v2.9-stable already exists"
else
  git tag -a "v2.9-stable" 0b95e40 -m "v2.9-stable — Progressive-Overload mode (rotating 3-day full-body split covering all 12 muscle groups wi"
  echo "  + v2.9-stable -> 0b95e40"; created+=("v2.9-stable")
fi
if git rev-parse -q --verify "refs/tags/v3.0-stable" >/dev/null; then
  echo "  = v3.0-stable already exists"
else
  git tag -a "v3.0-stable" 2e12153 -m "v3.0-stable — UI/UX redesign: fixed design tokens (--surface, --ff-display, --s-1"
  echo "  + v3.0-stable -> 2e12153"; created+=("v3.0-stable")
fi
if git rev-parse -q --verify "refs/tags/v3.3" >/dev/null; then
  echo "  = v3.3 already exists"
else
  git tag -a "v3.3" b4c0ca9 -m "v3.3 — Real PWA icons (previous files were 70-byte placeholders), Exercise Library page (search +"
  echo "  + v3.3 -> b4c0ca9"; created+=("v3.3")
fi
if git rev-parse -q --verify "refs/tags/v3.4" >/dev/null; then
  echo "  = v3.4 already exists"
else
  git tag -a "v3.4" f3f710a -m "v3.4 — ~760 more exercises"
  echo "  + v3.4 -> f3f710a"; created+=("v3.4")
fi
if git rev-parse -q --verify "refs/tags/v3.5" >/dev/null; then
  echo "  = v3.5 already exists"
else
  git tag -a "v3.5" f661dec -m "v3.5 — Correctness:"
  echo "  + v3.5 -> f661dec"; created+=("v3.5")
fi
if git rev-parse -q --verify "refs/tags/v3.6" >/dev/null; then
  echo "  = v3.6 already exists"
else
  git tag -a "v3.6" 2b7cf65 -m "v3.6 — Openly-licensed animated illustrations"
  echo "  + v3.6 -> 2b7cf65"; created+=("v3.6")
fi
if git rev-parse -q --verify "refs/tags/v3.7" >/dev/null; then
  echo "  = v3.7 already exists"
else
  git tag -a "v3.7" 7441de1 -m "v3.7 — 157 net-new animated exercises"
  echo "  + v3.7 -> 7441de1"; created+=("v3.7")
fi
if git rev-parse -q --verify "refs/tags/v3.8" >/dev/null; then
  echo "  = v3.8 already exists"
else
  git tag -a "v3.8" 70c08de -m "v3.8 — Interactive Body Map trainer"
  echo "  + v3.8 -> 70c08de"; created+=("v3.8")
fi
if git rev-parse -q --verify "refs/tags/v3.9" >/dev/null; then
  echo "  = v3.9 already exists"
else
  git tag -a "v3.9" 3b32f4f -m "v3.9 — Fitbod-style Body Map detail"
  echo "  + v3.9 -> 3b32f4f"; created+=("v3.9")
fi
if git rev-parse -q --verify "refs/tags/v3.10" >/dev/null; then
  echo "  = v3.10 already exists"
else
  git tag -a "v3.10" 60b4591 -m "v3.10 — Real anatomical body model"
  echo "  + v3.10 -> 60b4591"; created+=("v3.10")
fi
if git rev-parse -q --verify "refs/tags/v3.11" >/dev/null; then
  echo "  = v3.11 already exists"
else
  git tag -a "v3.11" e43c009 -m "v3.11 — Goal Programs"
  echo "  + v3.11 -> e43c009"; created+=("v3.11")
fi
if git rev-parse -q --verify "refs/tags/v3.12" >/dev/null; then
  echo "  = v3.12 already exists"
else
  git tag -a "v3.12" 3ae3714 -m "v3.12 — Proper anatomical body map + exercise demos from the map"
  echo "  + v3.12 -> 3ae3714"; created+=("v3.12")
fi
if git rev-parse -q --verify "refs/tags/v3.13" >/dev/null; then
  echo "  = v3.13 already exists"
else
  git tag -a "v3.13" faed933 -m "v3.13 — Multi-muscle targeting + challenges + 21 more programs"
  echo "  + v3.13 -> faed933"; created+=("v3.13")
fi
if git rev-parse -q --verify "refs/tags/v3.14" >/dev/null; then
  echo "  = v3.14 already exists"
else
  git tag -a "v3.14" 02a7404 -m "v3.14 — Interactive tutorials, everywhere there's an exercise"
  echo "  + v3.14 -> 02a7404"; created+=("v3.14")
fi
if git rev-parse -q --verify "refs/tags/v3.15" >/dev/null; then
  echo "  = v3.15 already exists"
else
  git tag -a "v3.15" edc5a6f -m "v3.15 — Video-tutorial pipeline + better fallback"
  echo "  + v3.15 -> edc5a6f"; created+=("v3.15")
fi
if git rev-parse -q --verify "refs/tags/v3.16" >/dev/null; then
  echo "  = v3.16 already exists"
else
  git tag -a "v3.16" 388b5b5 -m "v3.16 — Bug fixes + tutorial visuals for the other 774"
  echo "  + v3.16 -> 388b5b5"; created+=("v3.16")
fi
if git rev-parse -q --verify "refs/tags/v3.17" >/dev/null; then
  echo "  = v3.17 already exists"
else
  git tag -a "v3.17" a0a5d56 -m "v3.17 — 42 of 109 embedded videos were dead"
  echo "  + v3.17 -> a0a5d56"; created+=("v3.17")
fi
if git rev-parse -q --verify "refs/tags/v3.18" >/dev/null; then
  echo "  = v3.18 already exists"
else
  git tag -a "v3.18" 6c1e6d6 -m "v3.18 — Media everywhere + a generator that no longer eats its own output"
  echo "  + v3.18 -> 6c1e6d6"; created+=("v3.18")
fi
if git rev-parse -q --verify "refs/tags/v3.19" >/dev/null; then
  echo "  = v3.19 already exists"
else
  git tag -a "v3.19" 3b36a10 -m "v3.19 — You can now open any exercise from anywhere it appears"
  echo "  + v3.19 -> 3b36a10"; created+=("v3.19")
fi
if git rev-parse -q --verify "refs/tags/v3.20" >/dev/null; then
  echo "  = v3.20 already exists"
else
  git tag -a "v3.20" 4e1b5e7 -m "v3.20 — HIIT rebuilt on the real exercise database — its media was entirely broken"
  echo "  + v3.20 -> 4e1b5e7"; created+=("v3.20")
fi
if git rev-parse -q --verify "refs/tags/v3.21" >/dev/null; then
  echo "  = v3.21 already exists"
else
  git tag -a "v3.21" 1bf8c20 -m "v3.21 — All 16 HIIT moves mapped + a full media audit"
  echo "  + v3.21 -> 1bf8c20"; created+=("v3.21")
fi
if git rev-parse -q --verify "refs/tags/v3.22" >/dev/null; then
  echo "  = v3.22 already exists"
else
  git tag -a "v3.22" f363988 -m "v3.22 — Full audit — every exercise now has a picture"
  echo "  + v3.22 -> f363988"; created+=("v3.22")
fi
if git rev-parse -q --verify "refs/tags/v3.23" >/dev/null; then
  echo "  = v3.23 already exists"
else
  git tag -a "v3.23" abdff9a -m "v3.23 — Verified by running the app, not by reading it — and it found real bugs"
  echo "  + v3.23 -> abdff9a"; created+=("v3.23")
fi
if git rev-parse -q --verify "refs/tags/v3.24" >/dev/null; then
  echo "  = v3.24 already exists"
else
  git tag -a "v3.24" 970a85b -m "v3.24 — Starting weights are computed from the person, not a lookup table"
  echo "  + v3.24 -> 970a85b"; created+=("v3.24")
fi
if git rev-parse -q --verify "refs/tags/v3.25" >/dev/null; then
  echo "  = v3.25 already exists"
else
  git tag -a "v3.25" 23383bb -m "v3.25 — Freestyle and Body Map get the same treatment — and one shared rule replaces three disagre"
  echo "  + v3.25 -> 23383bb"; created+=("v3.25")
fi
if git rev-parse -q --verify "refs/tags/v3.26" >/dev/null; then
  echo "  = v3.26 already exists"
else
  git tag -a "v3.26" 816ecba -m "v3.26 — Equipment and Calisthenics finish the sweep"
  echo "  + v3.26 -> 816ecba"; created+=("v3.26")
fi
if git rev-parse -q --verify "refs/tags/v3.27" >/dev/null; then
  echo "  = v3.27 already exists"
else
  git tag -a "v3.27" e3a960e -m "v3.27 — Programs and Challenges — the last two sections"
  echo "  + v3.27 -> e3a960e"; created+=("v3.27")
fi

# v3.27-stable is an alias for the current release, matching the naming in
# CLAUDE.md coding rule 8.
if ! git rev-parse -q --verify "refs/tags/v3.27-stable" >/dev/null; then
  git tag -a v3.27-stable e3a960e -m "v3.27-stable — current stable release"
  echo "  + v3.27-stable -> e3a960e"; created+=("v3.27-stable")
fi

echo; echo "${#created[@]} tag(s) created locally."

# Push everything that exists here but not on the remote — not just what this
# run created, or a second invocation would report "nothing to do" while the
# remote is still empty.
remote_tags="$(git ls-remote --tags origin | sed -n 's#.*refs/tags/\([^^]*\)$#\1#p' | sort -u)"
missing=()
while read -r t; do
  [ -n "$t" ] || continue
  grep -qxF "$t" <<<"$remote_tags" || missing+=("$t")
done < <(git tag -l)

if [ ${#missing[@]} -eq 0 ]; then
  echo "remote already has every local tag."
  exit 0
fi
echo "${#missing[@]} tag(s) missing from origin: ${missing[*]}"
if [ "$PUSH" != "1" ]; then
  echo "Re-run with --push to publish them."
  exit 0
fi
echo; echo "pushing..."
git push origin "${missing[@]}"
