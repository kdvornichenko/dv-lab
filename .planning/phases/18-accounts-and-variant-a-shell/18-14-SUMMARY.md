---
phase: 18-accounts-and-variant-a-shell
plan: 14
subsystem: ui
tags: [nextjs, base-ui, students, dialogs, toasts, change-password]

requires:
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-12: GET/POST /students, POST /students/:id/deactivate, POST /auth/change-password (204 и новая cookie)"
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-13: оболочка с сессией, меню аккаунта в SidebarUserFooter, requireTeacherPage, dev-учётные записи"
  - phase: 18-accounts-and-variant-a-shell
    provides: "18-17: ReadError, SkeletonTable, SkeletonText, статусы Banner"
provides:
  - "Экран Students: вкладки Active и Deactivated, таблица, счётчики, скелетон и одна ReadError при сбое чтения"
  - "CreateStudentDialog с однократным показом пароля, DeactivateStudentDialog, ChangePasswordDialog"
  - "ToastProvider и useToast() в AppShell"
  - "Пункт Change password в меню аккаунта (индекс 0, Sign out сдвинут на 1)"
affects: [18-15, 18-16]

actuals:
  tokens: 8950
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Диалоги монтируются родителем по условию (open всегда true внутри), поэтому состояние и сгенерированный пароль стираются размонтированием"
    - "Сбой чтения целого экрана заменяет всё под заголовком одной ReadError; диалоги остаются на стабильной позиции в дереве, чтобы показ пароля не терялся при смене состояния чтения"
    - "Рамка таблицы w-0 min-w-full: ScrollArea задаёт ширину по содержимому, без этого широкая таблица раздувает всю страницу"

key-files:
  created:
    - apps/web/app/(app)/students/_components/students-screen.tsx
    - apps/web/app/(app)/students/_components/create-student-dialog.tsx
    - apps/web/app/(app)/students/_components/deactivate-student-dialog.tsx
    - apps/web/app/(app)/_components/toasts.tsx
    - apps/web/app/(app)/_components/change-password-dialog.tsx
  modified:
    - apps/web/app/(app)/students/page.tsx
    - apps/web/app/(app)/_components/app-shell.tsx
    - apps/web/app/(app)/_components/app-sidebar.tsx
    - apps/web/components/app/layout-parts.tsx

key-decisions:
  - "Статус ученика: точка 8 px (span size-2 rounded-full с role img и aria-label) в Tooltip, область наведения расширена псевдоэлементом before:-inset-2; цветного текста и Badge нет"
  - "Состояния чтения: loading (настоящие заголовок, вкладки и кнопка, скелетон вместо данных), error (одна ReadError, без вкладок, кнопки и счётчиков), ready; Refresh из ReadError не переключает экран в loading, спиннер показывает сама кнопка"
  - "Валидация нового пароля в диалоге смены идёт через changePasswordRequest.shape.newPassword.safeParse, чисел 10 и 128 в диалоге нет; в диалоге создания длина проверяется через passwordLength и MANUAL_PASSWORD_*"
  - "Тост: обычный Banner status success в непрозрачной обёртке bg-background shadow-surface-3, область fixed с pointer-events-none"

patterns-established:
  - "Серверные коды ошибок диалога (login_taken, wrong_current_password, password_unchanged) превращаются в ошибки под нужным полем и сбрасываются при правке этого поля"

requirements-completed: [ACCT-02, ACCT-05, SHELL-02]

