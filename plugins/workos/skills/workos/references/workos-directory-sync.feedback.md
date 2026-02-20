# Feedback for workos-directory-sync

## Corrections

- WorkOS supports both webhooks AND the Events API for directory sync.
  Do not claim webhooks are mandatory or that polling is not supported.
- The Events API (workos.events.listEvents()) is a valid alternative
  for batch processing, data reconciliation, or recovering missed events.
- Webhooks are recommended (real-time, push-based), but not required.

## Emphasis

- The dsync.deleted event does NOT trigger individual user/group delete
  events. This is a common trap — emphasize it.
