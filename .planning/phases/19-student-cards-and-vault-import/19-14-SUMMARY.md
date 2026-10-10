---
phase: 19-student-cards-and-vault-import
plan: 14
subsystem: ui
status: complete
tags: [students, profile, opening-balance, archive, confirm-dialog, base-ui, lessons]
requires:
  - phase: 19-06
    provides: DateField, StatusDot, Select, Combobox, apiRequest с PUT
  - phase: 19-07
    provides: GET /students/:id, POST archive и restore, PUT opening-balance
  - phase: 19-11
    provides: StudentFormDialog (режим edit), MoneyText, LessonsText
provides:
  - страница профиля /students/[id] со вкладкой Overview
  - панели Details и Opening balance
  - архивирование и восстановление карточки из шапки
  - ConfirmDialog для 19-16 и 19-17
affects: [19-16, 19-17, 19-18, 19-19]
actuals:
  tokens: 5000
  tasks: 3
  commits: 3
plan_head_before: 0d12958c73131a6dc1be9cf0de3e362a5301d44f
plan_head_after: 0edc7e6878b71648e28ed66c6f865e036d3edf70
tech-stack:
  added: []
  patterns:
    - "профиль перечитывается с api после каждой мутации, оптимистичного состояния нет"
    - "поля панели сбрасываются на сохранённые значения, когда меняется ключ из остатка, даты и длины урока (перенастройка состояния при рендере, без эффекта)"
    - "ConfirmDialog сам закрывается через onClose, когда onConfirm вернул true, и показывает Banner при false"
key-files:
  created:
    - apps/web/app/(app)/students/[id]/page.tsx
    - apps/web/app/(app)/students/[id]/_components/student-profile.tsx
    - apps/web/app/(app)/students/[id]/_components/overview-tab.tsx
    - apps/web/app/(app)/students/[id]/_components/opening-balance-panel.tsx
    - apps/web/components/app/confirm-dialog.tsx
  modified:
    - apps/web/components/app/date-field.tsx
key-decisions:
  - "Профиль и страница 404: api 404 даёт NotFoundPage inShell, невалидный uuid отсекает page.tsx через notFound() после requireTeacherPage"
  - "Длинные значения переносятся классом wrap-anywhere, а не break-words: break-words не уменьшает минимальную ширину содержимого, и ScrollArea растягивался по неразрывной строке"
  - "Поле As of без ошибки «Choose a date.»: DateField не позволяет очистить дату, ветка была бы недостижимой"
requirements-completed: [CARD-01, LEDG-02, LEDG-09]
completed: 2026-10-10
duration: 70min
---

# Phase 19 Plan 14: Профиль карточки Summary

**Страница `/students/[id]` показывает шапку со статусом, ставкой и остатком в уроках, панели Details (с правкой) и Opening balance (ввод открывающего остатка), архивирование и восстановление через ConfirmDialog с фокусом на безопасной кнопке.**

## Что сделано

- `page.tsx`: `requireTeacherPage()` первым, `params` как Promise, невалидный uuid ведёт на `notFound()`.
- `student-profile.tsx`: `StudentProfile({ id })`; состояния загрузки (скелетон шапки и панелей, вкладка неактивна), сбоя (кнопка Students и один `ReadError screen="student"` с Refresh), api 404 (`NotFoundPage inShell`), готово. Шапка: Avatar и имя в `h1`, строка со статусом (точка и подпись Active или Archived), «{сумма} / lesson» или No rate, «{n} lessons left» или кнопка Set opening balance (ставит фокус в поле Lessons left). Вкладки `aria-label` «Student sections», сейчас одна Overview. Действия шапки: Archive или Restore (Record payment добавит 19-16).
- `overview-tab.tsx`: сетка из двух колонок; слева Details (Rate, Lesson length, Parent, Level, Goals, Time zone; пустое — приглушённое «Not set», пояс — «Same as teacher») с действием Edit details, которое открывает `StudentFormDialog mode="edit"` без правок самого диалога; справа Opening balance (место под Account для 19-18).
- `opening-balance-panel.tsx`: Balance now, Lessons left (`parseLessons` из core), As of (`DateField`, по умолчанию сегодня, не позже сегодня), подсказка про оплаты на дату открытия или раньше видна всегда, Save или Update opening balance, `PUT /students/:id/opening-balance`; сбой — Banner, значения остаются.
- `confirm-dialog.tsx`: `ConfirmDialog` (size sm, `autoFocus` на кнопке отмены, tone primary или destructive, Banner при `false`, повтор игнорируется).

## Task Commits

