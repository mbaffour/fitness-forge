// Unit tests for the Project 500 engine and the AFT scoring logic.
//   node tools/test-project500.mjs
// Pure Node, no dependencies. Exits non-zero on the first failure.
//
// The score-lookup tests use a SMALL SYNTHETIC table built for the test only —
// it checks how a lookup behaves (thresholds, direction, no interpolation) and
// is not, and must never be mistaken for, an official Army table.

import * as E from '../src/engine/project500.js';
import { scoreEvent, scoreTest, validateRows, bandForAge, tableKey } from '../src/data/aft-standards.js';

let n = 0, failed = 0;
const eq = (name, got, want) => {
  n++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { failed++; console.error(`✗ ${name}\n    got  ${JSON.stringify(got)}\n    want ${JSON.stringify(want)}`); }
};
const truthy = (name, v) => eq(name, !!v, true);

// ── Time + pace ──
eq('parseTime 13:25', E.parseTime('13:25'), 805);
eq('parseTime 1:02:10', E.parseTime('1:02:10'), 3730);
eq('parseTime seconds', E.parseTime('90'), 90);
eq('parseTime rejects 1:75', E.parseTime('1:75'), null);
eq('parseTime rejects junk', E.parseTime('abc'), null);
eq('fmtTime 805', E.fmtTime(805), '13:25');
eq('fmtTime 3730', E.fmtTime(3730), '1:02:10');
// Reference table: 2-mile time → mile pace → treadmill mph.
for (const [t, pace, speed] of [['20:00', '10:00', 6.0], ['18:00', '9:00', 6.7], ['16:00', '8:00', 7.5], ['15:00', '7:30', 8.0], ['14:00', '7:00', 8.6], ['13:25', '6:43', 8.9]]) {
  const q = E.twoMileEquivalents(E.parseTime(t));
  eq(`2-mile ${t} → pace`, E.fmtTime(q.pace), pace);
  eq(`2-mile ${t} → mph`, q.mph, speed);
}
eq('pace per mile', E.pacePerMile(1500, 3), 500);
eq('mph', Math.round(E.mph(1800, 3) * 10) / 10, 6);
eq('max HR estimate', E.maxHR({ age: 30 }), { bpm: 190, estimate: true });
eq('max HR own', E.maxHR({ maxHr: 195, age: 30 }), { bpm: 195, estimate: false });
eq('zone 2', E.hrZone(125, 190).zone, 2);
eq('zone 4', E.hrZone(160, 190).zone, 4);

// ── Schedule ──
const p = E.newProgram({ start: '2026-11-30' });
p.status = 'active';
eq('start is a Monday', E.weekdayIdx('2026-11-30'), 0);
eq('week 1', E.weekInfo(p, '2026-11-30').week, 1);
eq('week 1 Sunday', E.weekInfo(p, '2026-12-06').week, 1);
eq('week 2', E.weekInfo(p, '2026-12-07').week, 2);
eq('week 4 deload', E.weekInfo(p, '2026-12-21').deload, true);
eq('week 14 phase 2', E.weekInfo(p, E.weekStartDate(p, 14)).phase, 2);
eq('week 52 end date', E.programEndDate(p), '2027-11-28');
eq('after end', E.weekInfo(p, '2027-11-29').done, true);
eq('before start', E.weekInfo(p, '2026-11-29').pre, true);
eq('Mon lower', E.dayPlan(p, '2026-11-30').tpl, 'lower');
eq('Tue speed', E.dayPlan(p, '2026-12-01').tpl, 'speed');
eq('Wed recovery', E.dayPlan(p, '2026-12-02').tpl, 'recovery');
eq('Sat military', E.dayPlan(p, '2026-12-05').tpl, 'military');
eq('Sun rest', E.dayPlan(p, '2026-12-06').tpl, 'rest');
eq('week 4 Tue event check', E.dayPlan(p, '2026-12-22').tpl, 'checkA');
eq('week 4 Fri 2-mile trial', E.dayPlan(p, '2026-12-25').tpl, 'checkRun');
eq('week 4 Sat (phase 1) stays conditioning', E.dayPlan(p, '2026-12-26').tpl, 'military');
eq('week 12 Sat full AFT', E.dayPlan(p, E.addDays(E.weekStartDate(p, 12), 5)).tpl, 'aft');
eq('week 16 Sat SDC check (phase 2)', E.dayPlan(p, E.addDays(E.weekStartDate(p, 16), 5)).tpl, 'checkSdc');
p.prefs.sat = 'soccer';
eq('Saturday soccer preference', E.dayPlan(p, '2026-12-05').tpl, 'soccer');
p.prefs.sat = 'military';

