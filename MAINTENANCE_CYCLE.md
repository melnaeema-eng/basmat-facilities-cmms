# Integrated maintenance cycle — implementation 044

## Product behavior

An asset in an owner’s site is maintained by the contracted service company.
The project links the owner, company, contract and authorized sites. The owner
appoints a representative and optionally a consultant for that project.

Corrective: asset fault -> service request -> one work order.
Preventive: approved versioned procedure -> recurring plan -> scheduled job ->
one linked work order. The checklist owns preventive execution; its work order
owns material requests, approvals, certification and the statement reference.

Both paths continue through execution/evidence, independent internal approval,
immutable technical report, consultant review when appointed, owner acceptance,
completion certificate, a certified statement line, statement review/owner
approval and final closure of the same work order (and linked PPM job).

## One source for each fact

| Fact | Existing or new authoritative record |
|---|---|
| Owner | Existing bf_clients record; displayed as Owner |
| Service provider | Existing bf_organizations record |
| Contract / project / sites | Existing bf_contracts / bf35_projects / bf35_project_sites |
| Asset and serial/location hierarchy | Existing bf_assets and site/building/floor/zone/room tables |
| Corrective request and work order | Existing bf_service_requests / bf_work_orders |
| PPM procedure version, schedule, results | Existing bf_ppm_procedures / plans / jobs / results |
| Stock custody and actual consumption | Existing advanced stock requests, lines, allocations and ledger |
| Technical report / external decisions | Existing bf13_documents / bf11_approvals |
| Project review appointments | New bf44_policies (not an automatic user-access grant) |
| Revision/report pointer | New bf44_workflows; no second operational work order status |
| Completion certificate | New bf44_certificates; immutable snapshot and report reference |
| Certified statement and line values | New bf44_statements / bf44_statement_lines |

Historical snapshots deliberately preserve the evidence at issuance. They do
not create another editable asset, work order, procedure or stock balance.

## Installation: manual SQL only

1. Deploy main from this repository through the existing hosting pipeline.
2. In the Facilities Supabase project, run `sql/044_INTEGRATED_MAINTENANCE_CYCLE.sql`
   manually. Migration 043 and the existing operational schema are prerequisites.
   The SQL checks dependencies, runs in a transaction and can be rerun. A missing
   prerequisite aborts the transaction. It does not bulk-enroll historical work.
3. Optionally run `sql/044_VERIFY_READ_ONLY.sql` for installation checks.
4. Open Maintenance cycle -> Approval chain; select an existing project linked
   to its owner, provider, contract and sites. An explicitly assigned contract
   manager prepares the chain using the exact emails of authorized reviewers.
5. The selected owner representative signs in and activates the chain. An
   owner must already have owner portal access; an optional consultant must
   already have consultant access for this owner/company. This release does
   not silently grant access or give super admins automatic project authority.
6. Create a new asset fault or explicitly enroll an eligible existing open WO.
   Existing unbound/historical records stay unchanged until chosen. New WOs in
   an active matching project are enrolled automatically; ambiguous projects
   require explicit selection. In PPM job assignment select the project.

The app never runs this migration. Before SQL is installed, the new center
shows activation instructions and links to existing operational pages.

## Acceptance path

- Project: confirm owner, provider, contract, sites and selected reviewers.
- Fault: choose one project asset/serial, submit a request, convert twice and
  confirm both attempts resolve to the same work order.
- Corrective: assign a permitted technician, record a finished visit, actual
  labor and verified evidence; complete work and obtain independent QA.
- Preventive: use the approved procedure version/snapshot, record every
  checklist result and obtain independent QA. Verify linked WO state mirrors
  job state. Do not execute it again as corrective maintenance.
- Materials: use the dossier’s advanced material request. Reserve/issue/receive,
  consume actual quantities and return leftovers; settle and close requests.
  New integrated work cannot use the parallel legacy material request path.
- Report: confirm the complete asset/location trace, technician names, actual
  parts consumption, PPM instructions/results where applicable and evidence.
- Reviews: consultant first when appointed, then selected owner. Rejection keeps
  closure blocked. Rework creates a new revision and invalidates old decisions.
- Certificate: issue once after acceptance; verify a repeated issuance returns
  the same certificate. Print/save its fixed snapshot and original report.
- Statement: finance selects unused certificates in the same project/period;
  records contract coverage and separately approved labor/parts/plant/other
  claim values with their rate/contract basis. Included/warranty work has zero
  additional claim value but remains visible and certifiable.
- Submit: amounts lock. Consultant review when appointed, then independent
  owner approval. The existing WO and PPM job close together. The certificate
  cannot be reused in a different statement.

Statement values are work claims in a single contract currency. They do not
initiate payment, post a tax invoice, convert currencies, derive selling prices
from internal stock costs, or replace accounting/payment integration. Internal
costs stay in the existing restricted costing tables. Final financial values
and line snapshots are immutable after approval.

## Security and verification

New mutations use checked security-definer RPCs with empty search_path, exact
project/owner/contract/site validation, explicit assigned permissions, existing
access scopes and appointed reviewer identities. New tables are read-only via
RLS. Financial statement rows are unavailable to technicians. Legacy close,
approval and material paths are protected by database triggers for enrolled WOs.

Tests run the complete new SQL twice on isolated PostgreSQL (PGlite) with a
compatibility fixture for the existing schema/APIs. They verify duplicate
prevention, material reconciliation, factual execution, ordered reviews,
immutable reports/certificates/statements, exact amounts, RLS, denied blanket
super-admin access, site scope and linked PPM state/rework revisions. The fixture
stubs existing legacy RPCs; it does not certify every historical migration or
production custom schema. Run `npm test` and `npm run build`.

Production SQL has NOT been executed by the assistant. Live acceptance of the
new workflow requires manual installation and real separately authorized owner,
consultant, technician, supervisor and finance accounts. The existing active
approval chain is frozen; changing appointments after activation needs a future
controlled contract-amendment workflow. Existing provider-scoped owner/asset
identities are retained; no cross-company asset transfer migration is included.
