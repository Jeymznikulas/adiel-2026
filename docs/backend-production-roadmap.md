# Backend Production Roadmap

This file is the persistent implementation tracker for the ADIEL backend. Update it after every phase, but mark a phase complete only after its exit criteria and verification checks pass.

Last reviewed: 2026-08-30

## Completion rules

- `[ ]` means not completed or not yet verified.
- `[x]` means implemented and verified with appropriate tests.
- Do not mark a whole phase complete when only its database tables exist.
- Preserve the current frontend workflow and owner-only security model.
- Replace business `localStorage` one module at a time. Existing local business data may be discarded.
- Use forward-only migrations for changes to an already-applied database.
- Apply remote Supabase changes only after reviewing the SQL or resource change.
- Record test evidence in the verification log at the bottom of this file.

## Current verified baseline

- [x] ASP.NET Core API runs locally on port `5080`.
- [x] `/health/live` returns `Healthy`.
- [x] `/health/ready` returns `Healthy`.
- [x] Supabase PostgreSQL connection uses the correct Singapore session pooler through user secrets.
- [x] Supabase Auth JWT validation and exact owner-only authorization work.
- [x] The current owner has a matching `public.profiles` record.
- [x] Core Client list, get, create, update, archive and restore APIs exist.
- [x] Client contacts, transactions, concurrency checks and mutation audit writes exist.
- [x] The Clients page reads and writes Client records through the backend API.
- [x] Sixty-two backend tests exist, including authenticated Client, Settings, Supplier, Item, Quotation, Purchase Order, Expense, Statement, payment, Task, cross-module, image and complete Client-to-Payment flows; the production runtime-role verification remains blocked on its unapplied migration.
- [ ] The full backend is production-ready.

## Phase summary

| Phase | Scope | Status |
|---|---|---|
| 0 | Stable baseline | In progress |
| 1 | Finish Clients | Complete |
| 2 | Settings and business options | Complete |
| 3 | Document numbering | Complete |
| 4 | Suppliers | Complete |
| 5 | Items and variants | Complete |
| 6 | Quotations | Complete |
| 7 | Purchase Orders | Complete |
| 8 | Expenses | Complete |
| 9 | Statements of Account | Complete |
| 10 | Payments and Collections | Complete |
| 11 | Tasks and subtasks | Complete |
| 12 | Dashboard and cross-module pages | Complete |
| 13 | Images and Supabase Storage | Complete |
| 14 | Production hardening | In progress (externally blocked) |

## Phase 0 — Stable baseline

- [x] Confirm the API starts successfully.
- [x] Confirm database readiness is healthy.
- [x] Confirm existing automated tests pass.
- [x] Confirm owner-only authentication works.
- [x] Confirm Clients work through the API.
- [x] Correct the stale Tokyo pooler host in non-secret example configuration.
- [ ] Review setup documentation against the working configuration.
- [ ] Confirm a clean Release build succeeds.
- [ ] Create a safe Git checkpoint after reviewing the dirty worktree.
- [ ] Mark Phase 0 complete in the summary table.

Exit criteria: the current system builds and tests cleanly, and all committed setup examples match the working local configuration without containing secrets.

## Phase 1 — Finish Clients

- [x] List Clients through the API.
- [x] Get a Client through the API.
- [x] Create a Client and contacts transactionally.
- [x] Update a Client and contacts transactionally.
- [x] Archive a Client.
- [x] Restore a Client API operation.
- [x] Enforce optimistic concurrency.
- [x] Prevent duplicate active Client names.
- [x] Write Client mutation audit records.
- [x] Remove Client record persistence from `localStorage`.
- [x] Connect the Archive page to archived Client API records.
- [x] Connect Client restore from the Archive UI.
- [x] Read the Client timeline from `audit_records` instead of `localStorage`.
- [x] Load Client industries from `business_options` instead of `localStorage`.
- [x] Add authenticated database-backed Client CRUD integration tests.
- [x] Add server-side search and appropriate pagination.
- [x] Confirm no Client business data remains in `localStorage`.
- [x] Mark Phase 1 complete in the summary table.

