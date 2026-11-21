# 夜勤明けの街

A 3D first-person game on the game-kit standard (docs/standard-3d.md in game-kit). Everything is data: `game.json`, `data/*.json`.
Game-specific code goes only into `js/ext/`; the look into `css/theme-game.css` (design tokens).

```
npm run serve      # http://localhost:8000/
npm test           # data checks
npm run plan       # floor-plan check (strict)
npm run media      # photos listed in the data exist
npm run smoke      # headless: start -> first task -> ending (needs Edge/Chrome; serves by itself)
npm run sync-kit   # copy the newest kit parts (kit.json lists them)
```
