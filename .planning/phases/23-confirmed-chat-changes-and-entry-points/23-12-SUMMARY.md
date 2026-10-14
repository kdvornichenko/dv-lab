---
phase: 23-confirmed-chat-changes-and-entry-points
plan: '12'
subsystem: web
status: complete
tags: [web, phone, touch-targets, dialogs, hit-slop, shell-03]

requires:
  - phase: 23-confirmed-chat-changes-and-entry-points
    provides: 'ChangeProposal и CalendarProposal (23-10), чат с упоминаниями (22), палитра команд и профиль ученика'
provides:
  - 'scripts/dev-checks/phone-web.mjs: разделы today, schedule, chat, profile, palette в светлой и тёмной теме на 375 и 320 px'
  - 'утилита hit-slop в globals.css: зона касания не меньше 2.75rem на pointer: coarse без смены вида'
  - 'диалоги не выше окна (dvh), прокручиваются внутри; поля форм ученика и оплаты в ScrollArea'
affects: [23-14]

actuals:
  tokens: 21500
  tasks: 3
  commits: 3
plan_head_before: 0ed5aa72ca77d2563223e61e5c23169000f89bcc
plan_head_after: a9fb757c03b745b7fa0996d587ab0c8da63852f8

key-files:
  created:
    - 'scripts/dev-checks/phone-web.mjs'
  modified:
    - 'apps/web/app/globals.css'
    - 'apps/web/components/ui/button.tsx'
    - 'apps/web/components/ui/dialog.tsx'
    - 'apps/web/components/ui/menu-item.tsx'
    - 'apps/web/components/ui/switch.tsx'
    - 'apps/web/components/ui/tabs.tsx'
    - 'apps/web/components/ui/select/trigger.tsx'
    - 'apps/web/components/app/date-field.tsx'
    - 'apps/web/components/app/time-zone-picker.tsx'
    - 'apps/web/components/app/google-conflicts.tsx'
    - 'apps/web/components/app/layout-parts.tsx'
    - 'apps/web/app/(app)/_components/app-shell.tsx'
    - 'apps/web/app/(app)/_components/today-lessons.tsx'
    - 'apps/web/app/(app)/_components/due-list.tsx'
    - 'apps/web/app/(app)/_components/command-palette.tsx'
    - 'apps/web/app/(app)/chat/_components/mention-popup.tsx'
    - 'apps/web/app/(app)/schedule/_components'
    - 'apps/web/app/(app)/students'

decisions:
  - 'Зона касания 44 px расширяется общим hit-slop (псевдоэлемент ::after) в Button, Switch, Tab, триггерах Select, DateField и TimeZonePicker; визуальный размер не меняется'
  - 'Текстовые поля не входят в проверку 44 px: действует правило шрифта 16 px; поля в 44 px — запрос к дизайну (ниже)'
  - 'Соседние иконки на грубом указателе разведены gap-4, иначе зоны касания перекрываются'
---

# Phase 23 Plan 12: Узкий экран Summary

Измерение на 375 и 320 px (touch-контекст, светлая и тёмная тема, reduced motion) нашло нарушения только в зонах касания, высоте диалогов и узких строках; общий hit-slop и точечные правки закрыли их, все пять разделов проходят в обеих темах.

## Что сделано

**Задача 1.** `scripts/dev-checks/phone-web.mjs <today|schedule|chat|profile|palette> <light|dark>`. Проверяет на 375 и 320: нет горизонтальной прокрутки страницы и областей, подписи не обрезаны, элементы не перекрываются, зона касания не меньше 44 px (реальный hit-test через `elementFromPoint`), диалог вмещается в окно и все его кнопки достижимы прокруткой диалога, шрифт полей не меньше 16 px. Today и Schedule идут на стеке владельца с подменой `/api/today` и `/api/schedule/week` поверх настоящего ответа; чат идёт на собственном api с фейком модели на свободном порту (приём 23-10), в браузер к нему уходит только `/api/chat/*`. Фикстуры (карточки, диалоги) удаляются. Печатает `PHONE_WEB_<РАЗДЕЛ>_OK` или список нарушений. `PHONE_VERBOSE=1` показывает до 60 нарушителей.

**Задача 2.** Today, Schedule, профиль, формы. **Задача 3.** Чат (подсказка упоминаний), палитра команд.

