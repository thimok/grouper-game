import React from 'react';
import {STATIONS,stationOpen,markReady,cancelReady,dispatchRise,carStatus,hagridDeadline,startHagrid,setHagridTiming,canDispatchHagrid,dispatchHagrid,recoverHagrid,dispatchCooldown} from './engine.js';

const clock=n=>{const seconds=Math.ceil(Math.max(0,n));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};

function Seat({unit,row,seat,state,plan,seatClick,disabled=false}){
 const guest=state.seats[unit][row][seat],pending=plan.some(p=>p.unit===unit&&p.row===row&&p.seat===seat);
 const label=state.hagrid?`Car ${row+1}`:`${unit} ${row===0?'front':'back'} row`;
 return <button aria-label={`${label}, seat ${seat+1}, ${guest?'occupied':'available'}`} disabled={!!guest||disabled} onClick={e=>{if(e.detail<2)seatClick(unit,row,seat,e.shiftKey);}} onDoubleClick={()=>seatClick(unit,row,seat,true)} className={`seat ${guest?'occupied':''} ${guest?.queue==='single'?'single-seat':''} ${guest?.queue==='fast'?'fast-seat':''} ${guest&&state.hagrid&&!guest.boarded?'reserved-seat':''} ${pending?'pending':''}`}>{pending?'✓':guest?(state.hagrid&&!guest.boarded?'◇':'•'):seat+1}</button>;
}

export function HagridStation({ride,state,mode,speed,cooldown,update,plan,seatClick,clearSelection}){
 const h=state.hagrid,deadline=hagridDeadline(state),remaining=Math.max(0,deadline-h.elapsed);
 const action=fn=>{clearSelection();update(fn);};
 return <div className="special-loading">
  <div className={`mechanic-banner ${h.phase==='stopped'?'danger-banner':''}`}>
   <div><strong>{h.phase==='running'?'Moving platform · train in motion':h.phase==='stopped'?'EMERGENCY STOP':h.phase==='recovering'?'Recovering the platform':h.phase==='gap'?'Between trains':'Platform ready'}</strong><p>{h.phase==='running'?`${clock(remaining)} to dispatch deadline · car every ${h.config.interval}s · ${mode==='timed'?speed:1}× speed`:h.phase==='gap'||h.phase==='recovering'?`${clock(h.remaining)} remaining`:h.phase==='stopped'?'Recover the platform before admitting another train.':'Start a train, then keep pace as its seven cars enter.'}</p></div>
   <span className="mechanic-number">{h.phase==='running'?clock(remaining):`${h.stops} e-stops`}</span>
   {h.phase==='running'&&<div className="progress"><div style={{width:`${Math.min(100,h.elapsed/deadline*100)}%`}}/></div>}
  </div>
  <div className="moving-help">Load only cars marked Loading now. After car 7 arrives, all seven cars stay loadable for {h.config.overlap} seconds. Then cars close from front to back, {h.config.interval} seconds apart. Finish a partial group before its earliest car leaves. Empty seats are allowed.</div>
  <div className="platform-direction">STATION ENTRANCE <span>→ MOVING PLATFORM →</span> DISPATCH EXIT</div>
  <div className="moving-cars">{state.seats.train.map((row,i)=>{
   const status=carStatus(state,i),entry=i*h.config.interval;
   const text=status==='loading'?`${clock(entry+h.config.window-h.elapsed)} left`:status==='approaching'?`In ${clock(entry-h.elapsed)}`:status==='closed'?'Past loading':h.phase==='idle'?'Awaiting train':'Unavailable';
   return <article className={`moving-car ${status}`} key={i}><div className="car-heading">CAR {String(i+1).padStart(2,'0')}</div><div className="car-status">{status==='loading'?'Loading now':status==='approaching'?'Approaching':status==='closed'?'Window closed':'Standby'}</div><div className="seats">{row.map((_,seat)=><Seat key={seat} unit="train" row={i} seat={seat} state={state} plan={plan} seatClick={seatClick} disabled={status!=='loading'}/>)}</div><small>{text}</small>{status==='loading'&&<div className="car-window"><div style={{width:`${Math.max(0,(entry+h.config.window-h.elapsed)/h.config.window*100)}%`}}/></div>}</article>;
  })}</div>
  <div className="mechanic-actions">
   {h.phase==='idle'&&<button className="dispatch-button" onClick={()=>action(startHagrid)}>Start next train →</button>}
   {h.phase==='running'&&<button className="dispatch-button" disabled={!canDispatchHagrid(state)} onClick={()=>action(s=>dispatchHagrid(ride,s,mode==='manual'?cooldown:0))}>Dispatch train ↗</button>}
   {h.phase==='stopped'&&<button className="dispatch-button recover-button" onClick={()=>action(recoverHagrid)}>Recover platform · 15s ↻</button>}
   <span>{mode==='timed'?'Timed arrivals · you always give final dispatch clearance.':'Manual arrivals · the platform clock runs once a train enters.'}</span>
  </div>
  {h.phase==='running'&&!canDispatchHagrid(state)&&<p className="mechanic-footnote">Dispatch opens after car 7 arrives and all assigned guests are boarded. Complete or cancel any unfinished selection first.</p>}
  <details className="timing-settings"><summary>Moving-station timings <span>Game settings</span></summary><div>{[['interval','Car interval',2,20],['overlap','All-car overlap',5,60],['gap','Train gap',0,60]].map(([key,label,min,max])=><label key={key}>{label}<span><input aria-label={`Hagrid ${label.toLowerCase()} in seconds`} type="number" min={min} max={max} disabled={h.phase!=='idle'} value={h.config[key]} onChange={e=>update(s=>setHagridTiming(s,key,e.target.value))}/> sec</span></label>)}</div><p>Each car has {h.config.window} seconds to load. Final dispatch deadline: {clock(deadline)} after entry. Adjust before starting a train. Recovery takes 15 seconds; each e-stop subtracts 10 score points. Manual minimum break extends the train gap when longer.</p></details>
 </div>;
}

