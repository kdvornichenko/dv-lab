# API Coverage — Google Calendar and OAuth

Подготовка Phase 24 по CONTEXT D-01…D-14 и актуальному [RESEARCH](24-RESEARCH.md). Матрица закрывает GCAL-01/02/03/09/10 и SC1–6. Google — источник событий; Schedule, Today upcoming и nextLessonAt используют общий confirmed read owner (C2). Runtime integration не проверена.

Источники: [READING](../../../docs/google-calendar/READING.md), [Discovery revision 20261005](../../../docs/google-calendar/calendar-v3.discovery.json) и [OAuth web-server flow](../../../docs/google-calendar/articles/related/identity/protocols/oauth2/web-server.md). Все 38 Calendar methods сопоставлены с Discovery; OAuth добавляет четыре capability.

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
| events.list                 | INTEGRATE | GCAL-01/02/10; complete Google windows, shared next index, conflicts and identity recovery               |
| events.move                 | OPT-OUT   | Primary-only target; no organizer or calendar transfer                            |
| events.patch                | INTEGRATE | GCAL-02/03; queued conditional changes to masters, singles and instances          |
| events.quickAdd             | OPT-OUT   | Commands use validated structured input; no natural-language quick-add            |
| events.update               | OPT-OUT   | Conditional partial changes use events.patch; no full resource replacement        |
| events.watch                | OPT-OUT   | Push and incremental inbound synchronization belong to Phase 25                   |
| freebusy.query              | OPT-OUT   | Conflict UI needs event identity/details and paginated events.list                |
| settings.get                | OPT-OUT   | Default display and entry zones belong to Phase 21.1 application settings         |
| settings.list               | OPT-OUT   | No Google account-preference import                                               |
| settings.watch              | OPT-OUT   | No Google account-preference monitoring                                           |

Only `calendar.events` and `calendar.calendarlist.readonly` are requested. No identity, Gmail, Drive, broad calendar or administration scope is added. Recurring exceptions map a stable local key to Google's canonical instance ID; they do not create a second independent event. All Calendar writes use the single queued writer. Journal acceptance returns pending; confirmed projection changes after Google acknowledgement. OAuth exchange, refresh and revoke belong to the connection protocol owner.

Обычные events.list reads и известные Google факты входят в Phase 24. Full window публикуется только после всех страниц; неполный next search даёт unknown. Первый connect читает Google и не экспортирует legacy future. External unmapped events остаются read-only; title matching отсутствует. No connection/outage блокирует новые Calendar edits; last-known snapshot честно помечен.

Исключены attendees/invitations, Meet creation, attachments, import/move calendar management. Phase 25 владеет постоянной доставкой внешних изменений, matching/Assign/Ignore, watch channels, syncToken/410 и nightly reconciliation. Это не исключает Google-authoritative чтение из Phase 24 и не разрешает перезаписывать Google старым local state.

Disconnect отзывает grant, сохраняет Google events/history/mappings/journal/cache и не является events.delete. Restore исчезнувшего cancelled single использует get/list access-and-absence proof, затем следующую journalled deterministic representation generation и insert. Instance restore остаётся canonical instance patch; arbitrary independent insert отсутствует.

OAuth scopes ровно прежние два; публикация /welcome/privacy/terms не вызывает Google API. Production, deployment, actual recurring/tombstone behavior и day-8 refresh остаются UNVERIFIED.

## Static verification

```sh
node /Users/kdvornichenko/.codex/gsd-core/bin/gsd-tools.cjs check api-coverage.verify-pre .planning/phases/24-google-calendar-connection-and-outbound-sync
```

Ожидается `passed: true`, 42 decided rows: 10 INTEGRATE (6 Calendar + 4 OAuth), 32 OPT-OUT, каждая с reason. Подробные fingerprints и статическая проверка ссылок/контракта — в RESEARCH. Этот check не доказывает runtime.

Результат 2026-10-11: exit 0; `passed=true`, `surface=42`, `integrate=10`, `optout=32`.
