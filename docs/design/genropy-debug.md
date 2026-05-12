# Design proposal: Genropy Debug integration

> Status: design proposal, not yet implemented
> Audience: Sourcerer Visual maintainers and contributors
> Last updated: 2026-05-09

## Summary

This document proposes adding a **Genropy Debug** module to Sourcerer Visual.
The module turns the existing `--debugpy` runtime support of the GenroPy
framework into a one-click developer experience inside VSCode: start a
GenroPy dev server with `debugpy` already listening, attach the VSCode
debugger automatically, expose status in the UI, allow stop/restart, and
optionally enrich the debugging session with Sourcerer KB queries about
the current frame.

The motivation, the alternatives considered, and the implementation plan
are described below in detail.

## Motivation

### Why now

The GenroPy framework historically shipped its own custom interactive
debugger (`GnrPdb`), implemented around `pdb.Pdb` + a custom WebSocket
session bridge between the running web worker and a browser-side IDE
(`gnride`). The system dates back to **2015** and has been technically
frozen since 2018 on the IDE side. It is being **removed** from the
framework: the legacy code is no longer maintained, has known performance
problems (`sys.settrace` is process-wide and never disabled), is unused
in production (lock issues, worker timeouts), and was never widely
adopted in the team.

The replacement is `debugpy` — already wired in the framework as
`gnr web stack --debugpy` and `gnr web serve --debugpy` (see
`gnrpy/gnr/web/serverwsgi.py`). `debugpy` is the de-facto standard for
interactive Python debugging via the Debug Adapter Protocol (DAP), used
by VSCode, PyCharm, Vim, and others. It is implemented in C, leverages
`sys.monitoring` on Python 3.12+, has none of the legacy debugger's
performance issues, and integrates natively with VSCode.

### The friction problem

Despite `debugpy` being available, **adoption in the team is low**.
Anecdotal usage survey: developers prefer `print()` or `breakpoint()` to
configuring a debug session. The reason is **not technical** — it is
cognitive friction:

1. The developer has to remember the exact CLI flag (`--debugpy` and
   optional `--debugpy-port`).
2. The server has to be started from a terminal (not from VSCode "Run").
3. VSCode "Run and Debug" requires manually creating an "attach"
   configuration with the right host and port.
4. Only after all of the above can the developer reproduce the bug in
   the browser.

Each step is small. Together they cost enough attention that a `print`
statement wins. The result: a powerful, fast, modern debugger sits
unused in the team's toolbox.

### What we want

The Genropy Debug module reduces the entire flow to **one command**:

> Command Palette → "Genropy: Start Debug Session" → choose instance →
> server starts, debugger attaches, status bar lights up.

After that, the developer:

- sets breakpoints in code (gutter click, or `breakpoint()` in source)
- reproduces the bug in the browser
- inspects locals, evaluates expressions, steps through code

When the session is over:

> Command Palette → "Genropy: Stop Debug Session" → server stops, debugger
> detaches.

Or simply close VSCode — the extension cleans up on `deactivate`.

The expected effect: developers actually *use* the debugger, because it
costs about as much attention as `print('here')`. Combined with the
removal of the legacy debugger (no longer competing for mindshare), this
becomes the **single, obvious way** to debug a GenroPy app.

### Why in Sourcerer Visual specifically

The team has historically used a separate, older VSCode extension for
GenroPy-related shortcuts and highlights. That extension is in
maintenance-only mode and will eventually be deprecated.

Sourcerer Visual is the **current strategic extension**: cleanly
structured, in active development, the natural home for new features
that bind together GenroPy code, the Sourcerer Knowledge Base, and the
developer's editor. Adding Genropy Debug here:

- gives the team a single growing extension instead of two diverging
  ones,
- creates natural synergies (e.g. "Ask Sourcerer about this frame" while
  paused on a breakpoint, see Future Directions below),
- reinforces the message that Sourcerer Visual is **the** GenroPy
  developer companion in VSCode.

The legacy extension can keep its remaining role (highlights, shortcuts)
until those are migrated into Sourcerer Visual.

## Goals

In scope for the first iteration:

1. Add the commands `Sourcerer: Start GenroPy Debug` and
   `Sourcerer: Stop GenroPy Debug` to the command palette and to a
   sidebar / status bar entry point.
2. The Start command:
   - asks the user for the GenroPy instance to run (or uses a remembered
     default),
   - launches `gnr web stack -i <instance> --debugpy [--debugpy-port N]`
     in a VSCode integrated terminal as a managed task,
   - waits for `debugpy` to be in listening state,
   - calls `vscode.debug.startDebugging` with an attach configuration
     pointing at the listening port,
   - updates a status bar item to show the active session.
