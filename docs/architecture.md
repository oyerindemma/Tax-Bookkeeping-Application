# Architecture Overview

## Approach
Start with a modular monolith for speed and coherence, while establishing clear domain boundaries to enable future service extraction. Design for offline-first operation and reliable synchronisation.

## Core Domains
- Identity and access
- Ledger and bookkeeping
- Tax rules and calculation
- Reporting and exports
- Education and guidance
- Notifications and reminders
- Admin and analytics

## High-Level Components
- Mobile application (Android first) with offline storage
- Responsive web app for business and admin workflows
- Backend API layer with domain modules
- Data storage: relational core + object storage for receipts
- Integration layer for payments and government systems

## Data Model Essentials
- Multi-tenant organisation/workspace model
- Double-entry ledger support (even if simplified in UI)
- Tax rule engine with effective dates and versioning
- Immutable audit log for all financial events

## Reliability and Operations
- Clear SLOs for availability and sync latency
- Queue-based background processing
- Observability: logs, metrics, and traces
- Backups with tested restoration workflows

## Security Considerations
- Zero-trust internal boundaries
- Token-based authentication with device binding
- Field-level encryption for sensitive identifiers