// Pause: two full calendar weeks off → the program resumes at week 2, as a return week.
const q = E.newProgram({ start: '2026-11-30' });
q.pauses = [{ from: '2026-12-07', to: '2026-12-20' }];
eq('paused week', E.weekInfo(q, '2026-12-10').paused, true);
eq('resume at week 2', E.weekInfo(q, '2026-12-21').week, 2);
eq('return week flagged', E.weekInfo(q, '2026-12-21').ret, true);
eq('return week after that is normal', E.weekInfo(q, '2026-12-28').ret, false);
eq('end date shifts by 2 weeks', E.programEndDate(q), '2027-12-12');
eq('paused day plan', E.dayPlan(q, '2026-12-08').kind, 'paused');
// A short pause (3 days) does not drop a week — those days are just off.
const r = E.newProgram({ start: '2026-11-30' });
r.pauses = [{ from: '2026-12-08', to: '2026-12-10' }];
eq('short pause keeps the week', E.weekInfo(r, '2026-12-11').week, 2);
eq('short pause day is off', E.dayPlan(r, '2026-12-09').kind, 'paused');
// An open pause (still paused) blocks everything after it.
const o = E.newProgram({ start: '2026-11-30' });
o.pauses = [{ from: '2026-12-03', to: null }];
eq('open pause', E.dayPlan(o, '2026-12-15').kind, 'paused');

// Moving: within a week, swapping rather than stacking.
const m = E.newProgram({ start: '2026-11-30' });
eq('move Mon→Sun ok', E.moveSession(m, '2026-11-30', '2026-12-06').ok, true);
eq('Sun now lower', E.dayPlan(m, '2026-12-06').tpl, 'lower');
eq('Mon now rest', E.dayPlan(m, '2026-11-30').tpl, 'rest');
eq('Mon marked moved', E.dayPlan(m, '2026-11-30').kind, 'moved');
eq('swap two sessions', (E.moveSession(m, '2026-12-01', '2026-12-03'), [E.dayPlan(m, '2026-12-03').tpl, E.dayPlan(m, '2026-12-01').tpl]), ['speed', 'full']);
eq('no cross-week moves', E.moveSession(m, '2026-12-04', '2026-12-08').ok, false);

// Rescheduling a missed session never stacks hard days.
const s = E.newProgram({ start: '2026-11-30' });
eq('missed Tue run → Wed or Sun', E.rescheduleOptions(s, '2026-12-01', '2026-12-01'), ['2026-12-02', '2026-12-06']);
eq('missed Mon lower → nowhere safe', E.rescheduleOptions(s, '2026-11-30', '2026-11-30'), []);
eq('missed Fri easy run → Sun', E.rescheduleOptions(s, '2026-12-04', '2026-12-04'), ['2026-12-06']);

