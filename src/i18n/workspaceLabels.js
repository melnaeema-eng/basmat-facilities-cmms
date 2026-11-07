// Display terminology only; legacy database columns and RPC parameters stay intact.
const ownerKeys=['client','documentClient','sfClient','dcClient','ownerClient','reportClient','contractRenewalClient','approvalClient','esClient']
export const workspaceLabels={en:{},ar:{}}
for(const key of ownerKeys){workspaceLabels.en[key]='Owner';workspaceLabels.ar[key]='المالك'}
Object.assign(workspaceLabels.en,{clients:'Owners',activeClients:'Owners',ownerClients:'Owners',clientAdmin:'Owner administrator',clientUser:'Owner user',ownerPortalTitle:'Owner portal',approvalOwner:'Owner',approvalRoleOwner:'Owner',ownerStock:'Owner-owned',scope:'Company / owner / site'})
Object.assign(workspaceLabels.ar,{clients:'الملاك',activeClients:'الملاك',ownerClients:'الملاك',clientAdmin:'مسؤول المالك',clientUser:'مستخدم المالك',ownerPortalTitle:'بوابة المالك',approvalOwner:'المالك',approvalRoleOwner:'المالك',ownerStock:'ملك المالك',scope:'الشركة / المالك / الموقع'})
