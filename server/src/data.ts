export type Role='manager'|'team_lead'|'worker';
export type Status='completed'|'in_progress'|'blocked'|'escalated'|'watch'|'open';
export type User={id:string;name:string;role:Role;title:string;team_id?:string;team_lead_id?:string};
export type Team={id:string;name:string;lead_id:string;worker_ids:string[]};
export type Event={id:string;source:'jira'|'incident'|'chat'|'commit';record_id:string;timestamp:string;summary:string;status:Status;priority:'low'|'medium'|'high'|'critical';worker_id:string;team_id:string;team_lead_id:string;update_type:string};
export type HandoverItem = { source: string; record_id: string; timestamp: string; summary: string; priority: string; finalStatus: string; updates: string[]; isCarriedForward?: boolean; origin?: string };
export type Handover = { worker: User; team: Team; lead: User; shiftStart: string; shiftEnd: string; completed: HandoverItem[]; inProgress: HandoverItem[]; blockers: HandoverItem[]; watch: HandoverItem[]; priorities: HandoverItem[]; eventCount: number; duplicateUpdatesCollapsed: number; carriedForwardCount: number; warnings: string[] };

export const users:User[]=[
{id:'m1',name:'Rohan Mehta',role:'manager',title:'Operations Manager'},
{id:'tl1',name:'Arun Kumar',role:'team_lead',title:'Team Lead',team_id:'t1'},
{id:'tl2',name:'Meena Iyer',role:'team_lead',title:'Team Lead',team_id:'t2'},
{id:'tl3',name:'Priya Shah',role:'team_lead',title:'Team Lead',team_id:'t3'},
{id:'w1',name:'Karthik Rao',role:'worker',title:'Software Engineer',team_id:'t1',team_lead_id:'tl1'},
{id:'w2',name:'Divya Nair',role:'worker',title:'QA Engineer',team_id:'t1',team_lead_id:'tl1'},
{id:'w3',name:'Sanjay Menon',role:'worker',title:'Backend Engineer',team_id:'t1',team_lead_id:'tl1'},
{id:'w4',name:'Priya Krishnan',role:'worker',title:'Frontend Engineer',team_id:'t1',team_lead_id:'tl1'},
{id:'w5',name:'Ravi Kumar',role:'worker',title:'DevOps Engineer',team_id:'t2',team_lead_id:'tl2'},
{id:'w6',name:'Harish Babu',role:'worker',title:'QA Engineer',team_id:'t2',team_lead_id:'tl2'},
{id:'w7',name:'Nithya S',role:'worker',title:'Software Engineer',team_id:'t2',team_lead_id:'tl2'},
{id:'w8',name:'Ajay Raj',role:'worker',title:'Software Engineer',team_id:'t3',team_lead_id:'tl3'},
{id:'w9',name:'Deepa V',role:'worker',title:'Data Engineer',team_id:'t3',team_lead_id:'tl3'},
{id:'w10',name:'Vignesh K',role:'worker',title:'Support Engineer',team_id:'t3',team_lead_id:'tl3'}
];
export const teams:Team[]=[{id:'t1',name:'Team Alpha',lead_id:'tl1',worker_ids:['w1','w2','w3','w4']},{id:'t2',name:'Team Beta',lead_id:'tl2',worker_ids:['w5','w6','w7']},{id:'t3',name:'Team Gamma',lead_id:'tl3',worker_ids:['w8','w9','w10']}];
const ev=(id:string,source:any,record_id:string,timestamp:string,summary:string,status:Status,priority:any,worker_id:string,update_type:string):Event=>{const u=users.find(x=>x.id===worker_id)!;return{id,source,record_id,timestamp,summary,status,priority,worker_id,team_id:u.team_id!,team_lead_id:u.team_lead_id!,update_type}};
export const events:Event[]=[
// Karthik current shift: multiple updates + outside-window events + empty escalation/watch categories deliberately handled for other workers
 ev('e1','jira','OPS-100','2026-09-03T08:30:00+05:30','Ticket assigned','open','medium','w1','assigned'),
 ev('e2','jira','OPS-101','2026-09-03T10:15:00+05:30','Login bug fixed','completed','high','w1','fixed'),
 ev('e3','jira','OPS-104','2026-09-03T12:30:00+05:30','Database backup completed','completed','medium','w1','completed'),
 ev('e4','jira','OPS-108','2026-09-03T13:05:00+05:30','Payment API investigation started','open','high','w1','opened'),
 ev('e5','jira','OPS-108','2026-09-03T14:15:00+05:30','Payment API investigation continues','in_progress','high','w1','updated'),
 ev('e6','incident','INC-115','2026-09-03T15:20:00+05:30','Database connection issue','blocked','critical','w1','escalated'),
 ev('e7','jira','OPS-120','2026-09-03T16:10:00+05:30','Monitor payment service','watch','medium','w1','watch'),
 ev('e8','jira','OPS-130','2026-09-03T18:00:00+05:30','Post-shift deployment check','completed','low','w1','completed'),
 // Previous shift for Karthik
 ev('p1','jira','OPS-101','2026-09-02T14:15:00+05:30','Login issue reproduced','open','high','w1','opened'),
 ev('p2','jira','OPS-101','2026-09-02T18:10:00+05:30','Login bug fixed','completed','high','w1','closed'),
 ev('p3','jira','OPS-108','2026-09-02T18:20:00+05:30','Payment API investigation','in_progress','high','w1','updated'),
 ev('p4','incident','INC-115','2026-09-02T19:10:00+05:30','Database connection issue','blocked','critical','w1','escalated'),
 ev('p5','jira','OPS-120','2026-09-02T20:30:00+05:30','Monitor payment service','watch','medium','w1','watch'),
 ev('p6','jira','OPS-109','2026-09-02T20:45:00+05:30','Auth token refresh retry logic','in_progress','high','w1','updated'),
 // Divya: completed + quiet (no blocker/watch)
 ev('d1','jira','OPS-201','2026-09-03T09:30:00+05:30','Login regression test suite passed','completed','high','w2','closed'),
 ev('d2','jira','OPS-202','2026-09-03T11:10:00+05:30','Checkout validation completed','completed','medium','w2','closed'),
 ev('d3','jira','OPS-203','2026-09-03T14:25:00+05:30','Prepare release notes','completed','low','w2','closed'),
 // Sanjay: blocker + duplicate update
 ev('s1','jira','OPS-301','2026-09-03T10:00:00+05:30','Database migration started','open','high','w3','opened'),
 ev('s2','jira','OPS-301','2026-09-03T12:40:00+05:30','Database migration waiting on lock','in_progress','high','w3','updated'),
 ev('s3','incident','INC-302','2026-09-03T13:50:00+05:30','Production database connection pool exhausted','blocked','critical','w3','escalated'),
 // other teams
 ev('r1','jira','OPS-401','2026-09-03T09:40:00+05:30','CI pipeline optimized','completed','medium','w5','closed'),
 ev('r2','jira','OPS-402','2026-09-03T15:10:00+05:30','Kubernetes node alert investigation','in_progress','high','w5','updated'),
 ev('h1','jira','OPS-501','2026-09-03T10:20:00+05:30','Mobile smoke tests completed','completed','medium','w6','closed'),
 ev('n1','jira','OPS-601','2026-09-03T12:05:00+05:30','API refactor in progress','in_progress','medium','w7','updated'),
 ev('a1','jira','OPS-701','2026-09-03T11:30:00+05:30','Analytics query optimized','completed','high','w8','closed'),
 ev('a2','jira','OPS-702','2026-09-03T16:30:00+05:30','Data validation follow-up','watch','medium','w9','watch'),
 ev('v1','incident','INC-801','2026-09-03T14:45:00+05:30','Customer support escalation for checkout','escalated','high','w10','escalated')
];
