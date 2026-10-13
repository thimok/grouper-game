export function keyboardCommand(ride,event,primaryQueue) {
 if(event.repeat||event.ctrlKey||event.metaKey||event.altKey)return null;
 const primary=ride.queues.filter(([q])=>!['fast','single'].includes(q)).map(([q])=>q);
 const queue=primary.includes(primaryQueue)?primaryQueue:primary[0];
 const key=event.key.toLowerCase();
 if(key==='s'&&ride.queues.some(([q])=>q==='single'))return {queue:'single',index:0};
 if(key==='q'&&primary.length>1)return {primaryQueue:primary[(primary.indexOf(queue)+1)%primary.length]};
 const digit=/^(?:Digit|Numpad)([123])$/.exec(event.code);
 if(digit){const target=event.shiftKey?'fast':queue;if(ride.queues.some(([q])=>q===target))return {queue:target,index:Number(digit[1])-1};}
 return null;
}
