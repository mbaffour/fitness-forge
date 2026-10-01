// Run: node --experimental-default-type=module tools/verify-video-player.mjs
import assert from 'node:assert/strict';
import { EXERCISES } from '../src/data/exercises.js';
import { tutorialId, youtubeId, exerciseVideoHTML, playbackError, mountExerciseVideo } from '../src/components/exercise-video.js';

for (const source of [
  'VmqDIL2xzbk', 'https://youtu.be/VmqDIL2xzbk?t=3',
  'https://www.youtube.com/watch?v=VmqDIL2xzbk',
  'https://www.youtube.com/shorts/VmqDIL2xzbk',
  'https://www.youtube-nocookie.com/embed/VmqDIL2xzbk',
]) assert.equal(youtubeId(source), 'VmqDIL2xzbk');
for (const source of [
  'javascript:alert(1)', 'https://evil.com/watch?v=VmqDIL2xzbk',
  'https://youtube.com.evil.com/watch?v=VmqDIL2xzbk', '"><script>', 'invalid',
]) assert.equal(youtubeId(source), '');
let matched = 0;
for (const [id, ex] of Object.entries(EXERCISES)) {
  const markup = exerciseVideoHTML({...ex,id});
  assert.ok(markup.includes('exercise-video-stage'));
  assert.ok(!markup.includes('youtube.com/results') && !markup.includes('target="_blank"'));
  if (tutorialId({...ex,id})) matched++;
}
assert.match(playbackError(150), /disabled/);
assert.match(playbackError(153), /verify/);
assert.ok(!exerciseVideoHTML({youtubeId:'"><iframe src=evil>'}).includes('<iframe src=evil'));

const players = [];
class Player {
  constructor(node, opts) { this.opts = opts; players.push(this); }
  destroy() { this.destroyed = true; }
}
globalThis.window = {YT:{Player}, location:{origin:'https://mbaffour.github.io'}};
const retry = {addEventListener(type,fn){this[type]=fn;}};
const form = {addEventListener(type,fn){this[type]=fn;}};
const input = {value:''}, feedback = {}, status = {};
const stage = {querySelector:()=>({})};
const section = {querySelector:selector=>({
  '.exercise-video-stage':stage, '.exercise-video-status':status,
  '.exercise-video-retry':retry, input, '#exercise-video-feedback':feedback, form,
})[selector]};
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
const dispose = mountExerciseVideo({querySelector:()=>section}, {id:'ab_wheel'});
await flush();
try {
  assert.equal(players.length, 1);
  assert.equal(players[0].opts.host, 'https://www.youtube-nocookie.com');
  assert.equal(players[0].opts.playerVars.playsinline, 1);
  assert.equal(players[0].opts.playerVars.origin, 'https://mbaffour.github.io');
  players[0].opts.events.onReady();
  assert.match(status.textContent, /Press Play/);
  players[0].opts.events.onError({data:150});
  assert.match(status.textContent, /disabled/);
  assert.equal(retry.hidden, false);
  retry.click(); await flush();
  assert.equal(players.length, 2);
  assert.equal(players[0].destroyed, true);
  input.value = 'https://evil.com/watch?v=VmqDIL2xzbk';
  form.submit({preventDefault(){}});
  assert.equal(players.length, 2);
  assert.match(feedback.textContent, /valid/);
  input.value = 'https://youtu.be/VmqDIL2xzbk';
  form.submit({preventDefault(){}}); await flush();
  assert.equal(players.length, 3);
  assert.equal(players[1].destroyed, true);
} finally { dispose(); delete globalThis.window; }
assert.equal(players.at(-1).destroyed, true);
console.log(`Video player checks passed. ${matched}/${Object.keys(EXERCISES).length} exercises have tutorial IDs.`);