// ── Prescriptions ──
const b = E.newProgram({ start: '2026-11-30' });
b.baseline = { date: '2026-11-28', dl3: 225, hrp: 24, plk: 95, tmr: 1170, runLevel: 'c20' };
eq('deadlift start from safe 3RM', E.deadliftStart(b.baseline), 200);
b.lifts.trap_dl = { work: 200 };
const mon1 = E.liftPrescription(b, E.dayPlan(b, '2026-11-30'));
eq('wk1 Monday 4×5 @200', [mon1[0].sets, mon1[0].reps, mon1[0].weight], [4, '5', 200]);
const thu1 = E.liftPrescription(b, E.dayPlan(b, '2026-12-03'));
eq('wk1 Thursday 3×5 lighter', [thu1[0].sets, thu1[0].weight], [3, 170]);
const mon4 = E.liftPrescription(b, E.dayPlan(b, '2026-12-21'));
eq('deload Monday: fewer sets, ~90%', [mon4[0].sets, mon4[0].weight], [3, 180]);
const mon14 = E.liftPrescription(b, E.dayPlan(b, E.weekStartDate(b, 14)));
eq('phase 2 Monday 4×4', [mon14[0].sets, mon14[0].reps], [4, '4']);
const mon27 = E.liftPrescription(b, E.dayPlan(b, E.weekStartDate(b, 27)));
eq('phase 3 Monday 4×3', [mon27[0].sets, mon27[0].reps], [4, '3']);
eq('push-ups sub-max from best 24', E.liftPrescription(b, E.dayPlan(b, '2026-12-01'))[0].reps, '12');
eq('plank holds from best 95s', E.liftPrescription(b, E.dayPlan(b, '2026-11-30')).at(-1).reps, '50s');
const noDl = E.newProgram({ start: '2026-11-30' });
eq('no fabricated deadlift weight', E.liftPrescription(noDl, E.dayPlan(noDl, '2026-11-30'))[0].weight, null);
b.prefs.equip.trapbar = false;
const subd = E.liftPrescription(b, E.dayPlan(b, '2026-11-30'))[0];
eq('no trap bar → conventional, flagged substitute', [subd.exId, subd.sub], ['deadlift', true]);
b.prefs.equip.trapbar = true;

// Running: never volume and intensity in the same week.
const runs = [];
for (let w = 1; w <= 13; w++) runs.push(E.runPrescription(b, E.dayPlan(b, E.addDays(E.weekStartDate(b, w), 1)))?.reps);
eq('phase 1 interval counts (test weeks have no intervals; steps lag the pace update)', runs, [4, 4, 4, null, 4, 5, 5, null, 5, 6, 6, null, 6]);
const tue1 = E.runPrescription(b, E.dayPlan(b, '2026-12-01'));
eq('400 m split from 19:30 2-mile at 97%', E.fmtTime(tue1.split), '2:21');
const fri = (w) => E.runPrescription(b, E.dayPlan(b, E.addDays(E.weekStartDate(b, w), 4)));
eq('easy run grows ~2 min/week', [fri(1).min, fri(2).min, fri(3).min, fri(5).min], [25, 27, 29, 31]);
eq('easy run capped in phase 1', fri(13).min <= 35, true);
const none = E.newProgram({ start: '2026-11-30' });
none.baseline = { date: '2026-11-28', runLevel: 'none' };
eq('run/walk alternative for beginners', !!E.runPrescription(none, E.dayPlan(none, '2026-12-01')).alt, true);
eq('no 2-mile → no fabricated split', E.runPrescription(none, E.dayPlan(none, '2026-12-01')).split, null);

