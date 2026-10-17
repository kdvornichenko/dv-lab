# Design v128: assistant star and chat panel

Copy of the design export for phase 25.3 (source of truth: the design session's export outside the repository, version v128, artifact counter 133). Text files only; no screenshots, no student data.

| File | What it is |
|------|------------|
| `AssistantStar/README.md` | Spec of the star: shape, states, motion, tokens `--star-*` with light and dark values, field, block, phone, keyboard |
| `AssistantStar/preview.html` | Static preview with the star drawn: open in a browser, read the SVG path and states from it |
| `ChatPanel/README.md`, `ChatPanel/preview.html` | The chat panel that the star's block opens (Open as panel) |
| `tokens.css` | Shell tokens; the `--star-*` tokens are not in it yet and go into the shell's globals |
| `motion.md` | Motion rules, including the recorded exception that only the star may idle-loop and overshoot |
| `code-sync-157-160.md` | Items 157, 159, 160 and the latest 158 (signals, with the Settings switch off by default) |

Decisions already made by the owner: the star replaces only the chat button in the top bar; `ChatPanel` stays and opens from the star's block; `]` toggles only the panel; the star's bubble replaces the toast; the star is shown on every width including phone and 1024 to 1191px.

Component name `AssistantStar`; the owner's animated example (`FrostCloud`) is renamed into it, only the shape and palette are replaced by the star as in `AssistantStar/README.md`.
