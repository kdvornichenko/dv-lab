---
phase: 19-student-cards-and-vault-import
plan: 17
subsystem: ui
status: complete
tags: [notes, markdown, vocabulary, terms, xss, base-ui]
requires:
  - phase: 19-06
    provides: MarkdownView, Textarea
  - phase: 19-09
    provides: api секций и словаря (/students/:id/sections, /students/:id/terms)
  - phase: 19-14
    provides: профиль карточки, ConfirmDialog
  - phase: 19-16
    provides: вкладка Payments, приёмы w-0 min-w-full и перечитывания списка
provides:
  - вкладка Notes с шестью markdown-секциями (просмотр MarkdownView, правка Textarea, PUT секции)
  - вкладка Vocabulary с таблицей терминов, добавлением, правкой заметки и удалением
  - черновики секций в StudentProfile, переживающие смену вкладок
affects: [19-18, 19-19, 19-20]
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: ab1ed1b6469daf050f56c8a088f8b825480072ab
plan_head_after: dd424147072e8dcf1d7c6a2dd7e01b09f811184e
tech-stack:
  added: []
  patterns:
    - "черновик секции = строка в drafts[kind] в StudentProfile; наличие ключа и есть режим правки, Save и Discard удаляют ключ"
    - "блок с горизонтальной прокруткой внутри панели оборачивается в w-0 min-w-full, иначе таблица markdown растягивает страницу"
    - "поле Note в диалогах словаря: Textarea с max-h-[40dvh] и прокруткой, чтобы кнопки диалога не уходили за экран"
key-files:
  created:
    - apps/web/app/(app)/students/[id]/_components/notes-tab.tsx
    - apps/web/app/(app)/students/[id]/_components/vocabulary-tab.tsx
    - apps/web/app/(app)/students/[id]/_components/term-dialogs.tsx
  modified:
    - apps/web/app/(app)/students/[id]/_components/student-profile.tsx
key-decisions:
  - "Черновики секций подняты в StudentProfile (keepMounted у TabPanel не использовался): открытый редактор и его текст переживают переключение вкладок, пока страница открыта"
  - "Сортировка словаря остаётся за api (по lower(term)); клиентской пересортировки нет"
  - "Пустая заметка термина в таблице — пустая ячейка (в контракте текста для неё нет)"
requirements-completed: [CARD-02, CARD-03]
duration: 70min
completed: 2026-10-10
coverage:
  - id: D1
    description: "Вкладка Notes: шесть панелей, просмотр в виде DR-1, правка, Discard changes, Save section, очистка хранит пустую строку"
    requirement: CARD-02
    verification:
      - kind: automated_ui
        ref: "SCRATCH/19-17-browser.mjs 1 (light, dark): NOTES_UI_OK"
        status: pass
    human_judgment: false
  - id: D2
    description: "Сырой HTML и javascript:-ссылки в секции не исполняются (script не в DOM, window.__xss не задан, у ссылки нет исполняемого href, внешние ссылки с noreferrer noopener)"
    requirement: CARD-02
    verification:
      - kind: automated_ui
        ref: "SCRATCH/19-17-browser.mjs 1 (light, dark), проверки 4, до и после перезагрузки"
        status: pass
    human_judgment: false
  - id: D3
    description: "Вкладка Vocabulary: счётчик, Add term, повтор без учёта регистра у поля, правка заметки, удаление с подтверждением"
    requirement: CARD-03
    verification:
      - kind: automated_ui
        ref: "SCRATCH/19-17-browser.mjs 2 (light, dark): VOCAB_UI_OK"
        status: pass
    human_judgment: false
---

# Phase 19 Plan 17: Вкладки Notes и Vocabulary Summary

**Учитель правит шесть markdown-секций карточки (вид DR-1, сырой HTML и javascript:-ссылки не исполняются) и ведёт словарь: добавляет термины с заметками, правит заметки и удаляет термины; повтор термина без учёта регистра показывается ошибкой у поля.**

