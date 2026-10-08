export type StaffRole='owner'|'administrator'|'head_judge'|'judge'|'player';
export const ROLE_NAMES:Record<StaffRole,string>={owner:'Eier',administrator:'Administrator',head_judge:'Hoveddommer',judge:'Dommer',player:'Spiller'};

export const isStaffRole=(role:unknown)=>typeof role==='string'&&['owner','administrator','head_judge','judge'].includes(role);