## Исходный список нарушений (до правок, одинаков в светлой и тёмной теме)

| Раздел | Прошло / нарушений | Суть |
|--------|--------------------|------|
| today | 122 / 17 | зоны касания иконок шапки, строки списков 36-40 px, Panel-кнопки |
| schedule | 97 / 16 | диалог урока и нового события выше окна, ссылка на ученика перекрывает Close, строка отметки не помещается на 320, триггеры Select, дата, пояс, переключатель, вкладки |
| profile | 143 / 25 | диалоги карточки и оплаты выше окна, заголовок диалога правки вылезает по ширине, вкладки, радио, иконки оплат |
| chat | 83 / 12 | строки подсказки упоминаний 40 px, зоны иконок, кнопки предложений |
| palette | 33 / 4 | строки 36 px |

Итог после правок: today 139/0, schedule 113/0, profile 168/0, chat 95/0, palette 37/0 в светлой и тёмной теме. Все пять выводят `PHONE_WEB_*_OK`.

## Deviations from Plan

Правки вне перечня файлов плана (Rule 1/2/3): общая причина — нарушения живут в общих компонентах, а не в экранах, которые назвал план.

1. **[Rule 3 - Blocking] Общий hit-slop.** Правка в `globals.css`, `button.tsx`, `switch.tsx`, `tabs.tsx`, `select/trigger.tsx`, `date-field.tsx`, `time-zone-picker.tsx`: иначе каждую иконку и триггер пришлось бы увеличивать по отдельности, меняя вид макета. Только на `pointer: coarse`.
2. **[Rule 1 - Bug] Диалоги выше окна на телефоне.** `dialog.tsx` (max-h в dvh, `overflow-y-auto`, перенос длинного заголовка), `record-payment-dialog.tsx`, `student-form-dialog.tsx`, `new-lesson-dialog.tsx` (поля в ScrollArea), `lesson-dialog.tsx` и `calendar-lesson-dialog.tsx` (отступ заголовка от Close, ссылка на ученика с увеличенной зоной).
3. **[Rule 1 - Bug] Строка отметки урока вылезала по ширине на 320.** `lesson-mark-row.tsx`: перенос строки и высота 44 px на грубом указателе.
4. **[Rule 2] Высота строк и промежутки на грубом указателе.** `menu-item.tsx`, `today-lessons.tsx`, `due-list.tsx`, `layout-parts.tsx`, `app-shell.tsx`, `schedule-toolbar.tsx`, `schedule-loading.tsx`, `payments-tab.tsx`, `lesson-footer.tsx`, `google-conflicts.tsx` (FormFooter), `student-profile.tsx`, `command-palette.tsx`, `mention-popup.tsx`.
5. **Инструмент.** Мерка проверяет достижимость кнопок прокруткой самого диалога (а не «без прокрутки»): диалог ограничен окном и прокручивается, что допустимо; исключены кнопки внутри ScrollArea и текстовые поля из проверки 44 px.

## Запросы к Design dude (нарушение оставлено в политике, а не в списке падений)

- Текстовые поля высотой 44 px на телефоне: сейчас 16 px шрифт, высота поля как в макете; если нужна зона 44 px, это решение по макету.

## NOT RUN

- Реальная экранная клавиатура телефона и набор через IME (композиция) не проверялись: Playwright эмулирует касание и размер, но не клавиатуру ОС.
- `scripts/dev-checks/wait-dev.mjs down` возвращает 1: порты 3000 и 4000 заняты стеком владельца, останавливать его запрещено.
- Реальное устройство (iOS Safari, Android Chrome): не запускалось.
- Блок bulk_move на телефоне: блок null до 23-13.

## Проверки

- `yarn workspace @dv-lab/web typecheck`: чисто.
- `yarn workspace @dv-lab/web lint`: код 0.
- `phone-web.mjs` пять разделов, светлая и тёмная тема: все OK.

## Для 23-14

README в `scripts/dev-checks/` пока без раздела `phone-web.mjs`; список разделов и переменная `PHONE_VERBOSE` описаны выше.

## Threat Flags

Нет новых сетевых поверхностей. Скрипт не пишет в рабочие данные: фикстуры создаются и удаляются, в репозитории нет имён и сумм учеников.

## Known Stubs

Нет.

## Self-Check: PASSED
