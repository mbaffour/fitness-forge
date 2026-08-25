# Attribution & Media Licensing

Fitness Forge bundles no third-party exercise media in this repository. Visual
content is either public domain or openly licensed and loaded at runtime from its
source, with attribution shown in-app.

## Animated exercise illustrations — workout-guide (CC BY-SA 4.0)

Animated exercise illustrations are provided by
[workout-guide](https://github.com/bryllim/workout-guide) by **Bryl Lim**, whose
pose artwork derives from **[Everkinetic](https://github.com/everkinetic/data)**.

- **Licence:** [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/)
- **Use:** the app hotlinks the frame SVGs at runtime (`raw.githubusercontent.com/bryllim/workout-guide/...`); the assets are **not** modified or vendored here.
- **Credit shown in-app:** "© Bryl Lim / Everkinetic · CC BY-SA 4.0" beneath each animation, linking to the source.
- Generated map: `tools/import-workout-guide.mjs` → `src/data/exercise-anim.js` (URLs only).

## Static exercise images — free-exercise-db (public domain)

Still-image previews come from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db) (Unlicense / public
domain), hotlinked at runtime. Generator: `tools/import-free-exercise-db.mjs`.

## Animated GIFs — hasaneyldrm/exercises-dataset

Some exercises reference GIFs from
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
(© Gym Visual), hotlinked at runtime and never redistributed here; the required
"© Gym Visual" credit is shown in-app. These are used only as a fallback where a
CC BY-SA workout-guide animation is not available.

## Video tutorials — YouTube

Where no embedded demo exists, the app links to a YouTube search for the movement.
No video is rehosted.

## Feature inspiration — openGym (AGPL-3.0)

Several features were **inspired by** the AGPL-3.0 project
[openGym](https://gitea.com/DuarteSantos/openGym) and reimplemented from scratch
(clean-room). **No openGym source code was copied**, so Fitness Forge remains under
its own licence.