Images are intentionally excluded from this phase and tracked in Phase 13.

Exit criteria: Clients, contacts, industries, archive/restore and history all use the backend, with authenticated database integration coverage.

## Phase 2 — Settings and business options

- [x] Implement Company Settings API and repository.
- [x] Implement Document Defaults API and repository.
- [x] Implement Business Options API and repository.
- [x] Support Client industries.
- [x] Support Supplier categories.
- [x] Support Item categories.
- [x] Support Expense categories.
- [x] Support payment methods.
- [x] Add validation and optimistic concurrency.
- [x] Add audit records for settings changes.
- [x] Connect the current Settings UI.
- [x] Remove Settings and business-option `localStorage`.
- [x] Add unit and authenticated integration tests.
- [x] Mark Phase 2 complete in the summary table.

Exit criteria: shared settings and configurable options persist in Supabase and reload correctly without business `localStorage`.

## Phase 3 — Document numbering

- [x] Implement document-numbering rule APIs.
- [x] Implement number preview without reservation.
- [x] Implement atomic number reservation.
- [x] Support prefixes and configured digit counts.
- [x] Support optional year inclusion.
- [x] Support safe yearly sequence resets.
- [x] Prevent duplicate numbers under concurrency.
- [x] Connect the Document Numbering Settings UI.
- [x] Remove numbering `localStorage`.
- [x] Add formatting, reset and concurrency tests.
- [x] Mark Phase 3 complete in the summary table.

Exit criteria: document numbers are generated atomically by the backend and cannot duplicate under concurrent requests.

## Phase 4 — Suppliers

- [x] Implement Supplier CRUD.
- [x] Implement Supplier contacts with exactly one primary contact.
- [x] Implement Supplier categories.
- [x] Implement performance notes.
- [x] Implement archive and restore.
- [x] Implement optimistic concurrency and duplicate-name handling.
- [x] Write Supplier audit records.
- [x] Connect the Supplier page to the API.
- [x] Remove Supplier business `localStorage`.
- [x] Add domain and authenticated integration tests.
- [x] Mark Phase 4 complete in the summary table.

Images are tracked in Phase 13.

Exit criteria: the Supplier directory and related notes/categories work entirely through the owner-protected backend.

## Phase 5 — Items and variants

- [x] Implement Item CRUD.
- [x] Implement Supplier relationships.
- [x] Implement Item categories.
- [x] Implement Item variants.
- [x] Implement variant specifications.
- [x] Implement price-adjustment history.
- [x] Enforce product-code uniqueness.
- [x] Implement archive and restore.
- [x] Implement optimistic concurrency and audit records.
- [x] Connect the Items page to the API.
- [x] Remove Item business `localStorage`.
- [x] Add domain and authenticated integration tests.
- [x] Mark Phase 5 complete in the summary table.

Images are tracked in Phase 13.

Exit criteria: Items, variants, specifications, prices and Supplier relationships work entirely through the backend.

## Phase 6 — Quotations

- [x] Implement Quotation CRUD.
- [x] Implement Client relationships.
- [x] Implement Quotation lines and charges.
- [x] Reserve Quotation numbers atomically.
- [x] Calculate all trusted totals on the backend.
- [x] Preserve historical descriptions and prices.
- [x] Implement valid status transitions.
- [x] Implement archive, restore and void behavior.
- [x] Implement optimistic concurrency and audit records.
- [x] Connect the Quotations page to the API.
- [x] Remove Quotation business `localStorage`.
- [x] Make frontend PDF generation consume backend data.
- [x] Add transaction, calculation and integration tests.
- [x] Mark Phase 6 complete in the summary table.

Exit criteria: Quotations are transactionally persisted, numbered and calculated by the backend without trusting browser totals.

## Phase 7 — Purchase Orders

