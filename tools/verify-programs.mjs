import { COACHED_EXERCISES } from '../src/data/exercises-coached.js';
import { plannedWorkload, programVisualsHTML } from '../src/components/program-visuals.js';
import { movementPattern } from '../src/components/movement-patterns.js';
// Run: node --experimental-default-type=module tools/verify-programs.mjs
import assert from 'node:assert/strict';
import { PROGRAMS } from '../src/data/programs.js';
import { EXERCISES } from '../src/data/exercises.js';
import { programProgress, requiredItems, prescribedSession, completedProgramKey, sessionMinutes } from '../src/components/program-tools.js';
import { programSuggestion, programProfile } from '../src/components/program-coach.js';

assert.equal(PROGRAMS.length, 62);
assert.equal(new Set(PROGRAMS.map(p => p.id)).size, PROGRAMS.length);
for (const p of PROGRAMS) {
  assert.equal(p.days, p.sessions.length, p.id);
  assert.ok(p.weeks > 0);
  for (const s of p.sessions) {
    assert.ok(sessionMinutes(s) > 0);
    for (const e of s.exercises) {
      assert.ok(EXERCISES[e.id], p.id + ': unknown exercise ' + e.id);
      assert.ok(e.sets > 0 && e.reps, p.id);
    }
  }
}
const find = id => PROGRAMS.find(p => p.id === id);
assert.deepEqual(requiredItems(find('foundation_floor'), EXERCISES), []);
assert.deepEqual(requiredItems(find('foundation_return'), EXERCISES), []);
for (const id of ['foundation_db','routine_db_4','routine_busy_2','personalized_home'])
  assert.deepEqual(requiredItems(find(id), EXERCISES), ['dumbbells']);
const floor = find('foundation_floor');
assert.equal(prescribedSession(floor,0,1).exercises[0].sets,2);
assert.equal(prescribedSession(floor,0,3).exercises[0].sets,3);
assert.equal(prescribedSession(floor,0,6).exercises[0].sets,2);
assert.equal(programProgress({done:['w1d0','w1d0','bad','w999d0']},floor).done,1);
assert.equal(programProgress({done:['w1d0','w1d2','w2d0']},floor).week,1);
assert.equal(programProgress({done:['w1d0','w1d1','w1d2']},floor).week,2);
assert.equal(programProgress({done:null},floor).done,0);
const gp={id:floor.id,done:[]};
const session={workoutId:'program-foundation_floor-w1d0',exercises:[{sets:[{completed:true,reps:8}]}]};
assert.equal(completedProgramKey(session,gp,floor),'w1d0');
assert.equal(completedProgramKey({...session,exercises:[]},gp,floor),null);
assert.equal(completedProgramKey({...session,workoutId:'program-other-w1d0'},gp,floor),null);
assert.equal(completedProgramKey({...session,exercises:[{sets:[{completed:true,warmup:true,reps:8}]}]},gp,floor),null);
assert.equal(completedProgramKey({...session,exercises:[{sets:[{completed:true,seconds:20}]}]},gp,floor),'w1d0');
const routines=PROGRAMS.filter(p=>p.cat==='routine');
assert.equal(routines.length,19);
for(const r of routines) {
  assert.equal(prescribedSession(r,0,4).deload,true);
  assert.equal(prescribedSession(r,0,5).deload,false);
  assert.ok(prescribedSession(r,0,4).exercises.every((e,i)=>e.sets===Math.ceil(r.sessions[0].exercises[i].sets/2)));
}
const hist=(reps,rir=2)=>[{exercises:[{exId:'bench_bb',sets:reps.map(reps=>({completed:true,weight:100,reps,rir}))}]}];
const context={programProgression:'double',targetSets:3};
const next=(history,ctx=context)=>programSuggestion('bench_bb','8-12',history,{level:'intermediate'},ctx);
assert.equal(next(hist([12,12,12])).weight,102.5);
assert.equal(next(hist([12,12])).weight,100);
assert.equal(next(hist([14,12,10])).weight,100);
assert.equal(next(hist([12,12,12],0)).weight,100);
assert.equal(next(hist([12,12,12],4)).weight,102.5);
assert.equal(next(hist([12,12,12]),{...context,programDeload:true}).weight,100);
assert.equal(next([{programDeload:true,...hist([8,8])[0]},...hist([12,12,12])]).weight,102.5);
const warmup=hist([12,12,12]); warmup[0].exercises[0].sets.unshift({completed:true,warmup:true,weight:150,reps:5});
assert.equal(next(warmup).weight,102.5);
assert.equal(programSuggestion('bench_bb','5',hist([5,5,5]),{level:'intermediate'},{programProgression:'linear',targetSets:3}).weight,102.5);
const home=find('personalized_home'),strength=find('personalized_strength');
assert.equal(prescribedSession(home,0,1,{level:'beginner'}).exercises[0].sets,2);
assert.equal(prescribedSession(home,0,3,{level:'beginner'}).exercises[0].sets,3);
assert.equal(prescribedSession(home,0,1,{level:'beginner'}).exercises[3].reps,'20s');
assert.equal(prescribedSession(strength,0,1,{level:'beginner'}).exercises[0].reps,'6-8');
assert.equal(prescribedSession(strength,0,1,{level:'intermediate'}).exercises[0].reps,'5-8');
assert.equal(programProfile({weight:160},[{weight:180,date:'2026-09-01'},{weight:170,date:'2026-09-20'},{weight:-1,date:'2026-09-29'}]).weight,170);
assert.equal(programProfile({weight:-50}).weight,null);
assert.equal(programProfile({weight:'invalid',level:'invalid'}).level,'beginner');
assert.equal(programSuggestion('bench_bb','8-12',[],programProfile({}),context).weight,null);
const start=(weight,level='beginner')=>programSuggestion('fx_Dumbbell_Floor_Press','8-12',[],programProfile({weight,level}),context).weight;
assert.ok(start(120)>0 && start(240)>start(120));
assert.ok(start(120,'advanced')>start(120));
assert.equal(programSuggestion('pushup','8-12',[],programProfile({weight:160}),context).weight,null);
console.log('62-plan catalog, personalization, progression and recovery checks passed.');

