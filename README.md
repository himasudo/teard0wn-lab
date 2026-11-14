# teard0wn lab

**Take systems apart. Understand every layer.**

An original systems and security learning environment, with [Memory Systems Lab](https://himasudo.github.io/memory-system-interactive/) as its prerequisite.

## Current release: 0.1

This is the foundation release, not the completed advanced curriculum.

- 12 runnable lessons with original explanations, editable assembly, graded experiments, hints, worked solutions, and questions.
- A real-byte x86-64 assembler and a bounded teaching executor: registers, flags, memory, source mapping, address breakpoints, write watchpoints, single stepping, and reverse stepping.
- A 22-track curriculum retaining the 12 tracks in the project brief and adding 10 systems/research tracks. Future units are clearly labeled as planned.
- Dark/light themes, responsive lesson/workbench views, local progress and source persistence, and JSON export/import.
- No account, server runtime, external scripts, analytics, or runtime package dependency.

The engine executes its documented x86-64 subset. It is not a full CPU, Linux VM, native GDB, or browser C compiler. System calls are modeled, hardware timing is not measured, and privileged/advanced labs need separate future runtimes. See [the engine contract](docs/ENGINE.md).

## Open locally

With Python 3:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000`. No install or build step is needed for the modular site. Use HTTP for the modular version; browser module imports are not reliable under `file://`.

For a portable single HTML file:

```sh
python3 build.py
```

Open `dist/teard0wn-lab.html`. This generated build embeds code, CSS, and the logo and uses CSP content hashes. Edit `src/`, not the generated file. Source/reference links in the standalone file require the accompanying project folder or an HTTP deployment.

## GitHub Pages

The public repository is [himasudo/teard0wn-lab](https://github.com/himasudo/teard0wn-lab). Once the **Verify lab** workflow passes, choose **Settings → Pages → Deploy from a branch → main → /(root)**. The `.nojekyll` file makes this a plain static site. No custom domain or paid service is required.

The intended project URL is `https://himasudo.github.io/teard0wn-lab/`; its presence here is not a claim that deployment has completed.

The optional bootstrap publisher is for a **new repository with another name**, using an already authenticated GitHub CLI. Do not run it against the existing `teard0wn-lab` repository:

```sh
python3 publish.py --owner YOUR_GITHUB_LOGIN --repo YOUR_NEW_REPOSITORY
```

The publisher creates the named public repository, initializes/commits this folder if necessary, pushes without force, and enables branch-based Pages. It refuses to adopt an unrelated existing repository. Read [deployment details](docs/DEPLOYMENT.md) before using it.

## Checks

Node 22+ is sufficient for engine and lesson tests:

```sh
npm test
```

On Linux x86-64 with GCC and Node:

```sh
python3 tests/native_check.py
```

This executes only repository-authored, bounded fixtures and compares the emitted machine-code bytes against a native x86-64 process. Registers and defined flags are compared; undefined flags are not assigned invented expectations. Actual host stack addresses are not expected to equal model addresses.

Rendered browser checks require Playwright. It is a development-only tool:

```sh
npm install --no-save playwright@1.62.1
npx playwright install chromium
npm run test:browser
```

Set `BROWSER_BINARY` to an existing Chromium executable when needed. Tests create a fresh profile and local HTTP server. They never inspect a signed-in browser. Screenshots and reports go into ignored `test-results/`.

## Source map

| Path | Purpose |
| --- | --- |
| `src/machine.js` | Assembler, instruction decoder, execution, history |
| `src/lessons.js` | Original explanations, exercises, fixtures, verification |
| `src/curriculum.js` | Full track scope and prerequisites |
| `src/app.js` | Routing, editor/debugger UI, local progress |
| `src/styles.css` | Responsive themes and layouts |
| `native/` | Companion native C investigations |
| `tests/` | Engine, lesson, native differential, and browser checks |
| `docs/CURRICULUM.md` | Coverage ledger and staged delivery |
| `docs/ENGINE.md` | Supported semantics and explicit limits |
| `docs/HANDOFF.md` | Continuation state and outstanding work |

## Learning standards

Each new lab needs a clear contract, first-principles explanation, an inspectable experiment, failure/boundary cases, staged hints, an explained solution, and primary references. Mark a unit runnable only when the full lesson and execution path work. Topic names or empty cards do not count as delivered course content.

The local verifier is transparent self-study feedback, not secure assessment. The code and checks are visible. No proprietary lesson text, branding, or challenges have been copied from another platform.

MIT licensed. References retain their respective owners' rights.