- [x] Implement Purchase Order CRUD.
- [x] Implement Supplier, Client, Quotation and Item relationships.
- [x] Implement lines and charges.
- [x] Reserve PO numbers atomically.
- [x] Calculate totals on the backend.
- [x] Preserve historical descriptions and prices.
- [x] Implement document, delivery and payment statuses.
- [x] Implement valid status transitions.
- [x] Implement archive, restore and void behavior.
- [x] Implement optimistic concurrency and audit records.
- [x] Connect the Purchase Orders page to the API.
- [x] Remove Purchase Order business `localStorage`.
- [x] Add transaction and authenticated integration tests.
- [x] Mark Phase 7 complete in the summary table.

Exit criteria: Purchase Orders and their lifecycle work entirely through transactional, owner-protected APIs.

## Phase 8 — Expenses

- [x] Implement Expense CRUD.
- [x] Implement Expense categories and payment methods.
- [x] Implement optional Quotation and Purchase Order relationships.
- [x] Implement safe Expense generation from a Purchase Order.
- [x] Prevent duplicate PO-linked Expenses.
- [x] Implement valid Expense status transitions.
- [x] Implement archive and restore.
- [x] Implement optimistic concurrency and audit records.
- [x] Connect the Expenses page to the API.
- [x] Remove Expense business `localStorage`.
- [x] Add idempotency, transaction and integration tests.
- [x] Mark Phase 8 complete in the summary table.

Exit criteria: Expenses and PO-linked Expense generation are transactional, idempotent and backend-controlled.

## Phase 9 — Statements of Account

- [x] Implement Statement CRUD.
- [x] Implement Client relationships.
- [x] Link eligible Quotations.
- [x] Implement Statement items and charges.
- [x] Reserve Statement numbers atomically.
- [x] Calculate totals and balances on the backend.
- [x] Implement payment schedules.
- [x] Implement late-charge rules and calculations.
- [x] Implement valid status transitions.
- [x] Implement archive, restore and void behavior.
- [x] Implement optimistic concurrency and audit records.
- [x] Connect the Statement of Account page to the API.
- [x] Remove Statement business `localStorage`.
- [x] Add transaction and calculation tests.
- [x] Mark Phase 9 complete in the summary table.

Exit criteria: Statements, linked Quotations, schedules and late charges are persisted and calculated by the backend.

## Phase 10 — Payments and Collections

- [x] Record partial and full Statement payments.
- [x] Calculate Collection status and outstanding balances.
- [x] Prevent overpayment.
- [x] Protect payment submission with idempotency.
- [x] Keep payment records immutable.
- [x] Implement reversal or void correction records.
- [x] Never edit or delete a recorded payment.
- [x] Write financial audit records.
- [x] Connect Collections and Statement payment UI.
- [x] Remove related business `localStorage`.
- [x] Add calculation, concurrency, idempotency and integration tests.
- [x] Mark Phase 10 complete in the summary table.

Exit criteria: financial payment operations are immutable, transactional, idempotent and fully backend-calculated.

## Phase 11 — Tasks and subtasks

- [x] Implement Task CRUD.
- [x] Implement subtasks.
- [x] Implement priorities and due dates.
- [x] Implement valid status and completion transitions.
- [x] Implement archive and restore.
- [x] Implement optimistic concurrency and audit records.
- [x] Connect the Tasks page to the API.
- [x] Remove Task business `localStorage`.
- [x] Add domain and authenticated integration tests.
- [x] Mark Phase 11 complete in the summary table.

Exit criteria: Tasks and subtasks work entirely through the owner-protected backend.

## Phase 12 — Dashboard and cross-module pages

- [x] Implement Dashboard summary queries.
- [x] Implement Sales Tracker queries.
- [x] Implement Global Search API.
- [x] Implement unified Archive API.
- [x] Implement Activity and audit-log API.
- [x] Add filtering, pagination and date ranges.
- [x] Keep aggregations and financial calculations on the backend.
- [x] Connect all derived frontend pages.
- [x] Remove remaining derived business `localStorage`.
- [x] Add query and authenticated integration tests.
- [x] Mark Phase 12 complete in the summary table.

Exit criteria: cross-module pages query Supabase through efficient backend endpoints and no longer reconstruct business state from the browser.