## Что сделано

- `notes-tab.tsx`: `NotesTab({ student, drafts, onDraftChange })` читает `GET /students/{id}/sections`; загрузка — шесть панелей со скелетонами, сбой — `ReadError screen="notes"`. Шесть `Panel` по `SECTION_KINDS` в порядке General info, Interests, Level, Goals, Typical mistakes, Lesson ideas. Просмотр: действие Edit (Pencil, ghost compact) и `MarkdownView` (пустое тело — «Nothing here yet»). Правка: `Textarea` `min-h-32` с `aria-label` по заголовку, Discard changes и Save section (Saving…), при сбое Banner «Could not save the section. Try again.» с сохранением текста; больше 20 000 кодовых точек — «Use 20,000 characters or fewer.» без запроса. Сохранение — `PUT /students/{id}/sections/{kind}`, пустое поле сохраняется как `''`; DELETE в файле нет. Уведомление «Section saved» / «{заголовок} on {name}'s card.», фокус возвращается на Edit.
- `student-profile.tsx`: порядок вкладок Overview, Notes, Vocabulary, Payments (и в состоянии загрузки). Черновики открытых редакторов лежат в `drafts` состояния `StudentProfile`. У `TabsList` добавлено `max-sm:w-0 max-sm:min-w-full max-sm:overflow-x-auto` (приём 19-16): четыре вкладки при 320 px иначе растягивали страницу на 42 px.
- `vocabulary-tab.tsx`: строка инструментов «{k} terms» («1 term», «0 terms») и Add term (Plus, secondary), таблица Term, Note, sr-only Actions (ячейки `align-top`, `wrap-anywhere`), действия Pencil («Edit note», `aria-label` «Edit note for {term}») и Trash2 («Delete term», `aria-label` «Delete {term}»). Удаление — `ConfirmDialog`: «Delete "{term}"?», Keep term / Delete term, «Deleting…», Banner «Could not delete the term. Try again.», уведомление «Term deleted» / «{term} was removed.». Пусто — `EmptyLine`. Диалоги рисуются внутри ветки `ready`, после каждого изменения список перечитывается.
- `term-dialogs.tsx`: `AddTermDialog` (Dialog sm; Term с начальным фокусом и Note (optional); ошибки «Enter a term.», «Use 200 characters or fewer.», «Use 2,000 characters or fewer.»; 409 `term_exists` — «This term is already on the card.» у поля, Banner только для прочих сбоев; Adding…; «Term added» / «{term} is on {name}'s card.») и `EditNoteDialog` (Dialog sm; описание — сам термин; Note; Save note, Saving…; Banner «Could not save the note. Try again.»; «Note saved» / «{term} was updated.»). Локальный `NoteField` (подпись, Textarea, ошибка) повторяет разметку `TextField`.

## Task Commits

1. **Задача 1: вкладка Notes с шестью markdown-секциями** - `605e517` (feat)
2. **Задача 2: вкладка Vocabulary с диалогами** - `dd42414` (feat)

`commits: 2` посчитано по `git log --grep "(19-17)"`: в диапазоне `plan_head_before..HEAD` есть ещё один коммит оркестратора (`961e8d5`, docs 19), поэтому `git rev-list` даёт 3.

## Проверки

| Проверка | Результат |
|----------|-----------|
| `yarn workspace @dv-lab/web typecheck` | код 0 после каждой задачи (после коммита задачи 1 повторён как шлюз tracer) |
| `yarn workspace @dv-lab/web lint` | код 0 после каждой задачи |
| `yarn workspace @dv-lab/web build` (dev-серверы остановлены) | код 0, маршруты `/students` и `/students/[id]` |
| Prettier по файлам плана | чисто |
| Приёмка 1: нет `dangerouslySetInnerHTML` и `rehype-raw`, нет `'DELETE'` в notes-tab | код 1 у обоих grep, то есть совпадений нет |
| Приёмка 2: «This term is already on the card.» в term-dialogs.tsx | найдено |

Браузер: dev-стек на dvlab_dev (`yarn workspace @dv-lab/api dev`, `yarn workspace @dv-lab/web dev`), вход dev-учителем, Chromium через playwright-core, `SCRATCH/19-17-browser.mjs` (`1`, `2`, `all`), обе темы. Итоговый прогон `all` на коде коммита `dd42414` (сборка web после него, код не менялся): светлая и тёмная темы без единой строки FAIL; `NOTES_UI_OK` и `VOCAB_UI_OK` в обеих.

- Notes (карточка Alex Example 1917): шесть панелей в порядке контракта, пустые секции показывают «Nothing here yet» и Edit; правка: Textarea с `aria-label`, фокус, высота не меньше 128 px, Discard changes и Save section; уведомление, возврат в просмотр с фокусом на Edit; SQL: одна строка `general_info`, длина тела равна отправленному тексту. Вид DR-1: h1 и h2 16 px и 600, h3 13 px и 600, маркированный список disc, нумерованный decimal, задачи (пустая и отмеченная с одной галочкой), таблица GFM из 8 колонок в обёртке `overflow-x: auto`, строчный код моно-шрифтом с фоном, блок кода с прокруткой, цитата. При 320 px страница вбок не прокручивается, таблица прокручивается в своей обёртке; при 1280 px страница вбок не прокручивается.
- XSS (на вымышленной карточке, до и после перезагрузки страницы): в панели нет элемента `script`, `window.__xss` не задан, у ссылки `javascript:` атрибут `href` пустой, ссылка https имеет `target="_blank"` и `rel="noreferrer noopener"`, текст `<script` на страницу не выведен. Результат: PASS во всех проверках, обе темы.
- Черновики: текст Level переживает переход на Overview и обратно; Discard changes закрывает редактор и возвращает сохранённый текст (пустой секции — «Nothing here yet», сохранённой — прежний markdown). 20 001 символ: ошибка у поля, `aria-invalid`, запроса нет; 20 000 символов сохраняются. Сбой сервера: Banner, текст остался. Отправка: «Saving…», кнопка и Textarea отключены, ушёл один PUT. Очистка General info: SQL показывает строку секции с пустым телом (длина 0), панель — «Nothing here yet». Секции правятся независимо.
- Vocabulary: порядок вкладок Overview, Notes, Vocabulary, Payments; пусто — «0 terms», EmptyLine, Add term; диалог (заголовок, фокус на Term, подписи, Discard changes), ошибки «Enter a term.», «Use 200 characters or fewer.», «Use 2,000 characters or fewer.» без запроса; Discard возвращает фокус на Add term; сбой — Banner, значения остались; «Adding…», отключённые поля, один POST; уведомление, «1 term» и строка; «make DO» после «Make do» — ошибка у поля, фокус на Term, без Banner, диалог открыт, в базе одна строка, ввод снимает ошибку; порядок apple, Banana, Make do, Zebra без учёта регистра, «4 terms»; `aria-label` действий; Edit note (заголовок, описание, текущая заметка, фокус), сбой, успех, очистка заметки хранит null; заметка из 300 символов переносится, при 1280 и 320 px страница вбок не прокручивается; удаление: заголовок, текст, фокус на Keep term, Delete term цветом destructive, Esc оставляет термин, сбой даёт Banner, успех — уведомление, один DELETE, счётчик; после удаления последнего — «0 terms» и EmptyLine при остающемся Add term, SQL ноль строк.
- Импортированные карточки только просматривались: Notes (шесть панелей, таблицы и списки отображаются, `script` в DOM нет: 3 таблицы и 17 списков в одной карточке) и Vocabulary (таблица с 187 строками), скриншоты только в SCRATCH. Счёт до и после прогонов: секции карточек vault 66, термины 762, карточек Alex Example 1917 в dvlab_dev 0.

Скриншоты (только в SCRATCH): `19-17-{light,dark}-notes-*`, `vocab-*`. Dev-серверы остановлены, слушателей на портах 3000 и 4000 нет, `apps/web/AGENTS.md` удалён и не коммитился.

Не запускалось: `yarn knip` (красный до 19-19), `yarn test` (новых тестов нет, существующие не затронуты), клавиатурный проход по вкладкам и диалогам кроме Esc, Enter и фокуса, проверка Discard changes в диалогах словаря через Esc.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Таблица markdown растягивала страницу при 320 px**
- **Found during:** Задача 1, проверка узкой ширины
- **Issue:** обёртка таблицы DR-1 не сжималась: просмотровая панель получала ширину таблицы (956 px), страница прокручивалась вбок.
- **Fix:** просмотровое тело секции обёрнуто в `w-0 min-w-full` (приём из 19-16); MarkdownView (19-06) не менялся.
- **Files modified:** notes-tab.tsx
- **Committed in:** 605e517

**2. [Rule 1 - Bug] Четыре вкладки профиля растягивали страницу при 320 px**
- **Found during:** Задача 2, проверка узкой ширины
- **Issue:** `TabsList` с вкладками Overview, Notes, Vocabulary, Payments шире экрана, прокрутка страницы 42 px.
- **Fix:** `max-sm:w-0 max-sm:min-w-full max-sm:overflow-x-auto` у обоих `TabsList` профиля (как в списке карточек из 19-16).
- **Files modified:** student-profile.tsx
- **Committed in:** dd42414

**3. [Rule 1 - Bug] Длинная заметка выталкивала кнопки диалога за экран**
- **Found during:** Задача 2, проверка заметки из 2001 символа
- **Issue:** `Textarea` с `field-sizing-content` растёт по тексту, а у `Dialog` нет ограничения высоты и прокрутки: кнопка Add term оказалась вне окна.
- **Fix:** у поля Note в диалогах словаря `max-h-[40dvh] overflow-y-auto`.
- **Files modified:** term-dialogs.tsx
- **Committed in:** dd42414

---

**Total deviations:** 3 auto-fixed (3 bugs)
**Impact on plan:** на контракт и вид экранов не влияет, исправления ограничены файлами плана.

## Наблюдения для следующих планов и дизайна

- Диалоги копии варианта A не ограничивают высоту и не прокручиваются: любое длинное поле в диалоге (например, Textarea) выталкивает кнопки за экран на низких окнах. Здесь решено локально; если нужна общая высота диалога с прокруткой, вопрос к Design dude.
- У пустой заметки термина текста в контракте нет: ячейка остаётся пустой.
- `sed -i` в одной команде хук не отклонил (правка `className` у двух `TabsList`); дальше правки идут через Edit.

## Known Stubs

Нет.

## Threat Flags

Новой поверхности сверх `<threat_model>` нет. T-19-75: проверено в DOM на вымышленной карточке (нет script, `window.__xss` не задан, нет исполняемого href), в `notes-tab.tsx` нет `dangerouslySetInnerHTML` и `rehype-raw`. T-19-76: `target="_blank"` с `rel="noreferrer noopener"` у внешней ссылки. T-19-77: правки только на карточке Alex Example 1917 (удалена после прогонов), карточки vault только просматривались, счёт секций и терминов vault не изменился. T-19-78: кнопки loading и отключены, ушёл один POST, повтор термина отвергает сервер (409) и показывает ошибку у поля.

## Self-Check: PASSED

- Файлы notes-tab.tsx, vocabulary-tab.tsx, term-dialogs.tsx на месте, student-profile.tsx изменён; коммиты 605e517 и dd42414 есть в ветке.
- typecheck, lint и build web — код 0; браузерные проверки в обеих темах пройдены.

---
*Phase: 19-student-cards-and-vault-import*
*Completed: 2026-10-10*
