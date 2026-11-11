# Facilities product review — section overlap

## Review findings and changes

| Overlap | Resolution |
| --- | --- |
| Assets, register, passports, lifecycle, category setup and QR entry | One Assets & Maintenance entry; detailed tools appear inside that section. |
| Catalog, catalog administration and deployment | One Asset Library entry; administration and adoption/scheduling are contextual tools. |
| Project setup, organizations, owners, sites, location hierarchy and structure | One Project Setup entry, with descriptive links to its reference/structure tools. |
| Inventory and advanced inventory | One Inventory entry; the specialist screen is named Spare-parts Requests & Reservations. |
| Users and enterprise access | One Users & Access entry; project/site scope and access review are contextual tools. |
| Reports, KPI, executive, backlog, reliability and consumption dashboards | One Management Reports entry; specialist analytics remain available within that section. |
| Corrective execution and integrated maintenance-cycle workspace | One Work Orders entry; integrated closeout/certificates/statements are a named specialist tool. |
| Issued documents and document control | Names and guidance distinguish generated certificates/reports from source attachments, revisions and correspondence. |

The main Work / Setup / Support structure is retained. Soft FM and the owner portal remain independent additional services. Users with only specialist permissions receive an accessible specialist entry even when they cannot open its parent section.

All existing routes, records, database functions and role assignments are retained. This review reorganizes navigation and terminology; it does not delete modules or merge operational records.

## Other defects corrected
- Stale asynchronous project/site loads cannot replace the current company's results after a company change.
- Refreshing the same company keeps the current registration form mounted during a successful refresh.
- Global asset search updates the current asset screen when it is already open.
- Library details close with Escape.
- Guided-workflow prerequisites use Owner and the canonical owner route.

## Validation
Production build passes. All 80 tests pass, including navigation coverage, specialist-only access, prohibited-tool exclusion, canonical detail-route mapping and the existing PostgreSQL maintenance-cycle tests. Interactive authenticated UI inspection remains limited by the absence of a signed-in browser session.
