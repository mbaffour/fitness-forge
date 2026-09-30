// Run: node --experimental-default-type=module tools/verify-programs.mjs
import assert from 'node:assert/strict';
import { PROGRAMS } from '../src/data/programs.js';
import { EXERCISES } from '../src/data/exercises.js';
import { programProgress, requiredItems, prescribedSession, completedProgramKey, sessionMinutes } from '../src/components/program-tools.js';
import { programSuggestion, programProfile } from '../src/components/program-coach.js';

assert.equal(PROGRAMS.length, 52);
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
assert.equal(routines.length,9);
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
console.log('52-plan catalog, personalization, progression and recovery checks passed.');
