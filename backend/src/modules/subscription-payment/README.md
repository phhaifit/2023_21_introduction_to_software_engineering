# Subscription & Payment Module

Owner: Member 2

Future feature spec: create a dedicated per-module OpenSpec change before implementing this module.

Foundation reference: see `docs/module-ownership.md`.

Boundary:

- Own plans, subscriptions, transactions, payment callbacks, and upgrade events.
- Publish entitlement changes through shared domain events.
- Do not provision OpenClaw runtimes directly; request workspace/runtime changes through contracts.
