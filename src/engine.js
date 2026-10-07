export const RIDES = [
  { id: 'danse', name: 'Danse Macabre', subtitle: 'Six chambers. One haunting dispatch.', type: 'Dark ride', interval: 300, units: Array.from({length:6},(_,i)=>({id:`chamber${i+1}`,name:`Chamber ${i+1}`,rows:[6,6,6],queue:'regular'})), queues:[['regular','Main queue'],['single','Single riders']] },
  { id: 'hollander', name: 'De Vliegende Hollander', subtitle: 'Two stations. Alternating departures.', type: 'Water coaster', interval:120, units:['A','B'].map(x=>({id:x,name:`Station ${x}`,rows:[3,4,3,4],queue:'regular'})), queues:[['regular','Main queue'],['single','Single riders']] },
  { id: 'symbolica', name: 'Symbolica', subtitle: 'Three tours. A little magic in every row.', type:'Trackless dark ride', interval:45, units:[['music','Muziektour'],['hero','Heldentour'],['treasure','Schattentour']].map(([id,name])=>({id,name,rows:[3,3],queue:id})), queues:[['music','Muziektour'],['hero','Heldentour'],['treasure','Schattentour'],['single','Single riders']] },
  { id:'joris',name:'Joris en de Draak',subtitle:'Water versus fire. Dispatch together.',type:'Dueling coaster',interval:120,units:['Water','Fire'].map(x=>({id:x.toLowerCase(),name:x,rows:Array(12).fill(2),queue:x.toLowerCase()})),queues:[['water','Water queue'],['fire','Fire queue'],['single','Single riders']] },
  { id:'taron',name:'Taron',subtitle:'Keep the trains full. Keep the queues moving.',type:'Launch coaster',interval:60,units:[{id:'train',name:'Train · 4 cars',rows:Array(8).fill(2),queue:'regular'}],queues:[['regular','Main queue'],['fast','Fastpass'],['single','Single riders']] }
];
let serial = Date.now();
export function makeGroup(queue, cycle=0) { return {id:++serial,size:queue==='single'?1:1+Math.floor(Math.random()*6),queue,arrival:cycle}; }
export function makeState(ride) {
 const queues=Object.fromEntries(ride.queues.map(([q])=>[q,Array.from({length:q==='fast'?2:8},()=>makeGroup(q))]));
 const state={queues,seats:Object.fromEntries(ride.units.map(u=>[u.id,u.rows.map(n=>Array(n).fill(null))])),remaining:Object.fromEntries(ride.units.map((u,i)=>[u.id,ride.id==='hollander'?(i+1)*60:ride.interval])),cycles:0,history:[],assignments:[],notice:'',reserved:0};
 if(ride.id==='hollander') reserveAccess(state,2);
 return state;
}
function reserveAccess(state,count) { state.reserved=count; for(let i=0;i<count;i++)state.seats.A[2][i]={id:'access',queue:'access'}; }
export function canUse(ride,group,unitId) {
 const u=ride.units.find(u=>u.id===unitId);
 return !!u && (group.queue==='single'||group.queue===u.queue||(ride.id==='taron'&&group.queue==='fast'));
}
export function assign(ride,state,group,positions) {
 if(!group||positions.length!==group.size)return {error:'Choose exactly one seat for every guest in this group.'};
 const unitId=positions[0]?.unit;
 if(positions.some(p=>p.unit!==unitId)||!canUse(ride,group,unitId))return {error:'Keep this group in one eligible vehicle.'};
 if(new Set(positions.map(p=>`${p.unit}:${p.row}:${p.seat}`)).size!==positions.length||positions.some(p=>state.seats[p.unit]?.[p.row]?.[p.seat]!==null))return {error:'Choose available seats only.'};
 const queue=state.queues[group.queue]; const index=queue.findIndex(g=>g.id===group.id);
 if(index<0||index>2)return {error:'You can ask the first three groups in a queue.'};
 const next=structuredClone(state);next.queues[group.queue].splice(index,1);
 positions.forEach(p=>next.seats[p.unit][p.row][p.seat]={id:group.id,queue:group.queue});
 next.assignments.push({group,positions,index});
 if(group.queue!=='fast')while(next.queues[group.queue].length<8)next.queues[group.queue].push(makeGroup(group.queue,next.cycles));
 next.notice=`Group of ${group.size} sent to ${ride.units.find(u=>u.id===unitId).name}.`;
 return {state:next};
}
export function undo(state) {
 const next=structuredClone(state);const a=next.assignments.pop();if(!a)return state;
 a.positions.forEach(p=>next.seats[p.unit][p.row][p.seat]=null);
 next.queues[a.group.queue].splice(a.index,0,a.group);next.notice='Last assignment returned to the queue.';return next;
}
export function dispatch(ride,state,unitIds=ride.units.map(u=>u.id),manual=false) {
 const next=structuredClone(state);let occupied=0,capacity=0;
 for(const id of unitIds) {const rows=next.seats[id];occupied+=rows.flat().filter(Boolean).length;capacity+=rows.flat().length;next.seats[id]=rows.map(r=>r.map(()=>null));next.remaining[id]=ride.interval;}
 if(manual&&ride.id==='hollander'&&unitIds.length===1)next.remaining[unitIds[0]==='A'?'B':'A']=60;
 next.cycles++;
 const overdue=(next.queues.fast||[]).filter(g=>next.cycles-g.arrival>3).reduce((n,g)=>n+g.size,0);
 next.history.push({occupied,capacity,penalty:Math.min(25,overdue*2),units:unitIds,cycle:next.cycles});
 next.assignments=next.assignments.filter(a=>!unitIds.includes(a.positions[0].unit));
 if(ride.id==='hollander'&&unitIds.includes('A'))reserveAccess(next,Math.random()<0.45?1+Math.floor(Math.random()*3):0);
 if(ride.id==='taron'&&Math.random()<0.75){const arrivals=1+Math.floor(Math.random()*5);for(let i=0;i<arrivals;i++)next.queues.fast.push(makeGroup('fast',next.cycles));}
 next.notice=`Dispatched ${occupied}/${capacity} guests.${overdue?` Fastpass waiting penalty: −${Math.min(25,overdue*2)} points.`:''}`;
 return next;
}
export function tick(ride,state,seconds) {
 let next=structuredClone(state);Object.keys(next.remaining).forEach(id=>next.remaining[id]-=seconds);
 if(ride.id==='hollander') {for(const u of ride.units)if(next.remaining[u.id]<=0)next=dispatch(ride,next,[u.id]);}
 else if(next.remaining[ride.units[0].id]<=0)next=dispatch(ride,next);
 return next;
}
export function stats(state) {
 const totals=state.history.reduce((a,h)=>({occupied:a.occupied+h.occupied,capacity:a.capacity+h.capacity,penalty:a.penalty+h.penalty}),{occupied:0,capacity:0,penalty:0});
 const efficiency=totals.capacity?Math.round(100*totals.occupied/totals.capacity):null;
 return {efficiency,guests:totals.occupied,dispatches:state.history.length,score:efficiency===null?null:Math.max(0,Math.round(efficiency-totals.penalty/state.history.length))};
}
