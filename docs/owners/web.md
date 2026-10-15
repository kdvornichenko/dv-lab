# web: UI, экраны, даты и зоны, мутации, точки входа

## Правила UI

- UI web — только Base UI и копия компонентов варианта A (`components/ui`, `components/sidebar-app`, `components/fluid-hover-highlight.tsx`, `hooks`, двенадцать файлов `lib`; knip не проверяет `components/ui` и файлы `lib` копии, в которых есть неиспользуемые экспорты: `icon-context.tsx`, `shape-context.tsx`, `size-context.tsx`, `surface-classes.ts`). Импорты `radix-ui`, `@radix-ui/*` и `cmdk` запрещены правилом ESLint. Рукописные части экранов лежат в `apps/web/components/app` и `apps/web/app`.
- Шрифты Inter Variable и JetBrains Mono Variable из пакетов `@fontsource-variable/inter` и `@fontsource-variable/jetbrains-mono`, без обращения к Google.
- Дизайн расписания — артефакт дизайн-системы (WeekGrid, ScheduleToolbar, EventColors, EventTooltip, LessonDialog); блок урока и события носит цвет события Google (`eventPaint` из `apps/web/lib/event-colors.ts`), токен `selected` только у блока без цвета Google.
- Жесты сетки недели — `apps/web/app/(app)/schedule/_components/`: протяжка новой рамки `use-slot-drag.ts`, перенос блока `use-lesson-drag.ts`, растяжение за нижний край `use-event-resize.ts` (только мышь), свайп недели `use-week-pager.ts`. На touch протяжка и перенос начинаются долгим нажатием (`HOLD_MS` в `use-touch-hold.ts`); до него сдвиг пальца — прокрутка или свайп. Перенос, задержанный у левого или правого края колонок, листает неделю (`TURN_MS`), рамка переживает смену недели. Первое открытие текущей недели ставит текущее время в середину сетки. Проверка — `scripts/dev-checks/schedule-touch-web.mjs`.
- Предзагрузка расписания: `use-schedule-week.ts` читает недели на 4 вперёд и назад от показанной (ближние первыми), свежесть кэша недели 5 минут, смена ревизии синхронизации сбрасывает кэш. `schedule-prefetch.ts` держит кэш деталей событий (`/google/events/:key` по версии), комментариев начавшихся уроков и палитры; `useSchedulePrefetch` грузит их в фоне для показанной недели: сегодняшние события, затем уроки с текущего момента, затем остальные, ближние ко «сейчас» первыми. Диалоги показывают кэш сразу и обновляют его запросом в фоне. Список учеников формы грузится вместе с неделей. Открытие недели не ждёт других запросов: пояс берётся из прошлого ответа (`localStorage`, по умолчанию `SCHEDULE_TIME_ZONE`), проверка сессии — счётчик `sessionEpoch` в `api-client.ts` вместо `/auth/me`. Текущая и соседние недели лежат копией на устройстве (`apps/web/lib/device-store.ts`, IndexedDB `dvlab-device`): расписание открывается с неё только для чтения, свежий ответ приходит в фоне; выход из аккаунта очищает копию.
- Диалоги расписания New lesson, урока календаря, события календаря и Count lessons грузятся отдельными чанками через `lazy-dialogs.tsx` (кнопка Count lessons остаётся в первом чанке); `useScheduleDialogsPreload` в `schedule-screen.tsx` загружает их в простое после первого показа недели (свежей или копии с устройства), и загруженный диалог открывается без Suspense. Сетка, подсказка и блок берут название, время и статус события из `event-summary.tsx`, а не из `calendar-event-details.tsx`.

## Общие компоненты

- Страницы 404 и ошибки — `apps/web/components/app/status-pages.tsx`; корневые `not-found.tsx`, `error.tsx` и `global-error.tsx` только вызывают их. Ошибка чтения целого экрана — `apps/web/components/app/read-error.tsx`. Ошибка чтения вкладки профиля — `apps/web/components/app/records-unread.tsx`. Скелетоны — `apps/web/components/ui/skeleton.tsx`.
- Вид markdown в web — `apps/web/components/app/markdown-view.tsx` (`react-markdown` со `skipHtml`).
- Строки денег, уроков и дат оплат — `apps/web/components/app/ledger-text.tsx` поверх `packages/core`. Остаток и долг — `apps/web/components/app/student-balance.tsx` поверх core.
- Затухание скроллеров без поддержки CSS — `apps/web/components/app/scroll-fade-fallback.tsx`.
- Строка конфликта ревизии в формах — `apps/web/components/app/reload-notice.tsx`.
- Уведомление о новой версии (UpdateNotice) — `apps/web/app/(app)/_components/version-watch.tsx` (`VersionWatch`, у учителя и ученика): при открытии, возврате на вкладку и раз в 10 минут сверяет `sha` из `GET /healthz` с `GIT_SHA` сервера web, который передаёт `(app)/layout.tsx`. Закрытое уведомление возвращается только при возврате на вкладку или с более новой версией. Сама страница не перезагружается; Reload при набранном и не отправленном тексте (поля, в которые печатали с загрузки страницы и где остался текст) спрашивает подтверждение. Вне `(app)` (вход) проверки нет. Без версии (`unknown`, локальная разработка) проверка выключена.

## Даты и зоны

- Показ дат расписания — `apps/web/lib/schedule-format.ts` (`Intl` с явной зоной).
- Список зон, сокращения меток (`zoneLabel`) и поиск — `apps/web/lib/time-zones.ts`.
- Второй пояс и избранные зоны — `apps/web/components/app/time-zone-picker.tsx` (`TimeZonePicker`), хранение только в `localStorage`. Время урока во второй зоне показывает `apps/web/components/app/time-pair.tsx`.

## Мутации и обновление экранов

- Мутации расписания — `mutate`, мутация отметки — `markLesson` из `apps/web/app/(app)/schedule/_components/schedule-mutations.ts`; доступность отметки задаёт `actions.mark` блока.
- Общий хост диалогов урока для расписания и Today — `apps/web/app/(app)/schedule/_components/lesson-dialogs.tsx` (`LessonDialogs`). Слова статуса, слот блока и подписи отметок — `apps/web/lib/lesson-mark-text.ts`.
- Обновление экранов после записи — канал `dvlab:data-changed` в `apps/web/lib/api-client.ts` и `refreshReaders` в `apps/web/components/app/calendar-command-provider.tsx`.

## Экраны и точки входа

- Экран Today — `apps/web/app/(app)/_components`; минутное `now` — `use-minute-now.ts` (`useMinuteNow`), счётчики — `todayCounts` из core.
- Settings → General — `apps/web/app/(app)/settings`: порог Pays soon и второй пояс.
- Представление списка Students — `apps/web/app/(app)/students/_components/students-view.ts`.
- Вкладка Lessons профиля — `apps/web/app/(app)/students/[id]/_components/lessons-tab.tsx`, поверх `GET /students/:id/lessons`.
- Палитра команд — `apps/web/app/(app)/_components/command-palette.tsx` (группы Actions, Students, Screens).
- Прибытия по адресу: `/?dialog=payment` (форма Add payment на Today), `/chat?new=1&student=<id>` (новый разговор с черновиком `@Имя`), `/students/<id>?tab=lessons|payments&payment=<id>` (разбор — `apps/web/app/(app)/students/[id]/_components/profile-arrival.ts`).