// ── Adaptive deadlift progression ──
const plan = { deload: false, ret: false };
const set = (weight, reps, rir) => ({ completed: true, weight, reps, rir });
eq('RIR 3 → +10', E.progressDeadlift({ work: 200, prescribedSets: 4, targetReps: 5, sets: [set(200, 5, 3), set(200, 5, 3), set(200, 5, 3), set(200, 5, 3)], plan }).next, 210);
eq('RIR 2 → +5', E.progressDeadlift({ work: 200, prescribedSets: 4, targetReps: 5, sets: [set(200, 5, 3), set(200, 5, 2), set(200, 5, 2), set(200, 5, 2)], plan }).next, 205);
eq('RIR 1 → hold', E.progressDeadlift({ work: 200, prescribedSets: 4, targetReps: 5, sets: [set(200, 5, 2), set(200, 5, 1), set(200, 5, 1), set(200, 5, 1)], plan }).next, 200);
eq('no RIR logged → +5', E.progressDeadlift({ work: 200, prescribedSets: 4, targetReps: 5, sets: [set(200, 5), set(200, 5), set(200, 5), set(200, 5)], plan }).next, 205);
eq('missed reps → −5%', E.progressDeadlift({ work: 200, prescribedSets: 4, targetReps: 5, sets: [set(200, 5, 1), set(200, 5, 0), set(200, 4, 0), set(200, 3, 0)], plan }).next, 190);
eq('too few sets → back off', E.progressDeadlift({ work: 200, prescribedSets: 4, targetReps: 5, sets: [set(200, 5, 3), set(200, 5, 3)], plan }).next, 190);
eq('pain → never increases', E.progressDeadlift({ work: 200, prescribedSets: 4, targetReps: 5, sets: [set(200, 5, 4), set(200, 5, 4), set(200, 5, 4), set(200, 5, 4)], plan, flags: { pain: true } }).next, 200);
eq('deload → carries over', E.progressDeadlift({ work: 200, prescribedSets: 3, targetReps: 5, sets: [set(180, 5, 4)], plan: { deload: true } }).next, 200);
eq('warm-ups ignored', E.progressDeadlift({ work: 200, prescribedSets: 4, targetReps: 5, sets: [{ ...set(135, 5, 5), warmup: true }, set(200, 5, 3), set(200, 5, 3), set(200, 5, 3), set(200, 5, 3)], plan }).next, 210);

// ── Readiness ──
eq('readiness green', E.readinessScore({ sleepQ: 5, soreness: 2, energy: 8, stress: 3 }).level, 'green');
eq('readiness red', E.readinessScore({ sleepQ: 1, soreness: 9, energy: 2, stress: 9 }).level, 'red');
eq('pain overrides', E.readinessScore({ sleepQ: 5, soreness: 1, energy: 10, stress: 1, pain: true }).level, 'red');
eq('empty check-in', E.readinessScore({}), null);

// ── Objectives / targets ──
eq('lower is better for runs', [E.meets('tmr', 800, 805), E.meets('tmr', 810, 805)], [true, false]);
eq('progress half way', E.progressTo('mdl', 200, 275, 350), 0.5);
eq('progress for time event', E.progressTo('tmr', 1200, 1000, 800), 0.5);
// No personal defaults ship: a new program assumes nobody's category or targets.
const fresh = E.newProgram();
eq('no assumed sex / age band', [fresh.standard.sex, fresh.standard.band], [null, null]);
eq('no built-in targets', fresh.targets, {});
eq('default start is a Monday', E.weekdayIdx(fresh.startDate), 0);
eq('nothing to score against by default', E.activeTable(fresh).table, null);
eq('no targets → no milestones invented', E.milestonesFor(fresh).every((m) => Object.values(m).every((v) => v == null)), true);
// Milestones come from the person's own start and target: 25 / 50 / 75 / 100 %.
const ob = E.newProgram({ start: '2026-11-30' });
ob.targets = { mdl: 300, hrp: 60, tmr: 800, plk: 180 };
ob.baseline = { date: '2026-11-28', mdl: 200, hrp: 20, tmr: 1200 };
eq('deadlift milestones', E.milestonesFor(ob).map((m) => m.mdl), [225, 250, 275, 300]);
eq('push-up milestones', E.milestonesFor(ob).map((m) => m.hrp), [30, 40, 50, 60]);
eq('2-mile milestones (lower is better)', E.milestonesFor(ob).map((m) => m.tmr), [1100, 1000, 900, 800]);
eq('no starting point → only the final target', E.milestonesFor(ob).map((m) => m.plk), [null, null, null, 180]);
eq('no target → nothing', E.milestonesFor(ob).map((m) => m.sdc), [null, null, null, null]);
ob.tests = [{ id: 1, date: '2026-12-22', kind: 'check', events: { tmr: { raw: 1095 }, hrp: { raw: 31 }, mdl: { raw: 260, sub: true } } }];
eq('objectives met (substitute ignored)', E.objectivesMet(ob), 2);
eq('objective dates', E.objectiveDates(ob).map((o) => `${o.phase}${o.id}@${o.date}`), ['1hrp@2026-12-22', '1tmr@2026-12-22']);
eq('first result anchors when no baseline', (() => { const z = E.newProgram({ start: '2026-11-30' }); z.targets = { plk: 180 }; z.tests = [{ id: 1, date: '2026-12-01', kind: 'check', events: { plk: { raw: 60 } } }]; return E.milestonesFor(z).map((m) => m.plk); })(), [90, 120, 150, 180]);
const FIX100 = { mdl: [[60, 150], [100, 340]] };
const tb = E.newProgram({ start: '2026-11-30' });
tb.standard = { std: 'general', sex: 'male', band: '27-31' };
tb.tables = { 'general:male:27-31': FIX100 };
eq('target falls back to a loaded table’s 100-point value', E.targetsFor(tb).mdl, 340);
tb.targets = { mdl: 320 };
eq('own target wins over the table', E.targetsFor(tb).mdl, 320);
eq('combat category ignores sex', (() => { const c = E.newProgram(); c.standard = { std: 'combat', sex: null, band: '22-26' }; return E.activeTable(c).key; })(), 'combat:any:22-26');
eq('CFT locked until base built', E.cftUnlocked(ob, '2026-12-28').unlocked, false);

