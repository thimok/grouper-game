import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RIDES,makeState,assign,dispatch,tick,stats,dispatchCooldown,loadingCooldown} from './engine.js';
test('ride capacities match the loading plans',()=>assert.deepEqual(RIDES.map(r=>r.units.reduce((n,u)=>n+u.rows.reduce((a,b)=>a+b,0),0)),[108,28,18,48,16]));
test('groups cannot span chambers and may look only two groups ahead',()=>{const r=RIDES[0],s=makeState(r);s.queues.regular[0].size=2;assert.ok(assign(r,s,s.queues.regular[0],[{unit:'chamber1',row:0,seat:0},{unit:'chamber2',row:0,seat:0}]).error);const g=s.queues.regular[3];g.size=1;assert.ok(assign(r,s,g,[{unit:'chamber1',row:0,seat:0}]).error);});
test('odd group can share a row with a single rider',()=>{const r=RIDES[4],s=makeState(r),g=s.queues.regular[0];g.size=3;const a=assign(r,s,g,[{unit:'train',row:0,seat:0},{unit:'train',row:0,seat:1},{unit:'train',row:1,seat:0}]);assert.ok(a.state);const b=assign(r,a.state,a.state.queues.single[0],[{unit:'train',row:1,seat:1}]);assert.equal(b.state.seats.train.flat().filter(Boolean).length,4);assert.equal(s.seats.train.flat().filter(Boolean).length,0);});
test('tour restrictions apply to groups but not single riders',()=>{const r=RIDES[2],s=makeState(r);const g=s.queues.music[0];g.size=1;assert.ok(assign(r,s,g,[{unit:'hero',row:0,seat:0}]).error);assert.ok(assign(r,s,s.queues.single[0],[{unit:'hero',row:0,seat:0}]).state);});
test('Hollander reserved seats cannot be assigned and stations alternate',()=>{const r=RIDES[1],s=makeState(r);assert.ok(assign(r,s,s.queues.single[0],[{unit:'A',row:2,seat:0}]).error);let n=tick(r,s,60);assert.deepEqual(n.history[0].units,['A']);assert.equal(n.history[0].occupied,2);n=tick(r,n,60);assert.deepEqual(n.history[1].units,['B']);assert.equal(n.remaining.A,60);});
test('dueling trains dispatch together',()=>{const r=RIDES[3],s=tick(r,makeState(r),120);assert.equal(s.history.length,1);assert.equal(s.history[0].capacity,48);});
test('manual boat departure preserves the other boat and restores alternating timers',()=>{const r=RIDES[1],s=makeState(r);s.seats.B[0][0]={id:99,queue:'single'};const n=dispatch(r,s,['A'],true);assert.equal(n.seats.B[0][0].id,99);assert.deepEqual(n.remaining,{A:120,B:60});});
test('manual cooldown blocks departures until real deadline, including after reload',()=>{
 const r=RIDES[4],now=100000;
 const s=dispatch(r,makeState(r),undefined,true,10,now);
 const restored=JSON.parse(JSON.stringify(s));
 assert.equal(dispatchCooldown(restored,now+1500),9);
 assert.equal(dispatch(r,restored,undefined,true,0,now+9999),restored);
 const next=dispatch(r,restored,undefined,true,10,now+10000);
 assert.equal(next.cycles,2);
 assert.equal(loadingCooldown(next,'train',now+10000),10);
});
test('Hollander break keeps the other station loadable but blocks both departure buttons',()=>{
 const r=RIDES[1],now=100000,s=dispatch(r,makeState(r),['A'],true,10,now);
 assert.equal(loadingCooldown(s,'A',now),10);
 assert.equal(loadingCooldown(s,'B',now),0);
 assert.equal(dispatch(r,s,['B'],true,10,now),s);
});
test('zero cooldown and timed departures work without a manual break',()=>{
 const r=RIDES[4],now=100000,s=dispatch(r,makeState(r),undefined,true,0,now);
 assert.equal(dispatchCooldown(s,now),0);
 assert.equal(dispatch(r,s,undefined,true,0,now).cycles,2);
 const cooling=dispatch(r,s,undefined,true,300,now);
 assert.equal(tick(r,cooling,60).cycles,3);
 assert.equal(dispatchCooldown(makeState(r),now),0);
});
test('fastpass penalty begins after three departures and efficiency is weighted',()=>{const r=RIDES[4],s=makeState(r);s.queues.fast=[{id:1,size:2,queue:'fast',arrival:0}];s.cycles=2;let n=dispatch(r,s);assert.equal(n.history[0].penalty,0);n.queues.fast=[{id:1,size:2,queue:'fast',arrival:0}];n=dispatch(r,n);assert.equal(n.history[1].penalty,4);n.history=[{occupied:14,capacity:14,penalty:0},{occupied:0,capacity:14,penalty:4}];assert.equal(stats(n).efficiency,50);assert.equal(stats(n).score,48);});
