# Skyline Stack: editing rules

- Every mechanic lives in its own file. `README.md` has the map ("To change → Edit").
- When asked to change one thing, edit only the file that owns it. Its tuning numbers are in the settings block at the top of that file. If a change really needs a second file, name the file and the reason before editing it.
- Files talk only through the `SS` namespace (`SS.crane.hookAt`, `SS.sway.bendAt`, …). Read another part's numbers from its settings block; don't copy them.
- A new script goes into the list in `index.html` in load order; `core/loop.js` stays last.
- After a change, open `index.html` in a browser (file:// works) and check the console is clean.
