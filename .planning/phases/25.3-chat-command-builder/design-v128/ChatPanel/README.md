# ChatPanel

The chat as a panel at the right of every app screen: the same conversation as the Chat page, opened from the top bar over no page of its own, so the teacher can ask or record something without leaving the screen she is on. It replaces `AssistantDock`.

**You provide:** nothing per screen; the shell owns it. The panel keeps its own open conversation, its draft and the scroll of its messages while the teacher moves between pages.

## Where it stands
- **Outside the content card, like the sidebar** (owner, 2026-10-16). The shell has a third area at the right. The panel is a card of its own: `surface-2`, `radius-2xl`, the `shadow-2` ring, 416px wide (480px from a 1536px window, 360px under 1192px), the full height of the shell less the 8px margin; **8px** from the content card, 8px from the window edge, on the `surface-1` ground the sidebar stands on. Everything built for the page colour (`ChatMessage`, `ChatFacts`, `ChatComposer`, the blocks) is used unchanged.
- **Button.** The last button of the top bar's right group, **after the theme toggle** (the edge the panel opens from, as the sidebar trigger is at the left edge). An outline icon-compact button (28px, 16px icon) with the Chat icon of the sidebar row; `aria-expanded`, `aria-controls` the panel; while the panel is open it takes the `active` fill. Tooltip "Open chat" or "Close chat" with the key **]** (the right-sidebar key of the shell, as **[** is the sidebar's); the key is ignored in a field. While the panel is closed the button can carry a dot, see **While it is closed**.
- **Not on the Chat page and not under 1024px.** On `/chat` the page is the same conversation, so the button is not in the bar and an open panel closes when the page opens. Under 1024px (tablet portrait, phone) there is no button and no panel; the Chat page is reached from the sidebar.

## Widths
It is always a block of the layout that pushes the content card aside: never a modal, never over the page, no scrim.
| Window | The panel | The rest |
|---|---|---|
| 1424px and up | 416px (480px from 1536px), beside the card | the sidebar stays as it is; the card is at least 768px |
| 1192px to 1423px | 416px, beside the card; opening it **folds the sidebar** | the sidebar is reachable at the left edge; the card is at least 752px; when the chat closes the sidebar opens again, unless the teacher opened or closed it herself meanwhile |
| 1024px to 1191px | **360px**, beside the card, the sidebar folded | the card is at least 640px |
| under 1024px | none: no button, no panel | the teacher uses the Chat page from the sidebar |

## Motion
As the sidebar's (`motion.md`): the wrapper's width goes from 0 to 416px on the `slow` spring (exit `slow` exit) while the card inside keeps its 416px and slides from `x: 100%` to 0 on the same spring, so the text never reflows while it opens; the content card gives up the width on the same spring, and folding the sidebar uses the sidebar's own. Reduced motion: no motion, it is there at once.

## What it holds
- **Header**, 48px, 16px at the left and 8px at the right: the title of the conversation (`subtitle` weight 600, one line, ellipsis) or "New chat", and four outline icon-compact buttons, 8px apart, each with a tooltip and an `aria-label`: **All chats** (list), **New chat** (plus), **Open in chat** (maximize; opens `/chat` on this conversation and closes the panel), **Close chat** (x). All chats is pressed while its list is open.
- **Body**, the `ChatPage` conversation in a 392px column (12px gutters): messages anchored to the composer, the scroll fade at the top, the list of what can be typed for a new chat, **All chats** as the list that opens over the messages (same rows, menu, Rename and Delete dialogs, "No chats yet.", "Could not load conversations."), loading skeletons and the one-screen read error. `ChatRail` is not used here.
- **Footer**: `ChatComposer` with its chips (`ChatModelControls`), in 12px gutters. The hint line "Shift+Enter — new line" is the page's; the panel has none.

