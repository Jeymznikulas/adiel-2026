# Backend Production Roadmap

This file is the persistent implementation tracker for the ADIEL backend. Update it after every phase, but mark a phase complete only after its exit criteria and verification checks pass.

Last reviewed: 2026-08-25

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
- [x] Twenty-two automated backend tests pass, including authenticated Client, Settings, Supplier, Item and Quotation database flows.
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
| 7 | Purchase Orders | Not started |
| 8 | Expenses | Not started |
| 9 | Statements of Account | Not started |
| 10 | Payments and Collections | Not started |
| 11 | Tasks and subtasks | Not started |
| 12 | Dashboard and cross-module pages | Not started |
| 13 | Images and Supabase Storage | Deferred |
| 14 | Production hardening | Not started |

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

- [ ] Implement Purchase Order CRUD.
- [ ] Implement Supplier, Client, Quotation and Item relationships.
- [ ] Implement lines and charges.
- [ ] Reserve PO numbers atomically.
- [ ] Calculate totals on the backend.
- [ ] Preserve historical descriptions and prices.
- [ ] Implement document, delivery and payment statuses.
- [ ] Implement valid status transitions.
- [ ] Implement archive, restore and void behavior.
- [ ] Implement optimistic concurrency and audit records.
- [ ] Connect the Purchase Orders page to the API.
- [ ] Remove Purchase Order business `localStorage`.
- [ ] Add transaction and authenticated integration tests.
- [ ] Mark Phase 7 complete in the summary table.

Exit criteria: Purchase Orders and their lifecycle work entirely through transactional, owner-protected APIs.

## Phase 8 — Expenses

- [ ] Implement Expense CRUD.
- [ ] Implement Expense categories and payment methods.
- [ ] Implement optional Quotation and Purchase Order relationships.
- [ ] Implement safe Expense generation from a Purchase Order.
- [ ] Prevent duplicate PO-linked Expenses.
- [ ] Implement valid Expense status transitions.
- [ ] Implement archive and restore.
- [ ] Implement optimistic concurrency and audit records.
- [ ] Connect the Expenses page to the API.
- [ ] Remove Expense business `localStorage`.
- [ ] Add idempotency, transaction and integration tests.
- [ ] Mark Phase 8 complete in the summary table.

Exit criteria: Expenses and PO-linked Expense generation are transactional, idempotent and backend-controlled.

## Phase 9 — Statements of Account

- [ ] Implement Statement CRUD.
- [ ] Implement Client relationships.
- [ ] Link eligible Quotations.
- [ ] Implement Statement items and charges.
- [ ] Reserve Statement numbers atomically.
- [ ] Calculate totals and balances on the backend.
- [ ] Implement payment schedules.
- [ ] Implement late-charge rules and calculations.
- [ ] Implement valid status transitions.
- [ ] Implement archive, restore and void behavior.
- [ ] Implement optimistic concurrency and audit records.
- [ ] Connect the Statement of Account page to the API.
- [ ] Remove Statement business `localStorage`.
- [ ] Add transaction and calculation tests.
- [ ] Mark Phase 9 complete in the summary table.

Exit criteria: Statements, linked Quotations, schedules and late charges are persisted and calculated by the backend.

## Phase 10 — Payments and Collections

- [ ] Record partial and full Statement payments.
- [ ] Calculate Collection status and outstanding balances.
- [ ] Prevent overpayment.
- [ ] Protect payment submission with idempotency.
- [ ] Keep payment records immutable.
- [ ] Implement reversal or void correction records.
- [ ] Never edit or delete a recorded payment.
- [ ] Write financial audit records.
- [ ] Connect Collections and Statement payment UI.
- [ ] Remove related business `localStorage`.
- [ ] Add calculation, concurrency, idempotency and integration tests.
- [ ] Mark Phase 10 complete in the summary table.

Exit criteria: financial payment operations are immutable, transactional, idempotent and fully backend-calculated.

## Phase 11 — Tasks and subtasks

- [ ] Implement Task CRUD.
- [ ] Implement subtasks.
- [ ] Implement priorities and due dates.
- [ ] Implement valid status and completion transitions.
- [ ] Implement archive and restore.
- [ ] Implement optimistic concurrency and audit records.
- [ ] Connect the Tasks page to the API.
- [ ] Remove Task business `localStorage`.
- [ ] Add domain and authenticated integration tests.
- [ ] Mark Phase 11 complete in the summary table.