coverage:
  - id: D1
    description: "Учитель создаёт ученика на экране Students; пустой пароль даёт 12 символов и однократный показ в том же диалоге (Esc и клик снаружи не закрывают, крестик скрыт, фокус на I saved the password), пароль стирается после закрытия"
    requirement: ACCT-02
    verification:
      - kind: automated_ui
        ref: "playwright-core + Chromium 1243 против next dev и api из исходников: 18-14-t1.mjs, все проверки PASS в тёмном прогоне; в светлом одна проверка подсказки упала по таймингу скрипта (см. ниже)"
        status: pass
    human_judgment: true
    rationale: "Вид диалогов и таблицы проверен по скриншотам исполнителя, но принятие внешнего вида и проход настоящим браузером владельца остаются за 18-15"
  - id: D2
    description: "Свой пароль, ошибки формы (имя, логин, длина пароля, занятый логин, сбой), вкладки, деактивация с Keep account в фокусе, уведомления Account created и Account deactivated"
    requirement: ACCT-02
    verification:
      - kind: automated_ui
        ref: "18-14-t2.mjs: все проверки PASS, кроме ожидаемых записей консоли (оборванный GET и 409)"
        status: pass
    human_judgment: true
    rationale: "Анимации, внешний вид тоста и фактическое попадание деактивированного ученика на /login с двух устройств проверяются в 18-15"
  - id: D3
    description: "Change password из меню аккаунта: Wrong current password под первым полем, Passwords do not match., смена закрывает диалог с уведомлением Password changed, перезагрузка оставляет учителя в оболочке"
    requirement: ACCT-05
    verification:
      - kind: automated_ui
        ref: "18-14-t3.mjs: все проверки PASS (смена на временный пароль и возврат на DEV_TEACHER_PASSWORD, затем вход оригинальным паролем 200)"
        status: pass
    human_judgment: true
    rationale: "Закрытие других сессий и второе окно проверяются в 18-15"
  - id: D4
    description: "Скелетон при чтении и одна ReadError при сбое чтения (заголовок остаётся, вкладок, кнопки и счётчиков нет, Refresh перечитывает без перезагрузки страницы)"
    requirement: SHELL-02
    verification:
      - kind: automated_ui
        ref: "18-14-t2.mjs: задержка GET /api/students (6 полос скелетона, 2 вкладки, кнопка) и обрыв GET (ReadError), затем Refresh"
        status: pass
    human_judgment: true
    rationale: "Рецепт мёртвого порта для /api при живом api остаётся в 18-15, здесь отказ имитирован перехватом запроса браузером"

duration: 120min
completed: 2026-10-09
status: complete
plan_head_before: 777d94882fe72e47cf67fbf6f2d43fb4e8749c64
plan_head_after: be5ede03e1ce703bae20c7f17338ff6cebf11268
commits: 3
---

# Phase 18 Plan 14: Экран Students и смена пароля Summary

**Экран Students со вкладками Active и Deactivated, таблицей со статусом-точкой 8 px, скелетоном и одной ReadError при сбое чтения; создание ученика с однократным показом пароля, деактивация с Keep account в фокусе, уведомления и диалог Change password в меню аккаунта рядом с Sign out.**

## Performance

- **Duration:** около 2 часов
- **Tasks:** 3 (трассер и две обычные)
- **Files modified:** 9 (5 создано, 4 изменено)

## Accomplishments

- `students-screen.tsx`: три состояния чтения; заголовок, вкладки и кнопка Create student account настоящие во время загрузки, данные заменены `SkeletonText` и `SkeletonTable`; сбой чтения заменяет всё под заголовком одной `ReadError screen="students"` (после создания и деактивации перечитывание тоже даёт её); таблица Student, Login, Status (точка с подсказкой), Created (`en-US`, `dateStyle: medium`), у активных ghost-кнопка Deactivate с `aria-label`; деактивированные: имя `text-muted-foreground`, серая точка, без кнопки; пустая вкладка показывает `EmptyLine`.
- `create-student-dialog.tsx`: поля Name, Login, Password с проверкой при отправке и при уходе с тронутого поля, фокус на первое неверное поле, 409 `login_taken` под логином, прочий сбой баннером; пустой пароль уходит как отсутствующий; ответ с `generatedPassword` переводит тот же диалог в показ (крестик скрыт, Esc и клик снаружи игнорируются, строки Login и Password, Copy password с Copied на 2 секунды и скрытым `role=status`, фокус на I saved the password); свой пароль закрывает диалог и показывает тост.
- `deactivate-student-dialog.tsx`: Keep account (фокус) и Deactivate account (`tertiary text-destructive`), баннер при сбое.
- `toasts.tsx`: `ToastProvider` и `useToast().show`, автоскрытие через 4 секунды, таймеры очищаются при размонтировании; подключён в `app-shell.tsx`.
- `change-password-dialog.tsx`: три `PasswordField`, проверка по порядку (обязательность, длина по контракту, совпадение с текущим, подтверждение), серверные `wrong_current_password` и `password_unchanged` под своими полями, успех: тост, закрытие, `router.refresh()`.
- `app-sidebar.tsx`: пункт Change password (`KeyRound`) с индексом 0 перед Sign out (индекс 1), диалог открывается из состояния `AppSidebar`.

## Task Commits

1. **Задача 1 (трассер): экран Students, создание ученика и показ пароля** - `31d34ad` (feat)
2. **Задача 2: вкладки, проверка формы, деактивация, уведомления** - `ed8d0d8` (feat)
3. **Задача 3: смена пароля из меню аккаунта** - `be5ede0` (feat)

