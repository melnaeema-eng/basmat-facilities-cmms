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

## Compatibility correction 044.2

The deployed database uses the `bf_acl_*` tables. The revised 044 file requires
active organization membership, an enabled Facilities/shared module, explicit
role and organization permission grants, and an active project/company binding
and user project assignment. Site-only assignments do not authorize a whole
project statement. Super-user flags and legacy role rows do not bypass these
checks. Facilities permissions never fall back to Medical permissions.

The missing `bf11_consultant_access` table is not required or recreated. Owner
eligibility uses the existing `bf_acl_user_is_owner(user, organization, owner)`.
Consultants must already have active project access and a consultant role or an
active consultant organization relationship. Owner activation confirms the
specific selected reviewer. The new `bf44_approval_action` uses existing
`bf11_approvals` and `bf11_events`; it does not overwrite legacy authorization
functions or create a second approval store. The dossier uses this endpoint.

If the first 044 attempt stopped at its prerequisite check, rerun the complete
corrected 044 file. No old migration bundle or separate repair SQL is needed.
The preflight now reports all missing required objects together.

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
   already have an active consultant role/relationship and assignment to this project. This release does
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

### Explicit test-project access (046)

Live setup created test project PRJ-000021, its own TEST ONLY owner, zero-value
contract, simulated site and asset AST-000020 (serial TEST-FM-AC-20261108-001).
Native role and project assignments were saved, but the organization module,
permission and project-company binding prerequisites were not visible, leaving
the integrated center empty. The read-only administrative readiness panel
exposes this without granting authority or treating RLS-hidden rows as proof
of absence.

Run 046 manually after deploying this revision. It provisions only the exact
test project after verifying its name, owner, zero-value contract, test assets
and already-assigned active administrator. It creates a seven-day project
entitlement and never creates organization-wide module or permission grants,
changes user assignments, extends an existing grant or reactivates a revoked
grant. Organization permission denies, disabled/expired modules and revoked
project bindings take precedence. Membership, assigned role permissions,
project/site scope, expiry, independent QA and selected owner acceptance remain
mandatory. Changing project parties invalidates the entitlement.

The UI discovers only the current caller's server-derived project permissions;
these do not become permissions on another project or site. The deployed
execute/review/finance permission keys are mapped separately. Medical grants
never confer Facilities authority. Live maintenance acceptance and the complete
training video remain pending until the two actual cycles are closed.

New mutations use checked security-definer RPCs with empty search_path, exact
project/owner/contract/site validation, explicit assigned permissions, active ACL project
assignments and appointed reviewer identities. New tables are read-only via
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

## Live compatibility repair 045

The live center returned PostgREST PGRST203 because both
`bf44_center(p_org uuid)` and the older defaulted four-argument
`bf44_center(p_org uuid, p_client uuid, p_contract uuid, p_limit integer)` exist.
Even a typed PostgreSQL call with just one argument is ambiguous in this case.

The current frontend uses the unique `bf44_cycle_center(p_org uuid)` RPC.
Existing installations of 044 should run only
`sql/045_MAINTENANCE_CENTER_RPC_COMPATIBILITY.sql` manually in the Facilities
Supabase project. This transaction renames the exact single-argument function
without changing its body, owner, security settings or dependent objects. The
four-argument function, its permissions and all operational rows are untouched.
The repair is rerunnable and refreshes the PostgREST schema cache. New installs
of the complete 044 script create the unique endpoint directly.

The client falls back to the old name only when the unique endpoint is missing
(PGRST202), so an existing non-conflicting 044 installation still works before
the small repair is applied. Permission failures do not trigger fallback. A
conflicting legacy endpoint displays the exact manual repair link.

Live preventive/corrective acceptance is still pending; a passing build or
isolated database test is not a successful maintenance cycle on the website.
