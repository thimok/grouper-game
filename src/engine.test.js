import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RIDES,makeState,assign,undo,dispatch,tick,stats,dispatchCooldown,loadingCooldown,restoreSessions,markReady,cancelReady,dispatchRise,tickSpecial,stationOpen,startHagrid,carStatus,setHagridPending,canDispatchHagrid,dispatchHagrid,recoverHagrid,setHagridTiming} from './engine.js';
test('ride capacities match the loading plans',()=>assert.deepEqual(RIDES.map(r=>r.units.reduce((n,u)=>n+u.rows.reduce((a,b)=>a+b,0),0)),[108,28,18,48,16,14,64]));
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

const rise=RIDES.find(r=>r.id==='rise'),hagrid=RIDES.find(r=>r.id==='hagrid');
function populatedRise(){const s=makeState(rise);for(const station of ['A','B','C','D'])s.seats[`${station}1`][0][0]={id:station,queue:'regular'};return s;}
test('adding attractions preserves existing saved shifts',()=>{
 const saved={danse:makeState(RIDES[0])};saved.danse.cycles=9;
 const restored=restoreSessions(saved);assert.equal(restored.danse,saved.danse);assert.equal(restored.danse.cycles,9);assert.ok(restored.hagrid.hagrid);assert.ok(restored.rise.rise);
});
test('restoring Hagrid clears transient selections without losing committed reservations',()=>{
 let s=startHagrid(makeState(hagrid));s=assign(hagrid,s,s.queues.single[0],[{unit:'train',row:6,seat:0}]).state;
 s=setHagridPending(s,[{unit:'train',row:0,seat:0}]);const restored=restoreSessions({hagrid:s}).hagrid;
 assert.deepEqual(restored.hagrid.pending,[]);assert.equal(restored.seats.train[6][0].id,s.seats.train[6][0].id);assert.equal(s.hagrid.pending.length,1);
});
test('Rise readiness order allows A C B D and prevents duplicates',()=>{
 let s=populatedRise();for(const id of ['A','C','B','D','A'])s=markReady(s,id);
 assert.deepEqual(s.rise.ready,['A','C','B','D']);
 const a=dispatchRise(rise,s,true,0,1000),c=dispatchRise(rise,a,true,0,1000);
 assert.deepEqual(a.history[0].units,['A1','A2']);assert.equal(a.history[0].capacity,16);
 assert.deepEqual(c.history[1].units,['C1','C2']);assert.deepEqual(c.rise.ready,['B','D']);
});
test('Rise locks ready stations and keeps groups in a single vehicle',()=>{
 const s=populatedRise(),g=s.queues.regular[0];g.size=2;
 assert.ok(assign(rise,s,g,[{unit:'A1',row:0,seat:1},{unit:'A2',row:0,seat:0}]).error);
 const ready=markReady(s,'A');g.size=1;
 assert.ok(assign(rise,ready,g,[{unit:'A1',row:0,seat:1}]).error);
 assert.ok(assign(rise,cancelReady(ready,'A'),g,[{unit:'A1',row:0,seat:1}]).state);
});
test('Rise manual mode requires dispatch and replaces vehicles after exactly 15 seconds',()=>{
 const ready=markReady(populatedRise(),'A');const waiting=tickSpecial(rise,ready,30,'manual');assert.equal(waiting.cycles,0);
 const departed=dispatchRise(rise,waiting,true,10,1000);assert.equal(departed.rise.replacement.A,15);assert.equal(stationOpen(departed,'A'),false);assert.equal(stationOpen(departed,'B'),true);
 const partial=tickSpecial(rise,departed,14.75,'manual');assert.equal(stationOpen(partial,'A'),false);
 assert.equal(stationOpen(tickSpecial(rise,partial,0.25,'manual'),'A'),true);
});
test('Rise timed slots dispatch one station every 25 seconds and skip empty slots',()=>{
 const empty=tickSpecial(rise,makeState(rise),25,'timed');assert.equal(empty.rise.missed,1);assert.equal(empty.cycles,0);
 let s=populatedRise();for(const id of ['A','C','B','D'])s=markReady(s,id);
 s=tickSpecial(rise,s,100,'timed');assert.deepEqual(s.history.map(h=>h.units[0]),['A1','C1','B1','D1']);assert.equal(s.rise.replacement.D,15);assert.equal(s.rise.replacement.B,0);assert.equal(s.rise.nextSlot,25);
});
test('Rise undo respects readiness locks',()=>{
 const s=makeState(rise),g=s.queues.single[0];const loaded=assign(rise,s,g,[{unit:'A1',row:0,seat:0}]).state;
 const ready=markReady(loaded,'A');assert.equal(undo(ready),ready);assert.equal(undo(cancelReady(ready,'A')).seats.A1[0][0],null);
});
test('Hagrid runs in manual mode and supports an odd group spanning cars',()=>{
 const s=startHagrid(makeState(hagrid)),g=s.queues.regular[0];g.size=3;
 const loaded=assign(hagrid,s,g,[{unit:'train',row:0,seat:0},{unit:'train',row:0,seat:1},{unit:'train',row:1,seat:0}]).state;
 assert.equal(loaded.seats.train[0][0].boarded,true);assert.equal(loaded.seats.train[1][0].boarded,false);
 const moved=tickSpecial(hagrid,loaded,6,'manual');assert.equal(moved.seats.train[1][0].boarded,true);assert.equal(carStatus(moved,1),'loading');
 assert.equal(canDispatchHagrid(moved),false);const lastCar=tickSpecial(hagrid,moved,30,'manual');assert.equal(canDispatchHagrid(lastCar),true);
 const departed=dispatchHagrid(hagrid,lastCar,10);assert.equal(departed.history[0].occupied,3);assert.equal(departed.history[0].capacity,14);assert.equal(departed.hagrid.remaining,10);
 assert.equal(tickSpecial(hagrid,departed,10,'manual').hagrid.phase,'idle');
});
test('Hagrid unfinished loading causes one e-stop and recovery returns assigned groups',()=>{
 let s=startHagrid(makeState(hagrid));const g=s.queues.single[0];s=assign(hagrid,s,g,[{unit:'train',row:0,seat:0}]).state;
 s=setHagridPending(s,[{unit:'train',row:1,seat:0}]);s=tickSpecial(hagrid,s,18,'manual');assert.equal(s.hagrid.phase,'stopped');assert.equal(s.hagrid.stops,1);assert.equal(s.history.length,0);
 s=tickSpecial(hagrid,s,100,'manual');assert.equal(s.hagrid.stops,1);
 s=tickSpecial(hagrid,recoverHagrid(s),15,'manual');assert.equal(s.hagrid.phase,'idle');assert.equal(s.seats.train.flat().filter(Boolean).length,0);assert.equal(s.queues.single.filter(x=>x.id===g.id).length,1);
});
test('Hagrid permits empty cars, rejects closed cars, and requires final dispatch clearance',()=>{
 const s=tickSpecial(hagrid,startHagrid(makeState(hagrid)),36,'manual');assert.equal(s.hagrid.phase,'running');assert.equal(canDispatchHagrid(s),true);
 assert.ok(assign(hagrid,s,s.queues.single[0],[{unit:'train',row:0,seat:0}]).error);
 const missed=tickSpecial(hagrid,s,12,'manual');assert.equal(missed.hagrid.phase,'stopped');assert.equal(stats(missed).score,0);
});
test('Hagrid timed arrivals start another train after its gap but never auto-clear dispatch',()=>{
 const s=tickSpecial(hagrid,startHagrid(makeState(hagrid)),36,'timed');const dispatched=dispatchHagrid(hagrid,s);
 const next=tickSpecial(hagrid,dispatched,8,'timed');assert.equal(next.hagrid.phase,'running');assert.equal(next.hagrid.elapsed,0);
 const stopped=tickSpecial(hagrid,next,48,'timed');assert.equal(stopped.hagrid.phase,'stopped');assert.equal(stopped.history.length,1);
});
test('Hagrid timings are configurable only before admitting a train',()=>{
 const s=setHagridTiming(makeState(hagrid),'interval',4);assert.equal(s.hagrid.config.interval,4);
 const running=startHagrid(s);assert.equal(setHagridTiming(running,'interval',10),running);
});
test('cancelling an unfinished Hagrid group leaves an empty car without an e-stop',()=>{
 let s=setHagridPending(startHagrid(makeState(hagrid)),[{unit:'train',row:0,seat:0}]);s=setHagridPending(s,[]);
 const moved=tickSpecial(hagrid,s,12,'manual');assert.equal(moved.hagrid.phase,'running');assert.equal(moved.hagrid.stops,0);
});