## Phase 13 — Images and Supabase Storage

- [x] Create or confirm a private `business-images` bucket.
- [x] Configure the backend Storage secret outside source control.
- [x] Implement a reusable Storage service.
- [x] Implement owner-protected multipart upload endpoints.
- [x] Enforce a 5 MB maximum.
- [x] Allow only PNG, JPEG and WebP.
- [x] Validate actual file signatures.
- [x] Generate safe object names on the backend.
- [x] Store object paths in `photo_url`, never Base64 or signed URLs.
- [x] Generate short-lived signed viewing URLs.
- [x] Implement safe replacement and old-file cleanup.
- [x] Handle failed uploads and orphan cleanup.
- [x] Connect Client, Supplier, Item and variant image controls.
- [x] Add Storage service and endpoint tests.
- [x] Document separate Storage-object backups.
- [x] Mark Phase 13 complete in the summary table.

Exit criteria: business images are private, validated, replaceable and accessible only through short-lived authorized URLs.

## Phase 14 — Production hardening

- [ ] Replace the broad `postgres` connection with a least-privilege API role. (Reviewed migration and fail-closed connection validation are ready; remote migration history and login creation are blocked.)
- [ ] Configure production CORS origins. (Explicit HTTPS validation and an example are ready; the deployed frontend origin was not supplied.)
- [ ] Restrict `AllowedHosts`. (Wildcard fallback is removed; the deployed API host was not supplied.)
- [ ] Configure HTTPS, HSTS and proxy behavior for the target host. (Fail-closed behavior is implemented; target proxy IP/topology and deployment verification are missing.)
- [ ] Configure production secret storage. (Required keys and validation are documented; no deployment secret manager was supplied.)
- [x] Add OpenAPI documentation.
- [x] Review rate limits, request limits and timeouts.
- [x] Review database and Storage health behavior.
- [ ] Run Supabase Security Advisor.
- [ ] Run Supabase Performance Advisor.
- [x] Confirm RLS on every exposed table.
- [x] Add full authenticated API integration coverage for critical flows.
- [ ] Add browser end-to-end tests. (Anonymous browser coverage passes; the authenticated owner case is implemented but skipped because no E2E credentials were supplied.)
- [x] Test the complete Client-to-Payment business workflow.
- [ ] Configure regular database exports/backups. (Fail-safe export tooling and schedule/retention documentation are ready; no production scheduler or encrypted target was supplied.)
- [ ] Configure separate Storage-object backups. (Independent object tooling and manifest documentation are ready; no production scheduler or encrypted target was supplied.)
- [ ] Perform and document a restore drill.
- [x] Confirm no secrets are committed or logged.
- [x] Confirm no business data remains in `localStorage`.
- [x] Complete the final production readiness review. (Result: not ready; blockers are recorded below.)
- [ ] Mark Phase 14 complete in the summary table.

Exit criteria: the deployed target configuration passes security, workflow, backup, recovery, monitoring and operational checks.

## Final production acceptance

- [ ] Every phase in the summary is marked complete.
- [ ] All migrations succeed on a clean test project.
- [ ] Release frontend and backend builds pass.
- [ ] Unit, integration and end-to-end tests pass.
- [ ] The full Client → Quotation → PO → Expense → SOA → Payment workflow passes.
- [ ] Security and Performance Advisors have no unresolved serious findings.
- [ ] Backup and restore procedures are proven.
- [ ] The system is approved for its intended local-only or hosted deployment environment.

## Verification log

