# 🔥 Fitness Forge

A personalized fitness web app for everyone — from beginners to advanced athletes.

## Features

- **Onboarding Quiz** → Answer 7 questions, get a fully generated 12–16 week program (or one-tap Skip setup)
- **Manual Builder** → Design your own weekly split and get exercises generated to match
- **Live Workout Logger** → Set-by-set logging with edit/delete, warm-up sets, **supersets**, per-side & time-based logging, a plate calculator, a rest timer, and mid-session add/remove exercises. Screen stays awake; optional local rest-timer notifications
- **Exercise Library** → 900+ exercises (public-domain data) with cues, mistakes and demos — searchable/filterable, plus **create your own** custom exercises
- **Progressive Overload, Equipment, Freestyle, Calisthenics & HIIT** modes
- **Strength Analytics** → Weekly training-volume trend, estimated-1RM progression, PR timeline, and a muscle map (Balance / Fatigue / Strength)
- **Progress** → Strength benchmarks, a GitHub-style training-consistency heatmap, and per-lift charts
- **Recovery & nutrition** → Nutrition, fasting, sleep, activity & body-stats tracking with a weekly report card
- **Import** → Bring your history in from **Strong, Hevy or FitNotes** (CSV)
- **Units** → Full kg / lbs support (inputs convert correctly; data stored canonically)
- **Installable PWA** → Add to home screen, fully offline, 8 themes
- **Settings** → Backup/restore JSON, per-log CSV export, reset, redo quiz, replay tour

## What gets personalized

Every program adapts to:
- **Goal** — Muscle building, fat loss, strength, general fitness, athletic performance
- **Level** — Beginner / Intermediate / Advanced (exercises and rep schemes change)
- **Equipment** — Full gym, dumbbells only, bodyweight, or home gym
- **Days per week** — 3 / 4 / 5 / 6 days (split structure changes entirely)
- **Cardio preference** — None, light, moderate, or heavy
- **Bodyweight** — Used for relative strength benchmarks

## Deploy to GitHub Pages (free)

1. Create a new GitHub repository (e.g. `fitness-forge`)
2. Push all files to the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/fitness-forge.git
   git push -u origin main
   ```
3. Go to your repo → **Settings → Pages**
4. Set source: **Deploy from branch → main → / (root)**
5. Your app is live at: `https://YOUR_USERNAME.github.io/fitness-forge`

## Tech stack

- Vanilla JS (ES modules) — **zero build step, zero dependencies**, no server, no accounts
- CSS custom properties (design tokens + 8 themes)
- Fira Code (Google Fonts)
- Chart.js (vendored locally for offline use)
- localStorage for all persistence; service worker for offline

## File structure

```
fitness-forge/
├── index.html
├── README.md
└── src/
    ├── main.js                  # App boot, shell, routing
    ├── store.js                 # State + localStorage
    ├── style.css                # Full design system
    ├── data/
    │   └── exercises.js         # Exercise database (60+ exercises)
    ├── engine/
    │   └── generator.js         # Program generation logic
    └── components/
        ├── onboarding.js        # Quiz + manual builder
        └── pages.js             # All page renderers
```

## Privacy

All data is stored in your browser's localStorage. Nothing is ever sent to a server.

## Credits

- **Exercise data & images** — [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense / public domain).
- **Feature inspiration** — several workout-logging features (supersets, warm-up sets, time-based logging, muscle map, cross-app import) were inspired by the open-source [openGym](https://gitlab.com/DuarteSantos8/opengym) project. Fitness Forge is an independent, clean-room implementation in vanilla JS and shares **no code** with openGym; it remains MIT-licensed.
