import handler from 'vinext/server/fetch-handler';
import {runRetention} from './lib/retention';
export default {...handler,scheduled(_event:ScheduledController,_env:unknown,ctx:ExecutionContext){ctx.waitUntil(runRetention().catch(()=>{console.error('Privacy retention failed; next hourly run will retry')}));}};