| Date | Phase | Verification | Result | Notes |
|---|---|---|---|---|
| 2026-08-24 | Baseline | `/health/live` and `/health/ready` | Passed | Both returned `Healthy`. |
| 2026-08-24 | Clients | .NET Release tests | Passed | 4 unit tests and 2 integration tests passed. |
| 2026-08-24 | Clients | Manual frontend/API flow | Passed | Client requests succeeded after correcting the pooler region, owner profile and SQL query composition. |
| 2026-08-24 | Phase 1 | Authenticated database CRUD integration | Passed | Owner-authenticated create, search, update, archive, archived search, restore and audit timeline passed against Supabase; the test transaction rolled back. |
| 2026-08-24 | Phase 1 | Complete .NET Release test suite | Passed | 4 unit tests and 3 integration tests passed. |
| 2026-08-24 | Phase 1 | Frontend production build | Passed | TypeScript and Vite production build completed successfully. |
| 2026-08-24 | Phase 1 | Client browser-storage scan | Passed | No `adiel.clients` or `adiel.client-industries` references remain under `src/web/src`. |
| 2026-08-24 | Phase 1 | Local runtime health | Passed | `/health/live` and `/health/ready` both returned `Healthy`; the local frontend returned HTTP 200. |
| 2026-08-25 | Phase 2 | Supabase migrations | Passed | Settings/business-option constraints, Supplier categories, Settings audit support and scoped test-data cleanup were applied; local and remote migration histories match. |
| 2026-08-25 | Phase 2 | Complete .NET Release test suite | Passed | 7 unit tests and 4 integration tests passed, including authenticated Settings mutations against Supabase with rollback. |
| 2026-08-25 | Phase 2 | Frontend production build | Passed | TypeScript and Vite completed successfully; only the existing large-chunk advisory remains. |
| 2026-08-25 | Phase 2 | Settings browser-storage scan | Passed | No Company, Document Defaults or supported business-option storage keys remain under `src/web/src`. |
| 2026-08-25 | Phase 2 | Connection configuration | Passed | The API, README and non-secret example use the project's Singapore pooler region. |
| 2026-08-25 | Phase 3 | Supabase migration | Passed | Numbering-prefix uniqueness and non-reserving preview support were applied; the reservation function locks the rule and increments one database sequence row atomically. |
| 2026-08-25 | Phase 3 | Numbering tests | Passed | Rule validation, formatting, yearly reset, preview and distinct reservation behavior passed through unit and authenticated database tests with rollback. |
| 2026-08-25 | Phase 3 | Complete .NET Release test suite | Passed | 10 unit tests and 6 integration tests passed. |
| 2026-08-25 | Phase 3 | Frontend production build | Passed | TypeScript and Vite production build completed successfully; only the existing large-chunk advisory remains. |
| 2026-08-25 | Phase 3 | Numbering browser-storage scan | Passed | No `adiel.document-numbering` references remain under `src/web/src`. |
| 2026-08-25 | Phase 4 | Supplier unit and authenticated CRUD integration tests | Passed | Supplier validation plus owner-authenticated create, update, archive, archived list and restore passed against Supabase; the integration test transaction rolled back. |
| 2026-08-25 | Phase 4 | Complete .NET Release test suite | Passed | 12 unit tests and 7 integration tests passed. |
| 2026-08-25 | Phase 4 | Frontend production build | Passed | TypeScript and Vite production build completed successfully. |
| 2026-08-25 | Phase 4 | Supplier browser-storage scan | Passed | No `adiel.suppliers` references remain under `src/web/src`. |
| 2026-08-25 | Phase 5 | Item domain and authenticated integration tests | Passed | Item validation plus owner-authenticated Item, variant, price-adjustment, archive and restore flow passed against Supabase with rollback. |
| 2026-08-25 | Phase 5 | Complete .NET Release test suite | Passed | 13 unit tests passed; authenticated integration suite completed against Supabase. |
| 2026-08-25 | Phase 5 | Item browser-storage scan | Passed | No `adiel.items` references remain under `src/web/src`. |
| 2026-08-25 | Phase 6 | Authenticated Quotation workflow integration test | Passed | Owner-authenticated create, trusted calculations and snapshots, approval, void, archive and restore passed against Supabase with rollback. |
| 2026-08-25 | Phase 6 | Complete .NET Release test suite | Passed | 13 unit tests and 9 integration tests passed. |
| 2026-08-25 | Phase 6 | Frontend production build | Passed | TypeScript and Vite production build completed successfully. |
| 2026-08-25 | Phase 6 | Quotation browser-storage scan | Passed | No `adiel.quotations` or `quotationStorageKey` references remain under `src/web/src`. |
| 2026-08-25 | Phase 7 | Authenticated Purchase Order workflow integration test | Passed | Owner-authenticated server-calculated create, lifecycle change, void, archive and restore passed against Supabase with rollback. |
| 2026-08-25 | Phase 7 | Complete .NET Release test suite | Passed | 13 unit tests and 10 integration tests passed. |
| 2026-08-25 | Phase 7 | Frontend production build | Passed | TypeScript and Vite production build completed successfully. |
| 2026-08-25 | Phase 7 | Purchase Order browser-storage scan | Passed | No `adiel.purchase-orders` references remain under `src/web/src`. |
| 2026-08-25 | Phase 8 | Authenticated Expense and PO-generation integration tests | Passed | Owner-authenticated Expense CRUD, status lifecycle, stale-write rejection, void, archive/restore, PO generation and repeat-request idempotency passed against Supabase with rollback. |
| 2026-08-25 | Phase 8 | Complete .NET Release test suite | Passed | 13 unit tests and 11 authenticated integration tests passed against Supabase. |
| 2026-08-25 | Phase 8 | Frontend production build | Passed | TypeScript and Vite production build completed successfully. |
| 2026-08-25 | Phase 8 | Expense browser-storage scan and final diff check | Passed | No `adiel.expenses` references remain under `src/web/src`; `git diff --check` passed. |
| 2026-08-25 | Phase 9 | Authenticated Statement workflow integration | Passed | Owner-authenticated eligibility checks, snapshots, backend totals, schedules, concurrency, issued/overdue/void lifecycle, late-charge apply/waive, archive/restore and audit records passed against Supabase with rollback. |
| 2026-08-25 | Phase 9 | Authentication and owner isolation | Passed | Anonymous Statement access returned 401 and an authenticated non-owner returned 403. |
| 2026-08-25 | Phase 9 | Complete .NET Release test suite | Passed | 13 unit tests and 14 authenticated/infrastructure integration tests passed. |
| 2026-08-25 | Phase 9 | Frontend production build | Passed | TypeScript and Vite production build completed successfully. |
| 2026-08-25 | Phase 9 | Statement browser-storage scan and final diff check | Passed | No `adiel.statements-of-account` references remain under `src/web/src`; `git diff --check` passed. |
| 2026-08-25 | Phase 10 | Authenticated payment and collection workflow integration | Passed | Partial/full payment, backend allocation and balances, idempotency replay, stale concurrent submission rejection, overpayment rejection, immutable reversal and financial audit records passed against Supabase with rollback. |
| 2026-08-25 | Phase 10 | Payment authentication and owner isolation | Passed | Anonymous payment access returned 401 and an authenticated non-owner returned 403. |
| 2026-08-25 | Phase 10 | Complete .NET Release test suite | Passed | 13 unit tests and 15 authenticated/infrastructure integration tests passed. |
| 2026-08-25 | Phase 10 | Frontend production build | Passed | TypeScript and Vite production build completed successfully. |
| 2026-08-25 | Phase 10 | Payment and collection storage scan and final diff check | Passed | No related business storage references remain under the Statement or Collections feature folders; `git diff --check` passed. |
| 2026-08-26 | Phase 11 | Task domain and authenticated workflow integration | Passed | CRUD, subtask add/update/completion/removal, status and completion rules, priorities, due dates, parent checks, concurrency, archive/restore and audit records passed against Supabase with rollback. |
| 2026-08-26 | Phase 11 | Task authentication and owner isolation | Passed | Anonymous Task access returned 401 and an authenticated non-owner returned 403. |
| 2026-08-26 | Phase 11 | Complete .NET Release build and test suite | Passed | Release build completed with zero warnings/errors; 20 unit tests and 17 integration tests passed. |
| 2026-08-26 | Phase 11 | Frontend verification | Passed | TypeScript typecheck and Vite production build completed successfully; only the existing large-chunk advisory remains. |
| 2026-08-26 | Phase 11 | Task browser-storage scan and final diff check | Passed | No `adiel.tasks` or Task feature business `localStorage` references remain under `src/web/src`; `git diff --check` passed. |
| 2026-08-26 | Phase 12 | Dashboard, Sales, Search, Archive and Activity integration | Passed | Owner-authenticated dashboard, sales date range, search, archive and activity filters/pagination executed against Supabase; invalid filters and non-owner access were rejected. |
| 2026-08-26 | Phase 12 | Release/backend and frontend verification | Passed | API Release build and focused/full test runs completed; frontend typecheck and production build completed; derived pages have no direct business `localStorage` reads. |
| 2026-08-26 | Phase 13 | Private bucket policy | Passed | The existing `business-images` bucket was confirmed and corrected to private with a 5 MB limit and PNG/JPEG/WebP allow-list. |
| 2026-08-26 | Phase 13 | Storage service and authenticated endpoints | Passed | Signature validation, safe paths, owner authorization, Client/Supplier/Item/variant upload and viewing, replace/remove, concurrency, transactional reference/audit writes and failure cleanup passed 6 focused unit and 6 focused integration tests. |
| 2026-08-26 | Phase 13 | Release/backend and frontend verification | Passed | Release build completed with zero warnings/errors; all 26 unit and 25 integration tests passed; frontend typecheck and production build passed; image Base64 and secret scans plus `git diff --check` passed. |
| 2026-08-26 | Phase 13 | Live Storage round trip | Passed | A real private-object upload, backend reference update, signed download and cleanup completed against Supabase; signed paths are normalized under `/storage/v1`, and legacy external URLs are excluded from object cleanup. |
| 2026-08-26 | Phase 13 | Secret rotation and final verification | Passed | The exposed legacy credential was replaced by a different externally stored modern Supabase secret; private-bucket verification and a real upload/signed-download/cleanup round trip passed with the replacement. Release build, 26 unit tests, 25 integration tests, frontend typecheck/build, secret/Base64/browser-storage scans and final diff checks passed. |
| 2026-08-30 | Phase 14 | Release builds and production controls | Passed | Backend Release build completed with zero warnings/errors; frontend typecheck/build passed. Authenticated OpenAPI, security headers, 6 MiB request rejection, 120/minute owner rate limiting and fail-closed production configuration tests passed. |
| 2026-08-30 | Phase 14 | Database and Storage readiness | Passed | A running local API returned HTTP 200 `Healthy` from both `/health/live` and `/health/ready`; readiness performed a read-only private-bucket check and a PostgreSQL query. |
| 2026-08-30 | Phase 14 | Complete Client-to-Payment integration | Passed | One owner-authenticated rollback transaction created a Client, Supplier and Item, approved a Quotation, linked a Purchase Order, generated its Expense, issued an SOA and recorded a full Payment that settled the balance. |
| 2026-08-30 | Phase 14 | Backend suite | Blocked | 28/28 unit tests and 33 integration tests passed. The only remaining integration failure is runtime-role/RLS verification because migration `20260830000000` is not applied. |
| 2026-08-30 | Phase 14 | RLS and least-privilege role | Partially passed | The RLS query confirmed no exposed `public` table lacks RLS. Role/policy verification is blocked: remote history skipped `20260827000000` and `20260828000000`, so Supabase requires `--include-all` before it will apply reviewed Phase 14 migration `20260830000000`; applying unrelated migrations was not authorized. |
| 2026-08-30 | Phase 14 | Browser E2E | Blocked | Microsoft Edge executed the anonymous authentication-boundary test successfully. The implemented authenticated critical-register/localStorage test was skipped because `ADIEL_E2E_USERNAME` and `ADIEL_E2E_PASSWORD` are absent from external secrets. |
| 2026-08-30 | Phase 14 | Secret and browser-storage scans | Passed | The tracked-and-untracked repository-file secret scan printed no values and passed; business `localStorage` use was removed, leaving only allow-listed UI preferences. |
| 2026-08-30 | Phase 14 | Advisors, backups and restore drill | Blocked | CLI database lint found no schema errors and index statistics were collected, but no Supabase Advisor UI access, production scheduler, encrypted backup destination, isolated restore project or destructive-restore approval was supplied. The workstation also lacks Docker and PostgreSQL restore clients; no success was fabricated. |
| 2026-08-30 | Phase 14 | Production dependency audit | Blocked | `npm audit --omit=dev` reports a pre-existing critical `jspdf` advisory fixed only by an unrelated major upgrade to 4.2.1; Phase 14 did not perform that prohibited upgrade. |

