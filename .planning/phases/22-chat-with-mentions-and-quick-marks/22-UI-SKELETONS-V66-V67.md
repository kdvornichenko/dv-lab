# Скелетоны Schedule (дизайн v66) и кроссфейд скелетон → контент (дизайн v67)

Работа вне плана фазы 22, в той же ветке. Дизайн: `~/dv-lab-design` (VERSION v68), компоненты WeekGridStates, SkeletonSwap, Skeleton, motion.md правило 15. v68 (таблицы, вкладка со счётчиком, Today) не делалось: ждёт решений дизайна v69.

## Коммиты

- `61d25b2` ui(skeletons): кроссфейд скелетона в контент через ViewTransition на границах loading.tsx (v67).
- `c4f6dd1` ui(skeletons): скелетон Schedule: настоящая сетка недели с блоками-заглушками уроков (v66).

## v67: что сделано

- `apps/web/components/app/skeleton-swap.tsx`: `SkeletonFallback` (`ViewTransition exit="skeleton-exit" default="none"`) и `SkeletonContent` (`ViewTransition enter="content-enter" default="none"`). Без `name`, поэтому общего имени у fallback и контента нет.
- `apps/web/app/globals.css`: CSS из README SkeletonSwap (`swap-out` 120 мс, `swap-in` 160 мс, `ease-out`, `animation: none` при `prefers-reduced-motion: reduce`). Добавлено одно правило сверх README: `::view-transition { pointer-events: none }`. Причина: README требует, чтобы контент был кликабельным с первого кадра, а оверлей view transition перехватывает клики (совет из `view-transitions.md` Next). Названные участники при этом всё равно не принимают клики на время анимации (160 мс).
- Флаг в `next.config.ts` не нужен: `node_modules/next/dist/docs/01-app/02-guides/view-transitions.md` говорит, что в App Router ViewTransition работает без настройки (React 19.3.0, Next 16.4.0); в `config-shared.d.ts` флага `viewTransition` нет. `next.config.ts` не тронут (в рабочем дереве остаётся только локальная правка владельца).
- Fallback: `apps/web/app/(app)/loading.tsx` обёрнут в `SkeletonFallback`. Его же реэкспортируют `settings/loading.tsx`, `students/loading.tsx`, `students/[id]/loading.tsx`, `chat/loading.tsx` (файл чата не трогал) и `login/loading.tsx`, а также импортируют как fallback `app/layout.tsx` и `app/(app)/layout.tsx`. `schedule/loading.tsx` теперь свой (см. v66), тоже в `SkeletonFallback`.
- Контент: `SkeletonContent` обёрнут вокруг экрана в `page.tsx` для Today, Schedule, Students, профиля ученика и Settings. Страницу чата не менял (путь запрещён заданием): у неё fallback с exit есть, enter на контенте нет.

## v66: что сделано

- Скелетон загрузки недели теперь настоящий `WeekGrid` без событий: рамка, названия и даты дней, гаттер, линии часов, подсвеченная колонка сегодня, линия «сейчас» рисуются из того же кода, что и загруженная неделя, поэтому совпадают по размеру. У `WeekGrid` новый необязательный проп `placeholders` (`GridPlaceholder`: день, начало в минутах от начала сетки, длительность); блоки рисуются `Skeleton` с `rounded-md`, цветом hover и шиммером, без текста, с теми же отступами и высотой `минуты * MINUTE_HEIGHT - 2`, что и настоящие блоки. 8 блоков на 6 днях (по одному-два в день), позиции перенесены из preview дизайна (10:00, 9:30 на 1,5 ч, 13:00, 14:00, 11:00, 13:00 на 1,5 ч, 10:00, 12:00).
- Тулбар в загрузке настоящий: `ScheduleBar` (кнопка недели, стрелки, Today), иконка подсчёта уроков, место под кнопку статуса. Сводка уроков не рисуется (`summary={null}`). Слот уведомления зарезервирован и пуст (`NOTICE_SLOT`), сетка держит высоту (`min-h-90 flex-1`, как в загруженной).
- Заголовка «Schedule» нет: убран `PageHeader title="Schedule"`. Таблица из десяти строк (`SkeletonTable`) и `MOBILE_FRAME` удалены.
- `use-schedule-week.ts`: настройка основной зоны (`bootstrap`) теперь сразу публикует `query` (`kind: 'loading'`, `data: null`), чтобы экран с первой загрузки шёл по пути «неделя известна» с настоящим тулбаром и сеткой в нужной зоне, а не по пути «ничего не известно». Остальная логика хука не менялась. Неделя, у которой уже есть данные (та же неделя, перечитывание), остаётся на экране с `aria-busy` и без скелетона: так было и раньше (`start()` сохраняет `previous.data` при совпадении запроса, `windowAttributes['aria-busy']`), не менял.
- Новый `schedule/_components/schedule-loading.tsx`: `ScheduleLoading` для состояний, когда недели ещё нет (`schedule/loading.tsx`, гидратация, ожидание настроек). Использует `SCHEDULE_TIME_ZONE` как предположение для дат и «сегодня». Сюда же вынесены `NOTICE_SLOT`, `WORKSPACE_BODY`, `useLaptop`, `LOADING_BLOCKS`.

## Не проверено в браузере (браузерные проверки не выполнялись: на портах 3000 и 4000 стенд владельца)