Exit criteria: Tasks and subtasks work entirely through the owner-protected backend.

## Phase 12 — Dashboard and cross-module pages

- [ ] Implement Dashboard summary queries.
- [ ] Implement Sales Tracker queries.
- [ ] Implement Global Search API.
- [ ] Implement unified Archive API.
- [ ] Implement Activity and audit-log API.
- [ ] Add filtering, pagination and date ranges.
- [ ] Keep aggregations and financial calculations on the backend.
- [ ] Connect all derived frontend pages.
- [ ] Remove remaining derived business `localStorage`.
- [ ] Add query and authenticated integration tests.
- [ ] Mark Phase 12 complete in the summary table.

Exit criteria: cross-module pages query Supabase through efficient backend endpoints and no longer reconstruct business state from the browser.

## Phase 13 — Images and Supabase Storage

- [ ] Create or confirm a private `business-images` bucket.
- [ ] Configure the backend Storage secret outside source control.
- [ ] Implement a reusable Storage service.
- [ ] Implement owner-protected multipart upload endpoints.
- [ ] Enforce a 5 MB maximum.
- [ ] Allow only PNG, JPEG and WebP.
- [ ] Validate actual file signatures.
- [ ] Generate safe object names on the backend.
- [ ] Store object paths in `photo_url`, never Base64 or signed URLs.
- [ ] Generate short-lived signed viewing URLs.
- [ ] Implement safe replacement and old-file cleanup.
- [ ] Handle failed uploads and orphan cleanup.
- [ ] Connect Client, Supplier, Item and variant image controls.
- [ ] Add Storage service and endpoint tests.
- [ ] Document separate Storage-object backups.
- [ ] Mark Phase 13 complete in the summary table.

Exit criteria: business images are private, validated, replaceable and accessible only through short-lived authorized URLs.

## Phase 14 — Production hardening

- [ ] Replace the broad `postgres` connection with a least-privilege API role.
- [ ] Configure production CORS origins.
- [ ] Restrict `AllowedHosts`.
- [ ] Configure HTTPS, HSTS and proxy behavior for the target host.
- [ ] Configure production secret storage.
- [ ] Add OpenAPI documentation.
- [ ] Review rate limits, request limits and timeouts.
- [ ] Review database and Storage health behavior.
- [ ] Run Supabase Security Advisor.
- [ ] Run Supabase Performance Advisor.
- [ ] Confirm RLS on every exposed table.
- [ ] Add full authenticated API integration coverage for critical flows.
- [ ] Add browser end-to-end tests.
- [ ] Test the complete Client-to-Payment business workflow.
- [ ] Configure regular database exports/backups.
- [ ] Configure separate Storage-object backups.
- [ ] Perform and document a restore drill.
- [ ] Confirm no secrets are committed or logged.
- [ ] Confirm no business data remains in `localStorage`.
- [ ] Complete the final production readiness review.
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

## Phase completion log

Add an entry only after every checklist item and exit criterion for that phase are verified.

| Date completed | Phase | Commit/checkpoint | Notes |
|---|---|---|---|
| 2026-08-24 | Phase 1 — Finish Clients | Working tree checkpoint | Clients, contacts, industries, archive/restore and history are backend-backed and verified. |
| 2026-08-25 | Phase 2 — Settings and business options | Working tree checkpoint | Shared settings and five configurable option types persist in Supabase, reload through owner-protected APIs and are verified without business `localStorage`. |
| 2026-08-25 | Phase 3 — Document numbering | Working tree checkpoint | Rules, previews and atomic reservations are owner-protected and database-backed; the Settings UI persists directly to Supabase without numbering `localStorage`. |
| 2026-08-25 | Phase 4 — Suppliers | Working tree checkpoint | Suppliers, contacts, categories, notes and archive/restore are owner-protected and backend-backed; the Supplier, Archive, Item and Purchase Order supplier selectors no longer read Supplier business data from `localStorage`. |
| 2026-08-25 | Phase 5 — Items and variants | Working tree checkpoint | Items, variants, specifications, price adjustments and archive/restore are owner-protected and Supabase-backed; Item browser storage has been removed. |
| 2026-08-25 | Phase 6 — Quotations | Working tree checkpoint | Quotations, lines, charges, backend totals, atomic numbering, lifecycle transitions, concurrency, audit history and archive/restore are owner-protected and Supabase-backed; all frontend quotation consumers now read backend data. |
