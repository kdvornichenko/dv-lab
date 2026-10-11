# API Coverage — Google Calendar and OAuth

Phase 24 preparation. Decisions derive from CONTEXT D-01…D-12 and RESEARCH. This matrix closes GCAL-01/02/03/09/10 scope coverage before executable plans. It records planned capabilities; no runtime integration is claimed.

Source: [Calendar v3 reference](https://developers.google.com/workspace/calendar/api/v3/reference), inspected 2026-10-11, and [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server). All 38 Calendar methods listed by the reference are decided below. OAuth adds four protocol capabilities. Opt-outs preserve the accepted phase boundary.

| capability                  | decision  | reason                                                                            |
| --------------------------- | --------- | --------------------------------------------------------------------------------- |
| oauth.authorization         | INTEGRATE | GCAL-01; server state, PKCE, teacher session binding                              |
| oauth.codeExchange          | INTEGRATE | GCAL-01; fixed callback and verified granted scopes                               |
| oauth.refresh               | INTEGRATE | GCAL-01/09; encrypted credentials and coordinated refresh                         |
| oauth.revoke                | INTEGRATE | GCAL-09; disconnect preserves events and exposes failure                          |
| acl.delete                  | OPT-OUT   | Calendar access policy management is outside Phase 24                             |
| acl.get                     | OPT-OUT   | Resolved CalendarList accessRole is sufficient for the accepted target            |
| acl.insert                  | OPT-OUT   | No sharing or access grants in this phase                                         |
| acl.list                    | OPT-OUT   | No ACL editor or access audit in this phase                                       |
| acl.patch                   | OPT-OUT   | Calendar access policy management is outside Phase 24                             |
| acl.update                  | OPT-OUT   | Calendar access policy management is outside Phase 24                             |
| acl.watch                   | OPT-OUT   | No ACL monitoring; inbound synchronization belongs to Phase 25                    |
| calendarList.delete         | OPT-OUT   | Disconnect must not remove calendars from the user's list                         |
| calendarList.get            | OPT-OUT   | calendarList.list already resolves primary identity and accessRole                |
| calendarList.insert         | OPT-OUT   | Primary-only target; no calendar subscription feature                             |
| calendarList.list           | INTEGRATE | GCAL-01/09; resolve actual primary calendar identity and accessRole               |
| calendarList.patch          | OPT-OUT   | No remote calendar presentation changes                                           |
| calendarList.update         | OPT-OUT   | No remote calendar presentation changes                                           |
| calendarList.watch          | OPT-OUT   | Inbound monitoring belongs to Phase 25                                            |
| calendars.clear             | OPT-OUT   | Destructive calendar cleanup is explicitly outside scope                          |
| calendars.delete            | OPT-OUT   | Primary-only target; no remote calendar deletion                                  |
| calendars.get               | OPT-OUT   | Required target metadata comes from CalendarList                                  |
| calendars.insert            | OPT-OUT   | User accepted primary-only; no secondary calendar creation                        |
| calendars.patch             | OPT-OUT   | No calendar metadata editor                                                       |
| calendars.transferOwnership | OPT-OUT   | No Workspace administration or ownership transfer                                 |
| calendars.update            | OPT-OUT   | No calendar metadata editor                                                       |
| channels.stop               | OPT-OUT   | Watch-channel lifecycle belongs to Phase 25                                       |
| colors.get                  | OPT-OUT   | Application uses its accepted design tokens                                       |
| events.delete               | OPT-OUT   | Cancellation uses status through queued writes; disconnect retains remote history |
| events.get                  | INTEGRATE | GCAL-02/03; retry recovery, ownership checks and ETag                             |
| events.import               | OPT-OUT   | No external event import or private-copy feature                                  |
| events.insert               | INTEGRATE | GCAL-02/03; deterministic standalone and recurring-master IDs                     |
| events.instances            | INTEGRATE | GCAL-02; canonical occurrence IDs and complete pagination                         |
| events.list                 | INTEGRATE | GCAL-10; complete finite conflict windows and strict self-exclusion               |
| events.move                 | OPT-OUT   | Primary-only target; no organizer or calendar transfer                            |
| events.patch                | INTEGRATE | GCAL-02/03; queued conditional changes to masters, singles and instances          |
| events.quickAdd             | OPT-OUT   | Structured application schedule is authoritative for outbound payloads            |
| events.update               | OPT-OUT   | Conditional partial changes use events.patch; no full resource replacement        |
| events.watch                | OPT-OUT   | Push and incremental inbound synchronization belong to Phase 25                   |
| freebusy.query              | OPT-OUT   | Conflict UI needs event identity/details and paginated events.list                |
| settings.get                | OPT-OUT   | Default display and entry zones belong to Phase 21.1 application settings         |
| settings.list               | OPT-OUT   | No Google account-preference import                                               |
| settings.watch              | OPT-OUT   | No Google account-preference monitoring                                           |

Only `calendar.events` and `calendar.calendarlist.readonly` are requested. No identity, Gmail, Drive, broad calendar or administration scope is added. Recurring exceptions map a stable local key to Google's canonical instance ID; they do not create a second independent event. All Calendar writes use the single queued writer. OAuth exchange, refresh and revoke belong to the connection protocol owner.

Additional product capabilities remain explicitly excluded: attendees/invitations, Meet creation, attachments, inbound title matching, assign/ignore, Google-wins merging, syncToken/410 recovery and nightly inbound reconciliation. The Phase 25 capabilities retain their existing roadmap owner. Public `/welcome`, `/privacy` and `/terms` close SC6 locally and do not call Google.

Execution proof remains separate: real provider recurrence behavior, production publishing, credentials, deployment and refresh after eight days are not verified by this preparation matrix.

Verification: `node /Users/kdvornichenko/.codex/gsd-core/bin/gsd-tools.cjs check api-coverage.verify-pre .planning/phases/24-google-calendar-connection-and-outbound-sync`. Require `passed: true`, 42 decided rows, and a reason for every opt-out.
