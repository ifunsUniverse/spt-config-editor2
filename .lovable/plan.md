# Resume the AI config assistant

## Build
- Add a clear Chat/Edit mode switch to the floating assistant.
- In Chat mode, answer questions without proposing file changes; in Edit mode, allow suggestions for the active config only.
- Refresh the panel with rounded message bubbles, a more expressive launcher, and polished spacing while keeping it over the editor.
- Show animated, contextual activity states such as reading config, thinking, and preparing a change.
- Keep every proposed edit behind the existing Confirm, Deny, Make Edits, and Cancel review window.

## Safety and verification
- Preserve the active-mod-only file scope, sign-in requirement, size limits, JSON validation, and no automatic writes.
- Update the server prompt and request payload so the selected mode is enforced, not merely visual.
- Verify the app builds, the panel works at desktop and mobile sizes, and make a real assistant request if available.
- Leave a working checkpoint if live AI credits or external service access blocks end-to-end verification.

## Technical details
- Update `ConfigAssistant` state, request body, animated activity presentation, and rounded chat styling.
- Update the assistant function input schema and system instructions with a required `mode: "chat" | "edit"` field.
- Record completion or any external blocker in the project roadmap.
