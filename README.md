# 🔥 Fitness Forge

A personalized fitness web app for everyone — from beginners to advanced athletes.

## Features

- **Onboarding Quiz** → Answer 7 questions, get a fully generated 12–16 week program
- **Manual Builder** → Design your own weekly split and get exercises generated to match
- **Workout Page** → Full exercise table for today's session — sets, reps, rest, notes
- **Schedule** → Full 7-day overview per phase
- **Progress** → Strength benchmarks relative to bodyweight, cardio targets
- **Workout Log** → Mark sessions complete, persisted to localStorage
- **Settings** → Reset, redo quiz, or switch to manual builder

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

- Vanilla JS (ES modules) — **zero build step, zero dependencies**
- CSS custom properties
- Google Fonts (Barlow Condensed, Lora, Fira Code)
- localStorage for all persistence

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
