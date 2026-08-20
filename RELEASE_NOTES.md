# Cervos POS — Release Notes

**Version:** 0.1.4
**Release Date:** 15 August 2026
**Component:** Cervos POS (Endpoint Application)

---

## Overview

This release strengthens data continuity between pharmacy endpoints and the
central Cervos platform. It introduces reliable two-way synchronization for
inventory, automated background synchronization, and remote operational control
capabilities for administrators and headquarters.

---

## New Features

### Inventory Synchronization
Product and stock information created or modified at the endpoint is now
replicated to the central platform, providing administrators with an accurate
and current view of branch-level catalog and inventory data.

### Formulation and Stock Management
The product record now supports a **Formulation** attribute (e.g., Tablet,
Capsule, Syrup, Injection) and a **Stock Quantity** field that provisions an
initial stock batch with associated cost, sale price, and expiry information.

### Remote Operational Control
Headquarters can now issue operational commands to individual endpoints,
including branch lock, suspension, and reactivation. These commands are
delivered through the synchronization channel and applied automatically at the
endpoint.

### Subscription Enforcement
Endpoints now honor their subscription and access status. When a branch is
locked or suspended by headquarters or the platform, the application presents a
clear, non-dismissible notification and restricts transaction processing until
the status is resolved and confirmed through synchronization.

---

## Improvements

### Automated Background Synchronization
Synchronization now operates automatically in the background on a scheduled
interval, as well as on application focus and network reconnection. The process
is resilient to intermittent connectivity and conserves API capacity through
efficient, batched data transfer.

### Reliable Data Retrieval
The inbound data path has been re-architected for improved reliability, ensuring
that catalog updates, stock changes, and administrative directives issued from
the platform are consistently retrieved and applied at the endpoint.

---

## Deployment Notes

Prior to upgrading, the following database configuration must be applied once in
the central platform environment:

- `scripts/hq_schema_requirements.sql`
- `sql/migrations/branch_commands.sql`

Both scripts are idempotent and may be executed safely against an existing
environment. No application data migration is required.

---

## Compatibility

- Installer: `Cervos POS_0.1.4_x64-setup.exe` (NSIS)
- Requires an active link to the central Cervos platform for synchronization
  and remote management features.
- No breaking changes to local operation; the application remains fully
  functional in offline mode.
