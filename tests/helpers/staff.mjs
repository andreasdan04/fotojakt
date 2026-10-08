export const signature=[Array.from({length:12},(_,i)=>({x:.1+i*.02,y:.5+Math.sin(i)*.1}))];
export async function seedStaffAcceptance(db,user,created=Date.now()){
 await db.prepare('INSERT INTO staff_acceptances(id,user,name,role,version,document,signature,created) VALUES(?,?,?,?,?,?,?,?)').bind('signed-'+user,user,'Synthetic '+user,'administrator','2026-10-08.2','Synthetic confidentiality test fixture',JSON.stringify(signature),created).run();
}