## While it is closed
Three signals, so a reply is never lost behind a closed panel (owner, 2026-10-16, v124). They are for a reply that ended or a proposal that waits while the panel is closed; none of them is made for a reply the teacher is looking at.
- **A dot on the button**, 8px at its top right corner with a 2px ring in the card colour, as the dot of a lesson block. `info` when a reply has arrived (it ended: finished, stopped, interrupted or failed) in any conversation since the panel was last open; `warning` when a proposal waits for a decision (`ChatCalendarChange`, `ChangeCard`; the same amber as "Waiting for a decision" in the list). `warning` wins when both are true. It never shows on an open panel. **What clears it:** the `info` dot goes when the panel has opened (or the Chat page); the `warning` dot stays until the decision is made (applied, declined or expired) and comes back when the panel is closed again, because the thing still waits. The dot is `aria-hidden`; the button's name and the tooltip say it: "Open chat, new reply" or "Open chat, waiting for your decision".
- **The same dot on the Chat row of the sidebar**, at the end of the row, with the same colours and clearing. It is the only in-app signal where the panel does not exist (under 1024px) and where the button is hidden (the sidebar open on the Chat page does not show it).
- **A toast** when the reply ends or the proposal appears while the tab is in front and the panel is closed: the toast of `UpdateNotice`'s look (`surface-4`, `shadow-4`, 340px, `role="status"`, polite, bottom right, 16px from the edges), a 16px chat icon in `info` ("Reply is ready") or `warning` ("Waiting for your decision"), the title, the title of the conversation in `caption muted`, one compact secondary action **Open chat** (opens the panel on that conversation; under 1024px it opens the Chat page on it) and the close button. It leaves by the usual 4s countdown; the dot stays. Never over the top bar, never takes focus, never opens while a reply is on screen (panel open or the Chat page). One toast per conversation: a newer one replaces the older.
- **A push** when the tab is not in front (hidden, another app, the phone locked) and the teacher has turned the event on in Settings (`SettingsNotifications`, "The assistant has answered"): the app's name and icon, "Reply is ready" or "Waiting for your decision", and the conversation's title; never the text of the reply. A tap opens the conversation (the panel from 1024px, the Chat page under it). A newer push for the same conversation replaces the older one.

## Behaviour
- **It is the same data as the Chat page**: one list of conversations, one open conversation; a rename, a delete or a message made in one is in the other at once. Opening **Open in chat** on a wide page shows the conversation in `ChatRail`'s list as the open row.
- **State lives above the pages** (in the shell): navigating keeps the open conversation, the draft, the scroll, and a reply that is still being written goes on being written while the panel is closed; opening it shows the text so far.
- **Open or closed starts closed on every load**, like the sidebar; it is not remembered.
- **Focus.** Opening moves focus to the composer; closing returns it to the top bar button. Esc closes the innermost layer first (a popover, the All chats list) and never the panel itself: the panel is not a dialog, the button or Close shuts it.
- **The pill of `LocalData`** centres on the content card, not on the window, so it never sits over the panel.

## Roles
`aside` with `aria-label="Chat"`; the messages are `role="log"` as on the page. No focus trap: Tab leaves the panel into the page and back as through any region.

> **Opened from the star (v127, owner 2026-10-16).** The top bar button described under "Button" is replaced by `AssistantStar`: the panel opens with **Open as panel** in the star's block, and while it is open the star is hidden. The panel itself (widths, motion, content, behaviour) is unchanged; the dot, the badge and the bubble of "While it is closed" are carried by the star, and the Chat row dot of the sidebar stays. The preview frames of the button show the button of v123 and are kept as the record of the proposal that was replaced.

> **Keys and toast (v128, owner 2026-10-16).** `]` stays and is the panel's own key: it opens and closes the panel (on the last conversation when it opens from nothing), ignored in a field, nothing under 1024px; it never opens the star's field. The toast of "While it is closed" is **not built**: the star's bubble, badge, hop and wink replace it. The dots, the push and the Chat row dot stand as described.