3. The Stop command:
   - detaches the debug session (`vscode.debug.stopDebugging` of the
     known active session),
   - terminates the spawned task,
   - clears the status bar entry,
   - frees the chosen port.
4. Persist the last-used instance and port in `workspaceState`, so
   restarting the session is even faster.
5. Surface meaningful errors in a dedicated `OutputChannel`
   (`Sourcerer Debug`): server failed to start, port already in use,
   debugpy did not become ready, etc.

Explicit non-goals for the first iteration (Future Directions):

- Remote debugging against a production-like server (covered separately,
  see "Remote sessions" in Future Directions).
- "Ask Sourcerer about this frame" while paused on a breakpoint
  (synergy with KB, deferred to a second iteration).
- Migration of features from the legacy extension (highlights,
  shortcuts).

## Alternatives considered

### A. Committed `.vscode/launch.json` in the GenroPy framework repo

Approach: ship a `launch.json` alongside the GenroPy framework with a
ready-made attach configuration; document it in the README. Developers
clone, press F5, get attached.

Pros: zero code, zero new dependencies, works in any IDE that respects
`launch.json`.

Cons: still requires the developer to remember to first start the server
with `--debugpy` in a separate terminal; the configuration is not aware
of which GenroPy instance is currently being worked on; `launch.json`
ships in a Python framework repo where it feels misplaced; per-instance
configuration ends up duplicated or hardcoded.

Verdict: **viable as a fallback**, will likely be added too, but not a
substitute for the integrated extension flow.

### B. A new dedicated VSCode extension for debugging only

Approach: a brand-new extension `genropy-debugger`, single purpose,
distributed alongside Sourcerer Visual.

Pros: clean separation of concerns.

Cons: doubles the maintenance surface; loses the synergy with the
Sourcerer KB; spreads the "one place to install for GenroPy in VSCode"
message across multiple extensions, making team adoption harder.

Verdict: rejected. The integration cost in Sourcerer Visual is small
enough that splitting is not worth it.

### C. Add the feature to the legacy GenroPy extension

Approach: add the commands to the existing legacy extension, which is
already installed across the team.

Pros: instant distribution, no new install needed.

Cons: the legacy extension is in maintenance mode, the codebase is not
where we want to invest, and adding modern features there sends the
opposite signal of what the team's direction is. Distribution is not a
real blocker for Sourcerer Visual either: an internal `.vsix` install
takes one command per developer.

Verdict: rejected.

## Proposed architecture

### File layout addition

The new module lives entirely under `src/debug/`, paralleling the
existing structure (`src/api/`, `src/kb/`, `src/config/`, etc.):

```
src/debug/
├── debugCommands.ts     # registers Start/Stop commands; entry point
├── debugLauncher.ts     # spawns the gnr task and waits for readiness
├── debugAttacher.ts     # builds attach config and calls VSCode Debug API
├── debugSession.ts      # tracks the active session state (1 at a time)
├── debugStatusBar.ts    # updates the status bar item
├── debugOutput.ts       # OutputChannel wrapper
└── settings.ts          # debug-specific settings reader (debug.port range, default instance, etc.)
```

The single source of truth for "is a debug session active" is the
`debugSession.ts` module — a small in-memory state machine
(`idle | starting | attached | stopping`) used by every other piece.

### Activation

The extension's `package.json` `activationEvents` already supports
on-command activation (VSCode 1.85+ infers this from `contributes`).
Adding the new commands automatically wires activation. No other
activation event needed.

### `extension.ts` integration

The `activate(context)` function gains a single line:

```ts
import { registerDebugCommands } from './debug/debugCommands';
// ...
registerDebugCommands(context, sourcererClient, settings, logger);
```

The debug module does not need the `SourcererClient` for the first
iteration, but the parameter is reserved for the future "Ask about this
frame" synergy.

### `package.json` contributions

Three new commands:

```json
{
  "command": "sourcerer.debug.start",
  "title": "Sourcerer: Start GenroPy Debug",
  "icon": "$(debug-start)"
},
{
  "command": "sourcerer.debug.stop",
  "title": "Sourcerer: Stop GenroPy Debug",
  "icon": "$(debug-stop)"
},
{
  "command": "sourcerer.debug.restart",
  "title": "Sourcerer: Restart GenroPy Debug",
  "icon": "$(debug-restart)"
}
```

Optional "view container" contributions (later iteration): a "Debug"
section in the Sourcerer activity bar showing the active session, the
last few logs, breakpoints summary, etc.

New settings under `sourcerer.debug.*`:

```json
{
  "sourcerer.debug.defaultInstance": {
    "type": "string",
    "default": "",
    "description": "Default GenroPy instance for debug sessions. If empty, the user is asked each time."
  },
  "sourcerer.debug.port": {
    "type": "number",
    "default": 5678,
    "description": "Port on which debugpy listens. Defaults to 5678 (the debugpy default)."
  },
  "sourcerer.debug.serverPort": {
    "type": "number",
    "default": 8080,
    "description": "Port on which the dev web server listens."
  },
  "sourcerer.debug.justMyCode": {
    "type": "boolean",
    "default": false,
    "description": "Whether the debugger should step only through user code (true) or also into framework code (false). Defaults to false because GenroPy debugging often involves framework internals."
  },
  "sourcerer.debug.serverCommand": {
    "type": "string",
    "default": "gnr",
    "description": "Path or alias of the gnr CLI. Override if 'gnr' is not on PATH."
  }
}
```

### The Start flow, step by step

1. **Pre-flight check**: confirm there is no active session
   (`debugSession.state === 'idle'`). Otherwise show "session already
   running, stop it first" and exit.
2. **Resolve instance**: if `sourcerer.debug.defaultInstance` is set,
   use it. Otherwise show a `vscode.window.showInputBox` (or
   `showQuickPick` if we can enumerate instances from the workspace
   somehow) and remember the answer in `workspaceState`.
3. **Resolve ports**: read `sourcerer.debug.port` and
   `sourcerer.debug.serverPort`. Optionally probe the ports for
   availability and warn the user if they are taken.
4. **Spawn the task**: build the command line:
   ```
   gnr web stack -i <instance> -p <serverPort> --debugpy --debugpy-port <port>
   ```
   Use `vscode.tasks.executeTask` with a `ShellExecution`. Mark the task
   as `presentationOptions: { reveal: 'silent' }` so it does not steal
   focus, but write output to the integrated terminal so the developer
   can see it if needed. Save the `TaskExecution` in
   `debugSession.state`.
5. **Wait for readiness**: poll either by reading task output (looking
   for the line "Debugpy on port ..." that GenroPy already logs in
   `serverwsgi.py`) or by attempting a TCP connect to
   `localhost:<port>` until success. Timeout after, say, 30 seconds. If
   the timeout elapses, kill the task, surface error, exit.
6. **Attach the debugger**: call
   ```ts
   await vscode.debug.startDebugging(undefined, {
     name: 'GenroPy Debug',
     type: 'debugpy',
     request: 'attach',
     connect: { host: 'localhost', port: <port> },
     justMyCode: <setting>,
     pathMappings: [{
       localRoot: '${workspaceFolder}',
       remoteRoot: '${workspaceFolder}'
     }]
   });
   ```
   The `pathMappings` is conservative — local and remote paths are the
   same in dev mode but we ship the field for clarity. The `type` is
   `'debugpy'` (the modern debugger type) which requires the user has
   the official Python or Python Debugger extension installed; we
   declare it as an `extensionDependencies` entry in `package.json` so
   VSCode prompts the install on first run.
7. **Register session listener**: subscribe to
   `vscode.debug.onDidTerminateDebugSession`. When VSCode tells us the
   debug session ended, transition our state to `stopping`, clean up
   the task and the status bar.
8. **Update UI**: status bar shows
   `$(debug-alt) GenroPy debug: <instance>:<port>` with a click action
   that runs the Stop command.

### The Stop flow

1. If there is no active session, no-op.
2. Detach: call `vscode.debug.stopDebugging(activeDebugSession)` — VSCode
   sends DAP `disconnect` and tears down the session.
3. Terminate the task: `taskExecution.terminate()`. Wait briefly for it
   to actually exit, log if it does not.
4. Clear status bar.
5. Reset `debugSession.state` to `idle`.

### The Restart flow

Convenience: Stop + Start with the same parameters. Useful when the dev
changes server-side code that requires a reload. Note that the dev
server's own `--reload` is automatically disabled when `--debugpy` is
on (this is correct — see `serverwsgi.py:320`); the developer manually
restarts via this command.

### Error handling

All errors flow through the `Sourcerer Debug` `OutputChannel` and
through `vscode.window.showErrorMessage` for the most relevant cases.
The error categories the user is likely to hit:

- **`gnr` command not found**: surface clearly, suggest the
  `sourcerer.debug.serverCommand` setting and explain the PATH issue.
- **Port already in use**: surface, suggest either changing the port in
  settings or killing the colliding process.
- **Debugpy did not become ready in time**: kill the task, surface the
  last 10 lines of task output to help diagnose.
- **VSCode debug attach failed**: surface the underlying error from the
  Debug API, suggest checking the Python extension is installed.
- **No GenroPy instance found / wrong instance**: surface the gnr CLI
  error output as-is; the GenroPy CLI usually has clear messages.