assert.equal(Object.keys(COACHED_EXERCISES).length,20);
assert.equal(Object.keys(EXERCISES).length,1077);
const normalize = text => text.toLowerCase().replace(/[^a-z0-9]/g,'');
const oldNames = new Set(Object.entries(EXERCISES).filter(([id])=>!COACHED_EXERCISES[id]).map(([,e])=>normalize(e.name)));
for(const [id,e] of Object.entries(COACHED_EXERCISES)) {
  assert.ok(EXERCISES[id] && !oldNames.has(normalize(e.name)), id);
  assert.ok(e.cues.length >= 3 && e.commonErrors.length >= 2, id);
  assert.ok(e.groups.length && e.equip.length && Array.isArray(e.requires), id);
  assert.ok(typeof e.timed === 'boolean' && typeof e.unilateral === 'boolean', id);
  assert.equal(movementPattern(e),e.pattern);
}
for(const p of PROGRAMS) {
  const totals = plannedWorkload(p,EXERCISES,{level:'beginner'},1);
  const expected = p.sessions.reduce((sum,_,i)=>sum+prescribedSession(p,i,1,{level:'beginner'}).exercises.reduce((n,e)=>n+e.sets,0),0);
  assert.equal(totals.sets,expected,p.id);
  assert.equal(Object.values(totals.muscles).reduce((a,b)=>a+b,0),totals.sets,p.id);
  assert.ok(totals.exercises > 0 && totals.minutes > 0,p.id);
  const html=programVisualsHTML(p,EXERCISES,{level:'beginner'},1);
  assert.ok(html.includes('Planned weekly sets:') && !html.includes('NaN') && !html.includes('Infinity'),p.id);
}
const build = PROGRAMS.find(p=>p.id==='routine_fullbody_3');
assert.ok(plannedWorkload(build,EXERCISES,{},4).sets < plannedWorkload(build,EXERCISES,{},3).sets);
const carryHist = [{exercises:[{exId:'ff_suitcase_march',sets:[{completed:true,seconds:20,reps:0,weight:25}]}]}];
assert.equal(programSuggestion('ff_suitcase_march','20s',carryHist,{weight:160,level:'beginner'},{programProgression:'double',targetSets:3}).weight,25);
console.log('20 coached exercises and all 62 workload visualizations checked.');
