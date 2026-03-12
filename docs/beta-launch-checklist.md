# TaxBook Beta Launch Checklist

## Beta Launch Checklist

- Confirm production environment variables are set from `webapp/.env.example`.
- Run `npm run lint`, `npm run build`, and `npm run seed:demo` in the deployment target.
- Verify signup, login, logout, session validation, and password reset/profile updates.
- Verify workspace creation, switching, renaming, archiving, and team invite acceptance.
- Verify invoice creation, payment-link generation, webhook confirmation, and income automation.
- Verify tax-record CRUD, import, categories, vendor fields, and report exports.
- Verify bank account creation, CSV import, reconciliation suggestions, and matching.
- Verify AI receipt scan and AI assistant return grounded responses with valid API keys.
- Verify billing page plan display and upgrade CTA copy even if Stripe is not yet configured.
- Verify landing, pricing, and features pages render without auth and route into signup.

## Deployment Checklist

- Set `DATABASE_PROVIDER=postgresql` and provide production `DATABASE_URL` and `DIRECT_URL`.
- Run Prisma migrations against PostgreSQL before the first production deploy.
- Configure `APP_URL` to the public HTTPS origin.
- Set `OPENAI_API_KEY` and any model overrides needed for AI routes.
- Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and plan price IDs before enabling checkout.
- Set `PAYMENT_WEBHOOK_SECRET` and disable stub payments in production unless intentionally needed.
- Configure secure cookie handling behind HTTPS and validate reverse-proxy headers.
- Seed a demo workspace only in non-production environments.
- Enable log collection for route errors and webhook failures.
- Back up the production database before schema changes and before launch weekend.

## Known Risks

- AI routes depend on third-party model availability and may degrade if OpenAI is slow or rate limited.
- Stripe checkout is scaffolded but still depends on external plan configuration and webhook delivery.
- Payment links are provider-agnostic stubs until a real gateway is connected.
- The Starter plan is intentionally capped and may need adjustment once real beta usage data arrives.
- Current reports are accurate for stored records, but VAT input/output is still inferred from `computedTax`.
- Demo data seeding uses fixed IDs for idempotency and should not be run in shared production databases.
