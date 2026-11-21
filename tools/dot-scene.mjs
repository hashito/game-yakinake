// Every surface dot (standard 1.21.0; 水無瀬病院 ドット版 2026-11-21 「非常灯などがドットでないです」「壁もドット絵でないです。全てドットで再構築してください」).
// dotSceneSource() is page code over the running game's scene: every visible mesh / sprite material must be a sprite stack (vertex colours,
// graded to the palette), a dot tile or a quantized picture (js/dot-world.js dotifyScene: userData.dot, NearestFilter, palette colours only).
// A photo texture, a plain material, a smooth texture fail - walls, floors and ceilings included (no allowed list).
//   const r = await page.evaluate(dotSceneSource());   // -> { n, ok, bad: [['object | material | why', count]] }
// check-playtest P33 runs it in every room of a dot game (game.json "dot" or "style": "pixel").
export { dotSceneSource } from '../js/kit/dot-world.js';