// ── Gamification ──
const g = E.newProgram({ start: '2026-11-30' });
const wk1 = ['2026-11-30', '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'];
g.log = [...wk1.slice(0, 5).flatMap((d, i) => (i === 1 || i === 4 ? [{ date: d, block: 'run' }, { date: d, block: 'lift' }] : [{ date: d, block: i === 2 ? 'activity' : 'lift' }])),
         { date: '2026-12-07', block: 'lift' }, { date: '2026-12-08', block: 'run' }];
const mw = E.missionWeeks(g, '2026-12-14');
eq('mission: 5 of 6 meets it, on the 5th session', [mw[0].met, mw[0].completed, mw[0].need, mw[0].metOn], [true, 5, 5, '2026-12-04']);
eq('mission: a thin week does not', [mw[1].met, mw[1].completed], [false, 1]);
eq('mission streak breaks on a missed week', E.missionStreak(mw), 0);
eq('current unmet week is not counted yet', E.missionWeeks(g, '2026-12-09').length, 1);
const sr = E.serviceRecord(g, '2026-12-14');
eq('service record: 1 mission → 2 points, Recruit', [sr.points, sr.abbr], [2, 'RCT']);
const big = E.newProgram({ start: '2026-11-30' });
big.targets = { mdl: 300, hrp: 60, tmr: 800, plk: 180, sdc: 100 };
big.baseline = { date: '2026-11-28', mdl: 200, hrp: 20, tmr: 1200, plk: 60, sdc: 160 };
big.tests = [{ id: 1, date: '2027-03-01', kind: 'aft', events: { mdl: { raw: 260 }, hrp: { raw: 45 }, sdc: { raw: 130 }, plk: { raw: 125 }, tmr: { raw: 990 } } }];
const br = E.serviceRecord(big, '2027-03-02');
eq('service record points (10 objectives + 1 AFT)', [br.obj, br.points, br.abbr], [10, 43, 'SGT']);
eq('phase 1 cleared', br.phasesCleared, 2);
eq('event tiers', Object.fromEntries(Object.entries(br.tiers).map(([k, v]) => [k, v.tier])), { mdl: 2, hrp: 2, sdc: 2, plk: 2, tmr: 2 });
eq('maxed event is platinum', (() => { big.tests.push({ id: 2, date: '2027-06-01', kind: 'check', events: { tmr: { raw: 790 } } }); return E.eventTiers(big).tmr.tier; })(), 4);
eq('grades climb', E.GRADES.every((x, i, a) => !i || x.min > a[i - 1].min), true);