export function RiseStations({ride,state,mode,speed,cooldown,now,update,plan,seatClick,selected,clearSelection}){
 const r=state.rise,wait=mode==='manual'?dispatchCooldown(state,now):0;
 const ready=station=>update(s=>markReady(s,station));
 return <div className="special-loading">
  <div className="mechanic-banner"><div><strong>{mode==='timed'?'Next departure slot':'Manual departure control'}</strong><p>{mode==='timed'?`${clock(r.nextSlot)} until the next slot · ${speed}× speed · ${r.missed} missed slots`:wait?`${clock(wait)} minimum break remaining`:'Mark a station ready, then dispatch the first station in the queue.'}</p></div><span className="mechanic-number">{mode==='timed'?clock(r.nextSlot):wait?clock(wait):'↗'}</span>{mode==='timed'&&<div className="progress"><div style={{width:`${100*(1-r.nextSlot/25)}%`}}/></div>}</div>
  <div className="departure-queue"><span>DEPARTURE QUEUE</span><div>{r.ready.length?r.ready.map((station,i)=><span className="departure-chip" key={station}>{i+1} · Station {station}{i===0?' ↗':''}</span>):<span className="empty-departures">No stations ready yet</span>}</div>{mode==='manual'&&<button className="dispatch-button" disabled={!r.ready.length||wait>0} onClick={()=>update(s=>dispatchRise(ride,s,true,cooldown))}>Dispatch next{r.ready[0]?` · ${r.ready[0]}`:''} ↗</button>}</div>
  <div className="rise-stations">{STATIONS.map(station=>{
   const open=stationOpen(state,station),index=r.ready.indexOf(station),replacement=r.replacement[station];
   const units=ride.units.filter(u=>u.station===station),occupied=units.reduce((n,u)=>n+state.seats[u.id].flat().filter(Boolean).length,0);
   return <article className={`rise-station ${!open?'station-locked':''}`} key={station}>
    <div className="station-heading"><h3>Station {station}</h3><span>{occupied} / 16</span></div>
    <div className="station-state">{replacement>0?`New vehicles in ${clock(replacement)}`:index>=0?`Ready · departure position ${index+1}`:'Open for grouping'}</div>
    {units.map(u=><div className={`rise-vehicle ${selected&&!['regular','single'].includes(selected.queue)?'ineligible':''}`} key={u.id}><div className="rise-vehicle-label">Vehicle {u.id[1]} · keep groups in this vehicle</div>{u.rows.map((n,row)=><div className="seat-row color-row" key={row}><span className={`color-label ${u.colors[row].toLowerCase()}`}>{u.colors[row]}</span><div className="seats">{Array.from({length:n},(_,seat)=><Seat key={seat} unit={u.id} row={row} seat={seat} state={state} plan={plan} seatClick={seatClick} disabled={!open}/>)}</div></div>)}</div>)}
    {index>=0?<button className="station-dispatch" onClick={()=>update(s=>cancelReady(s,station))}>Cancel ready · reopen station ↶</button>:<button className="station-dispatch" disabled={!open||occupied===0} onClick={()=>ready(station)}>Mark ready →</button>}
   </article>;
  })}</div>
  <p className="mechanic-footnote">Two vehicles per station, eight guests per vehicle. Marking ready locks assignments. Departures follow readiness order; replacement takes 15 seconds in both modes.</p>
 </div>;
}
