import {admin,one,all,wrap,json} from '@/lib/server';
export const dynamic='force-dynamic';
export const GET=wrap(async(req:Request)=>{await admin(req);return json({lastRun:(await one("SELECT value FROM settings WHERE key='privacy-cleanup-status'"))?.value||null,lastFileFailure:(await one("SELECT value FROM settings WHERE key='privacy-file-cleanup-failed'"))?.value||null,metadataRetries:(await one("SELECT COUNT(*) n FROM settings WHERE key LIKE 'metadata-retry:%'")).n,queuedFiles:(await one("SELECT COUNT(*) n FROM settings WHERE key LIKE 'deleted-photo:%'")).n});});