## Phase completion log

Add an entry only after every checklist item and exit criterion for that phase are verified.

| Date completed | Phase | Commit/checkpoint | Notes |
|---|---|---|---|
| 2026-08-26 | Phase 13 - Images and Supabase Storage | Working tree checkpoint | The private `business-images` bucket, externally stored rotated backend secret, validated multipart uploads, safe owner paths, transactional references/audits, signed viewing, replacement cleanup, four entity integrations, tests and backup documentation satisfy the Phase 13 exit criterion. |
| 2026-08-26 | Phase 12 - Dashboard and cross-module pages | Working tree checkpoint | Owner-protected, parameterized dashboard, sales, search, unified archive and audit activity queries now provide backend pagination and financial aggregates; derived frontend pages consume those APIs. |
| 2026-08-26 | Phase 11 — Tasks and subtasks | Working tree checkpoint | Tasks, subtasks, priorities, due dates, completion rules, archive/restore, concurrency and audit records are owner-protected and Supabase-backed; Tasks and Archive now use the API without Task business `localStorage`. |
| 2026-08-25 | Phase 10 — Payments and Collections | Working tree checkpoint | Immutable Statement payments and reversals, idempotency, backend allocation, overpayment protection, financial auditing and API-backed Collections are owner-protected and Supabase-backed. |
| 2026-08-25 | Phase 9 — Statements of Account | Working tree checkpoint | Statements, Client and eligible-Quotation relationships, immutable quotation snapshots, schedules, atomic numbering, backend totals, late-charge review, lifecycle, concurrency, audit and archive/restore are owner-protected and Supabase-backed; payments remain deferred to Phase 10. |
| 2026-08-25 | Phase 8 — Expenses | Working tree checkpoint | Expenses, approved-Quotation links, transactional PO-generated expenses, idempotency, lifecycle status changes, archive/restore, concurrency and audit records are owner-protected and Supabase-backed. |
| 2026-08-24 | Phase 1 — Finish Clients | Working tree checkpoint | Clients, contacts, industries, archive/restore and history are backend-backed and verified. |
| 2026-08-25 | Phase 2 — Settings and business options | Working tree checkpoint | Shared settings and five configurable option types persist in Supabase, reload through owner-protected APIs and are verified without business `localStorage`. |
| 2026-08-25 | Phase 3 — Document numbering | Working tree checkpoint | Rules, previews and atomic reservations are owner-protected and database-backed; the Settings UI persists directly to Supabase without numbering `localStorage`. |
| 2026-08-25 | Phase 4 — Suppliers | Working tree checkpoint | Suppliers, contacts, categories, notes and archive/restore are owner-protected and backend-backed; the Supplier, Archive, Item and Purchase Order supplier selectors no longer read Supplier business data from `localStorage`. |
| 2026-08-25 | Phase 5 — Items and variants | Working tree checkpoint | Items, variants, specifications, price adjustments and archive/restore are owner-protected and Supabase-backed; Item browser storage has been removed. |
| 2026-08-25 | Phase 6 — Quotations | Working tree checkpoint | Quotations, lines, charges, backend totals, atomic numbering, lifecycle transitions, concurrency, audit history and archive/restore are owner-protected and Supabase-backed; all frontend quotation consumers now read backend data. |
| 2026-08-25 | Phase 7 — Purchase Orders | Working tree checkpoint | Purchase orders, linked Supplier/Client/Quotation/Item snapshots, backend totals, atomic numbering, lifecycle status transitions, concurrency, audit history and archive/restore are owner-protected and Supabase-backed. |
