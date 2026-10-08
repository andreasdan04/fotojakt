// Server epoch anchored to a monotonic browser clock. Changing a phone's date
// or timezone must never change the measured duration of an active attempt.
export type HuntClock={server:number;monotonic:number;timeOrigin:number;wall:number};
export function anchorClock(server:number):HuntClock{return {server,monotonic:performance.now(),timeOrigin:performance.timeOrigin,wall:Date.now()}}
export function clockNow(clock:HuntClock){
 const delta=clock.timeOrigin===performance.timeOrigin?performance.now()-clock.monotonic:Date.now()-clock.wall;
 if(!Number.isFinite(delta)||delta<0)throw Error('Enhetsklokken er endret. Koble til nettet for å klargjøre kameraet på nytt.');
 return clock.server+delta;
}
