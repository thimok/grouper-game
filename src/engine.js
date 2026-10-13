export const RIDES = [
  { id: 'danse', name: 'Danse Macabre', subtitle: 'Six chambers. One haunting dispatch.', type: 'Dark ride', interval: 300, units: Array.from({length:6},(_,i)=>({id:`chamber${i+1}`,name:`Chamber ${i+1}`,rows:[6,6,6],queue:'regular'})), queues:[['regular','Main queue'],['single','Single riders']] },
  { id: 'hollander', name: 'De Vliegende Hollander', subtitle: 'Two stations. Alternating departures.', type: 'Water coaster', interval:120, units:['A','B'].map(x=>({id:x,name:`Station ${x}`,rows:[3,4,3,4],queue:'regular'})), queues:[['regular','Main queue'],['single','Single riders']] },
  { id: 'symbolica', name: 'Symbolica', subtitle: 'Three tours. A little magic in every row.', type:'Trackless dark ride', interval:45, units:[['music','Muziektour'],['hero','Heldentour'],['treasure','Schattentour']].map(([id,name])=>({id,name,rows:[3,3],queue:id})), queues:[['music','Muziektour'],['hero','Heldentour'],['treasure','Schattentour'],['single','Single riders']] },
  { id:'joris',name:'Joris en de Draak',subtitle:'Water versus fire. Dispatch together.',type:'Dueling coaster',interval:120,units:['Water','Fire'].map(x=>({id:x.toLowerCase(),name:x,rows:Array(12).fill(2),queue:x.toLowerCase()})),queues:[['water','Water queue'],['fire','Fire queue'],['single','Single riders']] },
  { id:'taron',name:'Taron',subtitle:'Keep the trains full. Keep the queues moving.',type:'Launch coaster',interval:60,units:[{id:'train',name:'Train · 4 cars',rows:Array(8).fill(2),queue:'regular'}],queues:[['regular','Main queue'],['fast','Fastpass'],['single','Single riders']] },
  { id:'hagrid',name:"Hagrid’s Motorbike Adventure",subtitle:'Seven moving cars. Keep pace with the platform.',type:'Moving station',interval:87,units:[{id:'train',name:'Train · 7 cars',rows:Array(7).fill(2),queue:'regular'}],queues:[['regular','Main queue'],['fast','Fastpass'],['single','Single riders']] },
  { id:'rise',name:'Rise of the Resistance',subtitle:'Four stations. One departure queue.',type:'Trackless dark ride',interval:25,units:['A','B','C','D'].flatMap(station=>[1,2].map(n=>({id:`${station}${n}`,station,name:`Station ${station} · Vehicle ${n}`,rows:[4,4],colors:n===1?['Red','Blue']:['Silver','Orange'],queue:'regular'}))),queues:[['regular','Main queue'],['single','Single riders']] }
];
let serial = Date.now();
// 75% pairs or fours; 18% trios; 4% solo guests; 3% larger groups.
function groupSize() {
 const roll = Math.random();
 if (roll < 0.45) return 2;
 if (roll < 0.75) return 4;
 if (roll < 0.93) return 3;
 if (roll < 0.97) return 1;
 if (roll < 0.99) return 5;
 return 6;
}
export function makeGroup(queue, cycle=0) { return {id:++serial,size:queue==='single'?1:groupSize(),queue,arrival:cycle}; }
export function makeState(ride) {
 const queues=Object.fromEntries(ride.queues.map(([q])=>[q,Array.from({length:q==='fast'?2:8},()=>makeGroup(q))]));
 const state={queues,seats:Object.fromEntries(ride.units.map(u=>[u.id,u.rows.map(n=>Array(n).fill(null))])),remaining:Object.fromEntries(ride.units.map((u,i)=>[u.id,ride.id==='hollander'?(i+1)*60:ride.interval])),cycles:0,history:[],assignments:[],notice:'',reserved:0};
 if(ride.id==='hollander') reserveAccess(state,2);
 if(ride.id==='hagrid')state.hagrid={phase:'idle',elapsed:0,remaining:0,pending:[],stops:0,config:{interval:6,overlap:15,window:51,gap:8}};
 if(ride.id==='rise')state.rise={ready:[],replacement:{A:0,B:0,C:0,D:0},nextSlot:25,missed:0};
 return state;
}
export function restoreSessions(saved) {
 const restored=Object.fromEntries(RIDES.map(r=>[r.id,saved?.[r.id]?.seats&&r.units.every(u=>saved[r.id].seats[u.id])?saved[r.id]:makeState(r)]));
 if(!Number.isFinite(restored.hagrid.hagrid.config.overlap)){
  // Upgrade short legacy windows without resetting guests, queues, scores, or platform progress.
  restored.hagrid=structuredClone(restored.hagrid);
  const config=restored.hagrid.hagrid.config;
  config.overlap=Math.max(5,Math.min(60,config.window>6*config.interval?config.window-6*config.interval:15));
  config.window=6*config.interval+config.overlap;
 }
 // Incomplete selections are transient UI state; committed reservations are retained.
 if(restored.hagrid.hagrid.pending.length)restored.hagrid=setHagridPending(restored.hagrid,[]);
 return restored;
}
function reserveAccess(state,count) { state.reserved=count; for(let i=0;i<count;i++)state.seats.A[2][i]={id:'access',queue:'access'}; }
export function canUse(ride,group,unitId) {
 const u=ride.units.find(u=>u.id===unitId);
 return !!u && (group.queue==='single'||group.queue===u.queue||(['taron','hagrid'].includes(ride.id)&&group.queue==='fast'));
}
export function canLoadRow(ride,state,unit,row,positions=[]) {
 const vehicle=ride.units.find(u=>u.id===unit);
 if(!vehicle||!Number.isInteger(row)||row<0||row>=vehicle.rows.length)return false;
 if(ride.id==='hagrid')return carStatus(state,row)==='loading';
 if(ride.id==='rise')return stationOpen(state,vehicle.station);
 if(ride.id==='danse')return state.seats[unit].slice(0,row).every((seats,r)=>seats.every((guest,seat)=>guest!==null||positions.some(p=>p.unit===unit&&p.row===r&&p.seat===seat)));
 return true;
}
export function selectionValid(ride,state,group,positions) {
 if(!group)return false;
 if(!state.queues[group.queue]?.slice(0,3).some(g=>g.id===group.id))return false;
 return positions.every(p=>{
  if(state.seats[p.unit]?.[p.row]?.[p.seat]!==null||!canUse(ride,group,p.unit))return false;
  if(ride.id==='rise'&&!stationOpen(state,ride.units.find(u=>u.id===p.unit)?.station))return false;
  if(!canLoadRow(ride,state,p.unit,p.row,positions))return false;
  return true;
 });
}
export function selectSeats(state,group,positions,clicked,fillRow=false) {
 const same=(a,b)=>a.unit===b.unit&&a.row===b.row&&a.seat===b.seat;
 if(!fillRow&&positions.some(p=>same(p,clicked)))return positions.filter(p=>!same(p,clicked));
 const row=state.seats[clicked.unit]?.[clicked.row];
 if(!group||row?.[clicked.seat]!==null||positions.some(p=>p.unit!==clicked.unit))return positions;
 const remaining=group.size-positions.length;if(remaining<=0)return positions;
 // Prefer the clicked seat, then seats to its right, wrapping to the start of the row.
 const available=Array.from({length:row.length},(_,i)=>({...clicked,seat:(clicked.seat+i)%row.length}))
  .filter(p=>row[p.seat]===null&&!positions.some(existing=>same(existing,p)));
 const count=fillRow?Math.min(remaining,available.length):1;
 return [...positions,...available.slice(0,count)];
}
export function assign(ride,state,group,positions) {
 if(!group||positions.length!==group.size)return {error:'Choose exactly one seat for every guest in this group.'};
 const unitId=positions[0]?.unit;
 if(ride.id==='rise'&&!stationOpen(state,ride.units.find(u=>u.id===unitId)?.station))return {error:'This station is ready for dispatch or waiting for replacement vehicles.'};
 if(ride.id==='hagrid'&&positions.some(p=>!canLoadRow(ride,state,p.unit,p.row)))return {error:'Cars can only be loaded while inside the loading window.'};
 if(ride.id==='danse'&&positions.some(p=>!canLoadRow(ride,state,p.unit,p.row,positions)))return {error:'Fill the earlier rows in this chamber before loading the next row.'};
 if(positions.some(p=>p.unit!==unitId)||!canUse(ride,group,unitId))return {error:'Keep this group in one eligible vehicle.'};
 if(new Set(positions.map(p=>`${p.unit}:${p.row}:${p.seat}`)).size!==positions.length||positions.some(p=>state.seats[p.unit]?.[p.row]?.[p.seat]!==null))return {error:'Choose available seats only.'};
 const queue=state.queues[group.queue]; const index=queue.findIndex(g=>g.id===group.id);
 if(index<0||index>2)return {error:'You can ask the first three groups in a queue.'};
 const next=structuredClone(state);next.queues[group.queue].splice(index,1);
 positions.forEach(p=>next.seats[p.unit][p.row][p.seat]={id:group.id,queue:group.queue,...(ride.id==='hagrid'?{boarded:carStatus(state,p.row)==='loading'}:{})});
 if(ride.id==='hagrid')next.hagrid.pending=[];
 next.assignments.push({group,positions,index});
 if(group.queue!=='fast')while(next.queues[group.queue].length<8)next.queues[group.queue].push(makeGroup(group.queue,next.cycles));
 next.notice=`Group of ${group.size} sent to ${ride.units.find(u=>u.id===unitId).name}.`;
 return {state:next};
}
export function canUndo(state){
 const a=state.assignments.at(-1);if(!a)return false;
 if(state.rise&&!stationOpen(state,a.positions[0].unit[0]))return false;
 if(state.hagrid&&(state.hagrid.phase!=='running'||a.positions.some(p=>carStatus(state,p.row)==='closed')))return false;
 return true;
}
export function undo(state) {
 if(!canUndo(state))return state;
 const next=structuredClone(state);const a=next.assignments.at(-1);if(!a)return state;
 if(state.rise){const station=a.positions[0].unit[0];if(!stationOpen(state,station))return state;}
 if(state.hagrid&&a.positions.some(p=>carStatus(state,p.row)==='closed'))return state;
 next.assignments.pop();
 a.positions.forEach(p=>next.seats[p.unit][p.row][p.seat]=null);
 next.queues[a.group.queue].splice(a.index,0,a.group);next.notice='Last assignment returned to the queue.';return next;
}
export function dispatchCooldown(state,now=Date.now()) {
 return Math.max(0,Math.ceil(((state.manualDispatchReadyAt||0)-now)/1000));
}
export function loadingCooldown(state,unitId,now=Date.now()) {
 return Math.max(0,Math.ceil(((state.loadingReadyAt?.[unitId]||0)-now)/1000));
}
export function dispatch(ride,state,unitIds=ride.units.map(u=>u.id),manual=false,cooldown=0,now=Date.now()) {
 if(manual&&dispatchCooldown(state,now)>0)return state;
 const next=structuredClone(state);let occupied=0,capacity=0;
 for(const id of unitIds) {const rows=next.seats[id];occupied+=rows.flat().filter(Boolean).length;capacity+=rows.flat().length;next.seats[id]=rows.map(r=>r.map(()=>null));next.remaining[id]=ride.interval;}
 if(manual){
  const readyAt=now+Math.max(0,Math.min(300,Number(cooldown)||0))*1000;
  next.manualDispatchReadyAt=readyAt;
  next.loadingReadyAt={...next.loadingReadyAt};
  for(const id of unitIds)next.loadingReadyAt[id]=readyAt;
 }
 if(manual&&ride.id==='hollander'&&unitIds.length===1)next.remaining[unitIds[0]==='A'?'B':'A']=60;
 next.cycles++;
 const overdue=(next.queues.fast||[]).filter(g=>next.cycles-g.arrival>3).reduce((n,g)=>n+g.size,0);
 next.history.push({occupied,capacity,penalty:Math.min(25,overdue*2),units:unitIds,cycle:next.cycles});
 next.assignments=next.assignments.filter(a=>!unitIds.includes(a.positions[0].unit));
 if(ride.id==='hollander'&&unitIds.includes('A'))reserveAccess(next,Math.random()<0.45?1+Math.floor(Math.random()*3):0);
 if(['taron','hagrid'].includes(ride.id)&&Math.random()<(ride.id==='hagrid'?0.83:0.8)){const arrivals=1+Math.floor(Math.random()*(ride.id==='hagrid'?5:6));for(let i=0;i<arrivals;i++)next.queues.fast.push(makeGroup('fast',next.cycles));}
 next.notice=`Dispatched ${occupied}/${capacity} guests.${overdue?` Fastpass waiting penalty: −${Math.min(25,overdue*2)} points.`:''}`;
 return next;
}
export function tick(ride,state,seconds) {
 if(ride.id==='hagrid'||ride.id==='rise')return tickSpecial(ride,state,seconds,'timed');
 let next=structuredClone(state);Object.keys(next.remaining).forEach(id=>next.remaining[id]-=seconds);
 if(ride.id==='hollander') {for(const u of ride.units)if(next.remaining[u.id]<=0)next=dispatch(ride,next,[u.id]);}
 else if(next.remaining[ride.units[0].id]<=0)next=dispatch(ride,next);
 return next;
}
export function stats(state) {
 const totals=state.history.reduce((a,h)=>({occupied:a.occupied+h.occupied,capacity:a.capacity+h.capacity,penalty:a.penalty+h.penalty}),{occupied:0,capacity:0,penalty:0});
 const efficiency=totals.capacity?Math.round(100*totals.occupied/totals.capacity):null;
 return {efficiency,guests:totals.occupied,dispatches:state.history.length,score:efficiency===null?(state.hagrid?.stops?0:null):Math.max(0,Math.round(efficiency-totals.penalty/state.history.length-(state.hagrid?.stops||0)*10))};
}