// ── AFT scoring logic (synthetic fixture — NOT an official table) ──
const FIX = { mdl: [[0, 0], [60, 150], [80, 250], [100, 340]], tmr: [[0, 1800], [60, 1200], [100, 800]] };
eq('below the 60 row', scoreEvent('mdl', 149, FIX), 0);
eq('exactly the 60 row', scoreEvent('mdl', 150, FIX), 60);
eq('between rows → lower row, no interpolation', scoreEvent('mdl', 249, FIX), 60);
eq('top row', scoreEvent('mdl', 400, FIX), 100);
eq('time: faster scores more', [scoreEvent('tmr', 1201, FIX), scoreEvent('tmr', 1200, FIX), scoreEvent('tmr', 799, FIX)], [0, 60, 100]);
eq('no table → null, never a guess', scoreEvent('hrp', 40, FIX), null);
eq('rejects non-monotonic table', validateRows('mdl', [[60, 200], [80, 150]]), null);
eq('rejects bad points', validateRows('mdl', [[101, 300]]), null);
eq('accepts a clean table', validateRows('tmr', [[100, 800], [60, 1200]]), [[60, 1200], [100, 800]]);
const t = scoreTest({ mdl: { raw: 250 }, hrp: { raw: 40 } }, FIX);
eq('partial test: no total', [t.total, t.complete, t.pass], [null, false, null]);
eq('substitute never scored', scoreTest({ mdl: { raw: 300, sub: true } }, FIX).events[0].points, null);
eq('age band 29', bandForAge(29), '27-31');
eq('age band 62', bandForAge(70), '62+');
eq('combat tables are sex-neutral', tableKey('combat', 'male', '27-31'), 'combat:any:27-31');

// ── Weekly review ──
const w = E.newProgram({ start: '2026-11-30' });
w.log = [{ date: '2026-11-30', block: 'lift' }, { date: '2026-12-01', block: 'run' }, { date: '2026-12-03', block: 'lift' }];
const rv = E.weekReview(w, 1, '2026-12-06', { cardio: [{ type: 'run', date: '2026-12-01T07:00:00', distanceMiles: 3, durationMinutes: 30 }],
  activity: [{ type: 'Soccer', date: '2026-12-05', durationMin: 60, intensity: 'High' }], sleep: [{ date: '2026-12-02', durationHours: 6 }] });
eq('review: done / partial / missed', [rv.completed, rv.partial, rv.missed.length], [2, 1, 3]);
eq('review: run miles + pace', [rv.runMiles, E.fmtTime(rv.runPace)], [3, '10:00']);
truthy('review: sleep recommendation', rv.recs.some((x) => /Sleep averaged 6\.0/.test(x.text)));
truthy('review: soccer counted', rv.recs.some((x) => /soccer/.test(x.text)));
truthy('review: missed session advice', rv.recs.some((x) => /Missed/.test(x.text)));

// ── Sanitiser keeps the person's own settings, drops junk ──
const sz = E.sanitizeP500({ startDate: '2026-11-30', targets: { mdl: 350, hrp: '<b>', tmr: -1 }, prefs: { cftGoal: 1490 }, standard: { std: 'general', sex: 'x', band: '99-100' } });
eq('sanitise targets', sz.targets, { mdl: 350 });
eq('sanitise CFT goal', sz.prefs.cftGoal, 1490);
eq('sanitise category', [sz.standard.sex, sz.standard.band], [null, null]);

// ── Calendar export ──
const ics = E.toICS(p, '2026-11-30', { weeks: 1 });
eq('ics: 6 sessions in week 1 (no rest day)', (ics.match(/BEGIN:VEVENT/g) || []).length, 6);
truthy('ics: morning start', ics.includes('DTSTART:20261130T063000'));
truthy('ics: reminder', ics.includes('TRIGGER:-PT15M'));

console.log(failed ? `\n${failed} of ${n} FAILED` : `all ${n} passed`);
process.exit(failed ? 1 : 0);
