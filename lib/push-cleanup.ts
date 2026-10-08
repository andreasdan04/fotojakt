import {db} from './server';
export async function removePushDevices(user:string,endpoint?:string){const d=db(),where=endpoint?'user=? AND endpoint=?':'user=?',args=endpoint?[user,endpoint]:[user];await d.batch([
...['push_deliveries','social_push','chat_push','invitation_push'].map(t=>d.prepare(`DELETE FROM ${t} WHERE subscription IN(SELECT id FROM push_subscriptions WHERE ${where})`).bind(...args)),
d.prepare(`DELETE FROM settings WHERE key IN(SELECT 'push_test:'||id FROM push_subscriptions WHERE ${where})`).bind(...args),d.prepare(`DELETE FROM push_subscriptions WHERE ${where}`).bind(...args)]);}