- Что скелетон Schedule совпадает по пикселям с загруженной неделей (высота рамки, шапка дней, положение блоков) в светлой и тёмной темах.
- Видимость блоков-заглушек: сетка открывается прокруткой на 07:00 (`OPEN_SCROLL_TOP`), блоки лежат с 09:30 до 15:00; на низком экране нижние блоки могут быть ниже сгиба.
- Работа ViewTransition вообще: что fallback `loading.tsx` уходит за 120 мс, а страница входит за 160 мс; что при reduced motion подмена мгновенная.
- Риск (по семантике React): `enter` срабатывает при любом монтировании границы внутри transition, а навигация Next и есть transition. Значит, переход на уже закэшированный раздел (без показа `loading.tsx`, `staleTimes.dynamic: 300`) может плавно проявить страницу за 160 мс, хотя дизайн требует мгновенного появления. Если подтвердится: убрать `SkeletonContent` со страниц и оставить только `SkeletonFallback` (fallback всё равно гаснет).
- Анимируется ли первое потоковое раскрытие Suspense после жёсткой загрузки (по дизайну не должно).
- Переход настоящего тулбара из `ScheduleLoading` (portal в верхнюю панель) в `ScheduleBar` экрана: это разные экземпляры, возможна одна перерисовка кнопок.
- Работа `LessonCountDialog iconOnly` в `ScheduleLoading` (смонтирован дважды подряд: в загрузке и в экране).
- На широком экране до гидратации (серверный HTML) дат ещё нет: показывается только пустая рамка, строки дней и даты появляются сразу после гидратации.

## Места скелетонов, не охваченные ViewTransition (рисуются условием)

Скелетон выбирается условием, а не границей Suspense или `loading.tsx`, поэтому ViewTransition на них не сработает; не переписывал, как просили. Чтобы такие места анимировались, нужен `startTransition` вокруг `setState` в их хуках с обёрткой `ViewTransition` на скелетоне и контенте (и тогда придётся отдельно следить, чтобы перечитывание данных не затевало fade).

- Schedule: подмена блоков-заглушек на настоящие события внутри `WeekGrid` (`loadingFirst` в `schedule-screen.tsx`). Это главный переход Schedule, и он остаётся мгновенным. На входе экран проходит fallback `loading.tsx` → страница, это кроссфейд двух почти одинаковых рамок.
- Students: `students-screen.tsx` (сводка `loading ? <SkeletonText>`, три `SkeletonTable` во вкладках), `unassigned-payments.tsx`.
- Профиль ученика: `student-profile.tsx` (`SkeletonProfileHeader`, карточки), `payments-tab.tsx`, `vocabulary-tab.tsx`, `notes-tab.tsx`, `note-entries.tsx`.
- Today: `today-screen.tsx` (`SkeletonStat`, `SkeletonRows`, `SkeletonText` в описании).
- Настройки: `calendar-card.tsx` (`ConnectionSkeleton` и строка статуса), `assistant-card.tsx` (`BudgetSkeleton`).
- Схема Schedule: `lesson-count-dialog.tsx`, `lesson-comments.tsx`; `components/app/time-zone-picker.tsx`.
- Чат (файлы не трогал): `chat-screen.tsx`, `conversation-list.tsx`, `student-facts.tsx`, `mention-popup.tsx`.
- Границы Suspense верхнего уровня `app/layout.tsx` и `app/(app)/layout.tsx` получили fallback с exit, потому что используют общий `Loading`. Они работают до оболочки (сайдбар, верхняя панель) и при первой отрисовке, где по дизайну ничего не анимируется; на практике эффекта не ожидается. Сама оболочка в transition не входит.

## Вопросы к дизайну

- Узкие экраны (до `lg`): сетка скрыта, вместо неё список по дням (`CalendarAgenda`). В загрузке он пуст, блоки-заглушки там не рисуются; скелета повестки в дизайне нет (preview только для сетки), своё не придумывал.
- Правая часть верхней панели в `ScheduleLoading` (пока зона не известна): без выбора второй зоны и без кнопки статуса; в экране после публикации `query` выбор зоны уже есть. Если нужен точный состав справа и в самом раннем кадре, нужен ответ дизайна.
- Гаттер в самом раннем кадре (`ScheduleLoading`): подпись зоны и вторая зона не рисуются, потому что вторая зона привязана к основной из настроек, а запись в localStorage при неверном предположении испортила бы выбор пользователя (`useSecondZone` перезаписывает значение при несовпадении). Вторая зона появляется, когда `query` опубликован.

## Проверки

- `yarn workspace @dv-lab/web typecheck`: чисто.
- `yarn workspace @dv-lab/web lint`: чисто (ловили `react-hooks/set-state-in-effect`; публикация `query` перенесена в колбэк `.then` после `bootstrap`).
- `prettier --check` по всем изменённым файлам: чисто.
- `node scripts/hygiene-check.mjs`: clean.
- `yarn knip`: код 1 из-за чужой работы в чате (`apps/api/src/chat/provider.ts`, `publish-gate.ts`, `tools.ts` не используются; неиспользуемые экспорты `isActive`, `readTurn`, `insertTurn` в `chat/turns.ts` и `listStudentComments` в `schedule/comments.ts`). По изменённым мной файлам замечаний нет.