### Lifecycle and cleanup

The extension's `deactivate()` function calls `debugSession.stop()`
synchronously — when VSCode closes, we make sure no spawned `gnr` task
is left running.

## Future Directions

These are deliberately out of scope for the first iteration but make
sense as natural follow-ups.

### Remote debug sessions (production-like)

For the rare but real case of a bug that only reproduces in a
production-like environment, the extension could add a
`Sourcerer: Start GenroPy Remote Debug Session` command:

1. Use VSCode Remote-SSH (assumed already configured) to run the same
   Start flow on the remote host.
2. Help the developer set the `gnr_debug` cookie in their browser by
   showing a one-shot UI widget.
3. Show the nginx routing snippet that needs to be enabled on the
   remote host (commented in production by default, enabled on demand).

This is documented separately in the GenroPy framework's
`docs/operations/debug-in-prod.md` and corresponds to a deployment-side
nginx + cookie pattern. The extension's role would only be the developer
ergonomics around it.

### "Ask Sourcerer about this frame"

When the debugger is paused on a breakpoint, the extension could expose
a contextual command:

> Right-click in the editor → "Sourcerer: Ask about this frame"

It would gather:
- the file path and line where execution is paused,
- the current frame's local variables (filtered/redacted appropriately),
- the call stack,

and send it to the Sourcerer Knowledge Base as a contextualized query.
The response — possibly relevant skills, recent commits in this code
area, similar past incidents — appears in a side panel.

This is where the "Genropy Debug" + "Sourcerer KB" combination becomes
strictly more valuable than either feature alone.

### Migration of legacy extension features

Highlights and shortcuts currently provided by the legacy GenroPy
extension can be migrated to Sourcerer Visual incrementally. Once the
parity is sufficient, the legacy extension is deprecated and the team
moves to Sourcerer Visual as the single GenroPy companion.

## Testing strategy

The first iteration adds these test categories under `test/suite/debug/`:

- **Unit tests** of the readiness polling logic (mocked TCP).
- **Unit tests** of the state machine (idle → starting → attached →
  stopping → idle).
- **Integration test** that spawns a fake `gnr web stack --debugpy`
  process (a small Python helper that just opens a port and prints the
  expected log line), runs the Start flow, asserts the attach happened,
  runs Stop, asserts cleanup.
- **Smoke test** in the Extension Development Host: load the extension,
  open a small GenroPy project (or a fixture), run Start, observe state
  bar, run Stop, observe cleanup.

The full end-to-end test against a real GenroPy instance is expected to
be done **manually** by the implementer before merging — automated
end-to-end is out of scope because it requires a full GenroPy install in
CI.

## Acceptance criteria for v0.1

- The two main commands appear in the command palette.
- Starting a debug session on a working GenroPy instance succeeds: server
  is up, breakpoint is hit, locals are inspectable.
- Stopping the session cleans up: no orphan `gnr` process, no leftover
  status bar item.
- Restart works as Stop + Start.
- Errors are surfaced clearly in the output channel and as
  `showErrorMessage`.
- Settings are honored.
- The extension's existing functionality (KB Explorer, search, etc.) is
  not affected.

## Open questions

These are flagged for discussion before implementation begins:

1. **Discovery of GenroPy instances**: should the Start command
   enumerate available instances (parsing `~/.gnr` or wherever instance
   configurations live) and offer a `QuickPick`, or stick with a free
   text input? Enumeration is more user-friendly but couples the
   extension to GenroPy's instance discovery logic.
2. **Multiple sessions**: the design assumes one debug session at a
   time. Is multi-session ever needed? (For most workflows, no.)
3. **Port collision handling**: should the extension auto-pick a free
   port from a range when the configured port is in use, or require the
   user to fix the conflict? Auto-pick is friendlier; explicit is more
   predictable.
4. **Status bar vs. dedicated view**: is a status bar item enough, or
   should there also be a small "Debug" view in the Sourcerer sidebar
   with logs and quick actions? The status bar is enough for v0.1; the
   view is a v0.2 enhancement.

## References

- GenroPy framework: `--debugpy` wiring in `gnrpy/gnr/web/serverwsgi.py`,
  `gnrpy/gnr/web/gnrwsgisite.py`, and the JS-side workaround in
  `gnrjs/gnr_d20/js/genro_rpc.js`.
- VSCode Debug API:
  https://code.visualstudio.com/api/extension-guides/debugger-extension
- VSCode Tasks API:
  https://code.visualstudio.com/api/extension-guides/task-provider
- debugpy:
  https://github.com/microsoft/debugpy
- Debug Adapter Protocol:
  https://microsoft.github.io/debug-adapter-protocol/