1. **Задача 1: страница профиля, шапка, Details** - `4da94f1` (feat)
2. **Задача 2: архив и восстановление** - `5513af7` (feat)
3. **Задача 3: панель Opening balance, перенос длинных значений** - `0edc7e6` (feat)

`commits: 3` посчитано по `git log --grep "(19-14)"`: в той же рабочей копии параллельно коммитят планы 19-12 и 19-13, поэтому `git rev-list` от `plan_head_before` покажет больше.

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web typecheck` | код 0 |
| `yarn workspace @dv-lab/web lint` | код 0 |
| `yarn workspace @dv-lab/web build` | код 0, маршрут `/students/[id]` в списке |
| Prettier по файлам плана | чисто |
| grep: `requireTeacherPage` раньше `await params`; нет `min(ute)s left` и `balanceMinutes}` в student-profile; `parseLessons` есть, `parseFloat` и `Number(` нет в панели; подсказка D-10 на месте; `autoFocus` в confirm-dialog | пройдены |

Браузер: dev-стек (`yarn workspace @dv-lab/api dev` и `yarn workspace @dv-lab/web dev`, база dvlab_dev), вход dev-учителем, Chromium через playwright-core, скрипт `SCRATCH/19-14-browser.mjs` (части 1-3, `all`), обе темы. Итоговый прогон на коммите `0edc7e6`: светлая тема 77 PASS, тёмная 77 PASS, ни одной строки FAIL; `PROFILE_OK`, `ARCHIVE_OK`, `BALANCE_OK` в обеих темах. Проверки шли только на вымышленных карточках Alex Example 1914 (A, C, D, P и длинная); после прогонов их в dvlab_dev нет (счёт 0).

- Профиль (часть 1): имя в `h1`, точка и подпись Active, «₽1,500 / lesson», кнопка Set opening balance, ссылка Students на `/students`, tablist «Student sections» с одной вкладкой; строки Details («₽1,500 per lesson», «60 min», «Not set» у Parent, Level, Goals, «Same as teacher»); Edit details открывает диалог «Edit {name}» с заполненными полями, смена Level на B2 даёт уведомление «Changes saved», обновлённую строку после перечитывания и возврат фокуса на Edit details; `/students/not-a-uuid` и случайный uuid дают Page not found; загрузка (скелетон, вкладка отключена, имени ещё нет); сбой чтения (один ReadError, Refresh возвращает профиль); сессия ученика на `/students/{id}` видит только экран «Signed in as», данных карточки нет, api отвечает 403.
- Архив и восстановление (часть 2): диалог «Archive {name}?» с предупреждением про активный аккаунт (аккаунт dev-ученика временно привязан к вымышленной карточке и после прогона отвязан), без предупреждения у карточки без аккаунта; фокус на Keep student; Esc закрывает без архивирования и возвращает фокус на Archive; сбой даёт Banner в открытом диалоге; при запросе кнопка «Archiving…» отключена, ушёл один запрос; после успеха уведомление, подпись Archived, серая точка (цвет отличается от зелёной), Restore вместо Archive, профиль остаётся открытым; аккаунт не тронут (статус active, привязка на месте); карточка во вкладке Archived списка; Restore: фокус на Keep archived, «Restore student», уведомление, снова Active; сбой восстановления даёт Banner.
- Остаток (часть 3): Set opening balance в шапке ставит фокус в Lessons left; тексты панели и подсказка на месте; As of по умолчанию сегодня; «-1», пусто и «1.555» отклонены без запроса; сбой сохранения — Banner и значение остаётся; при сохранении «Saving…», поле отключено, один запрос; «3» на сегодня даёт уведомление «3 lessons left as of {сегодня}.», шапку «3 lessons left», Balance now «3 lessons», кнопку Update opening balance, в базе 180 минут на сегодня; «1» даёт «1 lesson left», «0.25» — «0.25 lessons left», «1,5» — «1.5 lessons left», «0» — «0 lessons left»; сохранённая дата 1 сентября показывается в As of после перечитывания, поле заполняется «2.5»; календарь отключает будущие даты. Backstop: имя из 80 символов без пробелов и Parent и Goals по 200 символов переносятся без горизонтальной прокрутки страницы при 1280 и 320 px.
- Фокус на странице проверен клавиатурным путём только для диалогов и Set opening balance.

Скриншоты (только в SCRATCH): `19-14-{light,dark}-profile-overview`, `edit-dialog`, `profile-loading`, `profile-readerror`, `archive-dialog`, `archive-failure`, `archive-pending`, `profile-archived`, `restore-dialog`, `balance-empty`, `balance-error`, `balance-banner`, `balance-saved`, `balance-calendar`, `long-1280`, `long-320`. Dev-серверы остановлены, порты 3000 и 4000 свободны, `apps/web/AGENTS.md` удалён.

Не запускалось: `yarn knip` (красный до 19-19), `yarn test` (новых тестов нет, существующие не затронуты), проверка длинного текста 60-символьного значения отдельно (проверены 80 и 200 символов), клавиатурный проход по календарю, режим «профиль закрытой карточки с активным аккаунтом» в сочетании с Deactivate (панель Account добавит 19-18).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DateField рисовал иконку и дату в два ряда**
- **Found during:** Задача 3, скриншот панели Opening balance
- **Issue:** `components/app/date-field.tsx` (копия 19-06) передавал иконку `CalendarDays` дочерним элементом кнопки; `svg` в Tailwind preflight блочный, и значок с датой ложились друг под другом, кнопка высотой 36 px переполнялась.
- **Fix:** иконка передаётся через `leadingIcon` у `Button`, дата остаётся дочерним текстом; вид остаётся тем, что задумывал вариант A (значок слева от даты).
- **Files modified:** apps/web/components/app/date-field.tsx (вне `files_modified`; в волне 5 это единственный план web, конфликта нет)
- **Committed in:** 0edc7e6

**2. [Rule 1 - Bug] Длинные значения растягивали страницу вправо**
- **Found during:** Задача 3, проверка 80- и 200-символьных значений
- **Issue:** `break-words` (в плане и в 19-UI-SPEC) не уменьшает минимальную ширину содержимого, и `ScrollArea` растягивался по неразрывной строке (прокрутка 1108 px при 320 px).
- **Fix:** имя в `h1` и значения Details переносятся через `wrap-anywhere` (Tailwind 4.3.3), как в классе-карте DR-1 для markdown.
- **Files modified:** `student-profile.tsx`, `overview-tab.tsx`
- **Committed in:** 0edc7e6

**3. [Rule 2 - Missing functionality] ConfirmDialog закрывается сам после успеха**
- **Found during:** Задача 2
- **Issue:** контракт `onConfirm: () => Promise<boolean>` не говорит, кто закрывает диалог после `true`.
- **Fix:** `ConfirmDialog` вызывает `onClose()` после `true` и показывает Banner после `false`; вызывающий код отвечает только за запрос, уведомление и перечитывание.
- **Committed in:** 5513af7

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing functionality)
**Impact on plan:** на контракт плана не влияют; первое меняет файл плана 19-06, второе заменяет класс переноса.

## Наблюдения для следующих планов и дизайна

- Сессия ученика на `/students/{id}` не получает редирект на `/`: слой `(app)/layout.tsx` для роли student возвращает `StudentLanding` и не отдаёт `children`, поэтому `requireTeacherPage` в странице не выполняется. Данных карточки ученик не видит, api отвечает 403 (T-19-61 закрыта на уровне api и layout). Так же ведёт себя `/students`; формулировка плана про редирект неточна.
- Ошибки «Choose a date.» у As of нет: `DateField` не позволяет очистить значение.
- Dev-консоль на `notFound()` показывает React-предупреждение про script tag (next-themes). Оно появляется и на уже существующей `/nonexistent-xyz`, к плану не относится.
- 19-18 добавляет панель Account в правую колонку `overview-tab.tsx` под Opening balance; 19-16 и 19-17 добавляют вкладки в `student-profile.tsx` (в `SectionTabs` для состояния загрузки тоже).
- `ConfirmDialog` готов для удаления оплаты и термина (`tone="destructive"`).

## Known Stubs

Нет.

## Threat Flags

Новой поверхности сверх `<threat_model>` нет. T-19-61: `requireTeacherPage` первым, api 403 ученику, ученик видит только `StudentLanding`. T-19-62: невалидный uuid ведёт на `notFound()`, чужой на 404 api и ту же страницу. T-19-63: `parseLessons` в форме, минимум 0 на сервере (`openingBalanceRequest`), отрицательное и пустое значение отклоняются без запроса. T-19-64: проверки только на карточках Alex Example 1914, скриншоты в SCRATCH, имена реальных карточек нигде не записаны.

## Self-Check: PASSED

- Файлы page.tsx, student-profile.tsx, overview-tab.tsx, opening-balance-panel.tsx, confirm-dialog.tsx и date-field.tsx на месте; коммиты 4da94f1, 5513af7, 0edc7e6 есть в ветке.
- typecheck, lint и build web — код 0; браузерные проверки в обеих темах пройдены.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
