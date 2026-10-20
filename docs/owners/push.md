# Push-уведомления: api, планировщик, web, service worker

Каналы push от Google (`events.watch`) — `calendar.md`.

## api

- Push — `apps/api/src/push`:
  - `subscriptions.ts` — подписки устройств, `activeSubscriptions`;
  - `presence.ts` — присутствие на экране, свежесть 90 с;
  - `scheduler.ts` — уведомления «скоро урок» по `readWindowBlocks` и «скоро платить» по взводу `push_payment_alerts`; запускается через `lifecycle.manage` в `server.ts`, при `NODE_ENV=test` не создаётся;
  - `deliver.ts` — отправка через `web-push`, отзыв подписки на 404 и 410. По умолчанию TTL 600 с и срочность normal; напоминание об уроке уходит с `urgency: 'high'` и TTL до начала урока (не меньше 60 с), иначе Android в Doze (FCM) держит его до пробуждения.
  - `assistant.ts` — push ассистента («Reply is ready», «Waiting for your decision»): окончание хода чата вызывает `createAssistantNotifier`, переключатель `teacher_settings.notify_assistant`, устройство со свежим сигналом присутствия пропускается, ссылка `/?chat=<id>` (`chatLink`), тела ответа в push нет.
- Маршруты `/push/config`, `/push/subscriptions`, `/push/presence` — `routes/push.ts`.
- `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, `PUSH_VAPID_SUBJECT` читает только `loadConfig`: все три или ни одной, без них push выключен.

## web

- Подписка, повторная подписка и присутствие — `apps/web/lib/push-client.ts`.
- Сигнал присутствия — `apps/web/app/(app)/_components/push-presence.tsx`.
- Карточки Settings — `apps/web/app/(app)/settings/_components/notifications-card.tsx`.
- Показ уведомления и переход по тапу — `apps/web/public/sw.js` (его запрос к api — исключение в `platform.md`).

## Приёмка

`scripts/dev-checks/`: api — `push-api.mjs` (`PUSH_API_OK`); браузер — `pwa-web.mjs`.