`commits: 3` измерено `git rev-list --count 777d948..HEAD` до коммита этого файла; параллельных планов в волне не было.

## Результаты проверок

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web typecheck` | чисто после каждой задачи и в конце |
| `yarn workspace @dv-lab/web lint` | 0 ошибок после каждой задачи и в конце |
| `yarn workspace @dv-lab/web build` | успешно (`/students` динамический), выполнен после остановки dev-серверов |
| `yarn prettier --check` для `apps/web/app/(app)` и `layout-parts.tsx` | чисто |
| `scratchpad/18-14-checks.sh 3` (`<automated>` всех трёх задач одним скриптом: requireTeacherPage, ReadError, SkeletonTable, `screen="students"`, нет собственного текста ошибки загрузки, нет кириллицы, нет Radix и cmdk, нет комментариев, нет localStorage и sessionStorage, тексты UI-SPEC, нет Badge, контракт длины пароля, нет литералов 10 и 128 в сравнении длины) | 16 из 16 PASS |

### Браузерные проверки (headless Chromium из кеша playwright, `playwright-core` по абсолютному пути, dev-стек: `yarn workspace @dv-lab/api dev` на 4000 и `next dev` на 3000, вход dev-учителем через настоящую форму)

- `18-14-t1.mjs` (светлая и тёмная тема; в первом светлом прогоне проверка подсказки Active упала из-за моего ожидания в скрипте раньше 200 мс задержки подсказки, в тёмном прогоне и в `t2` для Deactivated подсказка подтверждена): заголовок, счётчики и кнопка; фокус на Name; создание без пароля даёт показ с паролем из 12 символов; фокус на I saved the password; крестика нет; Esc и клик снаружи не закрывают; Copy password меняется на Copied и буфер содержит пароль; после закрытия пароля нет в тексте страницы; строка с зелёной точкой 8x8, дата сегодняшняя; повторное открытие диалога пустое; консоль без ошибок и предупреждений.
- `18-14-t2.mjs` (светлая и тёмная): скелетон (1 строка описания и 5 строк таблицы), две вкладки и кнопка при отложенном GET; обрыв GET даёт заголовок и одну ReadError без вкладок, кнопки и счётчиков; Refresh возвращает список без перезагрузки страницы; пустое имя, неверный логин, короткий пароль; свой пароль: диалог закрыт, тост Account created, строка появилась, тост исчез за 4 секунды; повтор логина в другом регистре: This login is already taken. под полем, значения сохранены; Deactivate: фокус на Keep account, Keep account оставляет строку, Deactivate account даёт тост Account deactivated, строка уходит в Deactivated с серой точкой (aria-label, подсказка) и без кнопки, счётчик 1 deactivated; ширина 320: страница и область прокрутки без горизонтальной прокрутки, таблица прокручивается внутри рамки.
- `18-14-t3.mjs` (светлая и тёмная): меню аккаунта содержит Change password и Sign out в этом порядке; фокус в диалоге на Current password; неверный текущий пароль: Wrong current password под первым полем; короткий новый, несовпадающее подтверждение и совпадение с текущим дают свои сообщения; успех: диалог закрыт, тост Password changed, перезагрузка оставляет в оболочке; пароль возвращён вторым проходом через диалог, вход оригинальным паролем даёт 200 (пароли в вывод не попадали). В тёмном прогоне одна проверка меню поймала открывающуюся анимацию (скриншот сделан в момент появления), остальные PASS; светлый прогон прошёл целиком.
- Все созданные тестовые ученики (`v1814%`) удалены в конце каждого прогона. Использован только `18-sql.mjs` на `dvlab_dev`.
- Dev-серверы остановлены, слушателей на 3000 и 4000 нет, `apps/web/AGENTS.md` удалён и не коммитился.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `<div>` внутри `<p>` в описании PageHeader при загрузке**
- **Found during:** задача 1, до записи кода
- **Issue:** `PageHeader` оборачивал описание в `<p>`, а `SkeletonText` рисует `<div>`; состояние загрузки рисуется на сервере, HTML-парсер закрыл бы `<p>`, дерево разошлось бы с React (гидрационная ошибка).
- **Fix:** в `apps/web/components/app/layout-parts.tsx` обёртка описания заменена с `<p>` на `<div>` с теми же классами (файл вне `files_modified`, но других плана-исполнителей в волне нет; стили и вид прежние).
- **Files modified:** apps/web/components/app/layout-parts.tsx
- **Commit:** 31d34ad

**2. [Rule 1 - Bug] Широкая таблица раздувала страницу на узких экранах**
- **Found during:** задача 2, проверка на 320 px
- **Issue:** `ScrollArea` задаёт ширину содержимого по самому широкому ребёнку; таблица в 541 px растягивала всю страницу, заголовок обрезался.
- **Fix:** у рамки таблицы класс `w-0 min-w-full`: рамка перестаёт участвовать в подсчёте внутренней ширины и прокручивается внутри.
- **Files modified:** students-screen.tsx
- **Commit:** ed8d0d8

**3. [Rule 2 - Missing] Дополнительные тексты вне UI-SPEC**
- Current password пустой: Enter your current password. (аналог Enter your password. на входе); имя длиннее 80 кодовых точек: Use 80 characters or fewer. (граница из контракта, иначе только общий баннер сервера). Владелец тексты не утверждал.

### Прочее

- Организационное: действия задач заканчиваются «Не коммитить», а общие правила фазы 18 требуют коммит на задачу; коммиты сделаны с явными путями.
- Плановые `<automated>` с `&&` и `!` хук изоляции отклоняет: все проверки собраны в `18-14-checks.sh`, typecheck, lint, build запускались отдельно.
- Область точки статуса: ширина наведения расширена `before:-inset-2`, чтобы подсказка работала при наведении на 8-пиксельную точку (в плане только размер и aria-label).
- Тост рисуется в непрозрачной обёртке `bg-background shadow-surface-3`: заливка статусов Banner 14% прозрачна и просвечивала бы таблицу.

**Total deviations:** 2 исправления дефектов, 1 добавление копирайта, 3 организационных. Влияние: один файл вне `files_modified` (`layout-parts.tsx`, замена тега).

## Not verified in a browser

Проверки выше сделаны управляемым headless Chromium (DOM, вычисленные стили, скриншоты просмотрены исполнителем); настоящий браузер владельца не использовался. Оркестратору в 18-15:

1. Рецепт отказа «мёртвый порт для /api при живом api»: ReadError на Students настоящим сетевым сбоем, спиннер Refresh, возврат списка. Здесь сбой имитирован `route.abort()`.
2. Второе окно: ученик, деактивированный учителем, на следующем запросе попадает на `/login?reason=expired`; смена пароля учителя закрывает другие сессии (проверка с двух клиентов).
3. Глазами в обеих темах и на 320 и 768 px: таблица, статус-точки (контраст серой и зелёной), подсказки, тост (непрозрачность и положение сверху на телефоне `top-14`), показ пароля, диалоги, меню аккаунта с двумя пунктами; анимации появления и закрытия диалогов и баннера.
4. Копирование пароля реальной кнопкой в не-localhost origin (Clipboard API требует безопасного контекста; в проверке выдано разрешение на localhost).
5. Блокировка: пять неверных текущих паролей в диалоге смены закрывают вход учителя с адреса на 15 минут (общий счётчик с входом, 18-12). Здесь использована одна ошибка.
6. Фокус после открытия диалога из выпадающего меню в прогонах дошёл до Current password, но в реальном браузере стоит проверить, что меню не перехватывает его при возврате фокуса на триггер.
7. Тексты Enter your current password. и Use 80 characters or fewer. владелец не подтверждал.

## Known Stubs

Нет.

## Threat Flags

Нет новых поверхностей сверх threat_model плана. T-18-50: сгенерированный пароль живёт только в состоянии диалога показа (размонтируется при закрытии), не пишется в localStorage, sessionStorage и URL (grep в `18-14-checks.sh` и проверка отсутствия пароля в тексте страницы после закрытия PASS), Esc и клик снаружи не закрывают; сервер проверяет те же схемы заново (T-18-51 принято).

## Issues Encountered

- Заметка для 18-15: при запросе меню аккаунта снимок сразу после клика может застать анимацию открытия (в тёмном прогоне `t3` это дало одну ложную проверку), в светлом прогоне и по скриншоту светлой темы меню корректно.

## Self-Check: PASSED

- Файлы на диске: students-screen.tsx, create-student-dialog.tsx, deactivate-student-dialog.tsx, toasts.tsx, change-password-dialog.tsx.
- Коммиты `31d34ad`, `ed8d0d8`, `be5ede0` есть в `git log`.
- typecheck, lint, build, prettier и `18-14-checks.sh 3` зелёные; слушателей на 3000 и 4000 нет; `apps/web/AGENTS.md` удалён. Не запускались: `yarn test`, `yarn knip` (до 18-16 красный).

---
*Phase: 18-accounts-and-variant-a-shell*
*Completed: 2026-10-09*