export const STATIONS=['A','B','C','D'];
export function stationOpen(state,station){return !!state.rise&&state.rise.replacement[station]===0&&!state.rise.ready.includes(station);}
export function markReady(state,station){
 if(!stationOpen(state,station))return state;
 if(![`${station}1`,`${station}2`].some(id=>state.seats[id].flat().some(Boolean)))return {...state,notice:'Load at least one guest before marking this station ready.'};
 const next=structuredClone(state);next.rise.ready.push(station);next.notice=`Station ${station} queued for departure in position ${next.rise.ready.length}.`;return next;
}
export function cancelReady(state,station){const next=structuredClone(state);next.rise.ready=next.rise.ready.filter(s=>s!==station);next.notice=`Station ${station} reopened for grouping.`;return next;}
export function dispatchRise(ride,state,manual=false,cooldown=0,now=Date.now()){
 if(!state.rise.ready.length||(manual&&dispatchCooldown(state,now)>0))return state;
 const station=state.rise.ready[0];
 const next=dispatch(ride,state,[`${station}1`,`${station}2`],manual,cooldown,now);
 next.rise.ready.shift();next.rise.replacement[station]=15;
 next.notice=`Station ${station} departed. Replacement vehicles arrive in 15 seconds.`;return next;
}
export function carStatus(state,row){
 const h=state.hagrid;if(h.phase!=='running')return 'unavailable';
 const entry=row*h.config.interval;
 return h.elapsed<entry?'approaching':h.elapsed>=entry+h.config.window?'closed':'loading';
}
export function hagridDeadline(state){return 6*state.hagrid.config.interval+state.hagrid.config.window;}
export function startHagrid(state){
 if(state.hagrid.phase!=='idle')return state;
 const next=structuredClone(state);next.hagrid.phase='running';next.hagrid.elapsed=0;next.notice='Train entering. Load only cars currently inside the loading window.';return next;
}
export function setHagridTiming(state,key,value){
 if(state.hagrid.phase!=='idle')return state;
 const bounds={interval:[2,20],overlap:[5,60],gap:[0,60]};if(!bounds[key])return state;
 const next=structuredClone(state);next.hagrid.config[key]=Math.max(bounds[key][0],Math.min(bounds[key][1],Number(value)||bounds[key][0]));
 next.hagrid.config.window=6*next.hagrid.config.interval+next.hagrid.config.overlap;
 return next;
}
export function setHagridPending(state,positions){const next=structuredClone(state);next.hagrid.pending=positions;return next;}
export function canDispatchHagrid(state){
 return state.hagrid.phase==='running'&&state.hagrid.elapsed>=6*state.hagrid.config.interval&&!state.hagrid.pending.length&&state.seats.train.flat().every(s=>!s||s.boarded);
}
export function dispatchHagrid(ride,state,cooldown=0){
 if(!canDispatchHagrid(state))return state;
 const next=dispatch(ride,state);next.hagrid.phase='gap';next.hagrid.remaining=Math.max(next.hagrid.config.gap,cooldown);next.hagrid.pending=[];next.notice=`Train dispatched. ${next.hagrid.remaining} seconds before the next train can enter.`;return next;
}
function stopHagrid(state,reason){state.hagrid.phase='stopped';state.hagrid.stops++;state.hagrid.pending=[];state.notice=`E-stop: ${reason} Recover the platform to resume. (−10 score points)`;}
export function recoverHagrid(state){
 if(state.hagrid.phase!=='stopped')return state;
 const next=structuredClone(state);next.hagrid.phase='recovering';next.hagrid.remaining=15;next.notice='Platform recovery in progress. Guests will return to their queues.';return next;
}
export function tickSpecial(ride,state,seconds,mode='manual'){
 let next=structuredClone(state),left=Math.max(0,seconds);
 // Small simulation steps preserve events when speed is increased or a tick spans several departures.
 while(left>0){const dt=Math.min(left,0.25);left-=dt;
  if(ride.id==='rise'){
   for(const station of STATIONS)next.rise.replacement[station]=Math.max(0,next.rise.replacement[station]-dt);
   if(mode==='timed'){
    next.rise.nextSlot-=dt;
    if(next.rise.nextSlot<=0){
     if(next.rise.ready.length)next=dispatchRise(ride,next);
     else{next.rise.missed++;next.notice='Departure slot missed: no station marked ready.';}
     next.rise.nextSlot+=25;
    }
   }
  }else if(ride.id==='hagrid'){
   const h=next.hagrid;
   if(h.phase==='idle'&&mode==='timed'){next=startHagrid(next);continue;}
   if(h.phase==='running'){
    h.elapsed+=dt;
    next.seats.train.forEach((row,i)=>{if(carStatus(next,i)==='loading')row.forEach(s=>{if(s)s.boarded=true;});});
    if(h.pending.some(p=>carStatus(next,p.row)==='closed'))stopHagrid(next,'A car left the loading window while its group assignment was unfinished.');
    else if(h.elapsed>=hagridDeadline(next))stopHagrid(next,'The train reached the exit without dispatch clearance.');
   }else if(h.phase==='gap'||h.phase==='recovering'){
    h.remaining=Math.max(0,h.remaining-dt);
    if(h.remaining===0){
     if(h.phase==='recovering'){
      for(const a of [...next.assignments].reverse())next.queues[a.group.queue].splice(a.index,0,a.group);
      next.assignments=[];next.seats.train=next.seats.train.map(r=>r.map(()=>null));
     }
     h.phase='idle';h.elapsed=0;h.pending=[];next.notice='Platform ready for the next train.';
     if(mode==='timed')next=startHagrid(next);
    }
   }
  }
 }
 return next;
}
