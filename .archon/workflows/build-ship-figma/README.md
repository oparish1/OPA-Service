# archon-ship-figma

A variation of `archon-ship` where an approved Figma high-fidelity prototype
and its linked design system dictate any UI the workflow's delivery produces,
instead of letting the implementing agent invent it. Everything triage,
investigate, plan, implement, pr, review and validate already do in the
[`sdlc` pack](https://github.com/coleam00/Archon/tree/dev/.archon/workflows/sdlc)
is unmodified here — this adds one advisory node (`figma-ground`) and one
deterministic gate (`gate-design`) in front of the existing, unmodified
`archon-deliver`.

**Assumptions flagged up front.** I built this against the four `sdlc` pack
files you shared earlier in this conversation (`archon-ship.yaml`,
`archon-triage.yaml`, `archon-deliver.yaml` and `.shared/io.ts`) and the
`figma-driven-ui-ux` skill you just uploaded. I have not seen the Archon
workflow engine's own source, so two things below are inferred by analogy
rather than verified against the engine and are called out again where they
matter: the `requires: [figma]` declaration and the exact resolution rule
for where a `script:` node's named target file lives. If your Archon version
disagrees with either, the fixes are small and are noted inline.

## What this adds, precisely

| | archon-ship | archon-ship-figma |
|---|---|---|
| Triage, investigate, plan | unchanged | unchanged |
| Before delivery | three route gates only | same three gates, **plus** `figma-ground` → `gate-design` |
| Delivery | `archon-deliver`, unmodified | `archon-deliver`, unmodified — only the `work` text passed to it changes |
| New inputs | — | `figma_frame`, `design_system` |
| New requirement | `github` | `github`, `figma` |

`figma-ground` runs once delivery would otherwise start (after whichever of
the three route gates fired), reads the accepted work order and — only when
that work actually has a UI surface — audits the Figma frame and its design
system, maps every visible element to a design-system component and writes
`design-brief.md`. `gate-design` then either lets delivery proceed or refuses
with the exact open questions, the same way `archon-triage`'s `BLOCKED` or
`archon-plan`'s `ready: false` already stop this pack rather than guessing.
Work with no UI surface (an API-only change, a background job) is detected in
`figma-ground`'s first step and skips Figma entirely — the run behaves exactly
like plain `archon-ship`.

## 1. Where these files go

Place this pack's `ship-figma/` directory **inside your existing `sdlc` pack**,
as a sibling of `triage/`, `plan/`, `deliver/` and so on — not as a separate
top-level pack. It needs to sit there to reuse `.shared/io.ts` and
`.shared/report.ts` by the same relative path (`../../.shared/...`) every
other component in the pack already uses and to `include:` the pack's other
workflows by name.

```
.archon/workflows/sdlc/
├── .shared/                  # existing — unchanged
├── triage/                   # existing — unchanged
├── investigate/              # existing — unchanged
├── plan/                     # existing — unchanged
├── implement/                # existing — unchanged
├── validate/                 # existing — unchanged
├── pr/                       # existing — unchanged
├── review/                   # existing — unchanged
├── deliver/                  # existing — unchanged
├── ship/                     # existing — unchanged
├── upkeep/                   # existing — unchanged
└── ship-figma/                <-- new, from this deliverable
    ├── archon-ship-figma.yaml
    ├── commands/
    │   └── figma-ground.md
    └── scripts/
        ├── gate-design.ts
        └── outcome.ts
```

Copy the `ship-figma/` folder from this deliverable directly into
`.archon/workflows/sdlc/`. Nothing under `.shared/` or any other existing
component needs to change.

**Why `outcome.ts` is a straight copy of `ship/scripts/outcome.ts`, not a new
file.** `delivered` means the same thing whether or not a design brief was
involved — the deliver branch either ran and returned a PR, or an advisory
stop explains why not — so this workflow reuses the existing script unchanged
rather than forking its logic. If `ship/scripts/outcome.ts` changes upstream,
copy the new version into `ship-figma/scripts/outcome.ts` again.

The reference copy of your `figma-driven-ui-ux` skill is included in this
deliverable under `reference-skill/` for your own use in ad hoc chats. The
`figma-ground.md` command below is a **self-contained adaptation** of it for
this workflow, not a runtime reference to the skill file — I found no
evidence in the pack that the Archon workflow engine loads external skill
files into a `command:` node's prompt, so I did not assume it does. If your
Archon setup does support that, you can replace `figma-ground.md`'s body with
a pointer to the skill instead.

## 2. Connect the Figma MCP server

`figma-ground` needs a working Figma connection among its available tools
before it can audit anything. Set this up once, however your Archon
environment normally connects MCP servers — this pack's own `figma-ground.md`
checks for the connection and refuses cleanly (not silently) if it's missing,
so getting this step wrong fails safely rather than producing guessed UI.

**Get a Figma API key.** In Figma: Settings → Security → generate a personal
access token with read access. This authorizes the MCP server to read your
files; it does not need write access, since this workflow only ever reads
Figma.

**Then connect the server**, by whichever of these matches your setup:

- **Remote server (recommended for a hosted Archon run):**
  ```bash
  claude mcp add --scope user --transport http figma https://mcp.figma.com/mcp
  ```
  Drop `--scope user` to scope the connection to this project instead of
  globally.
- **Local server (if you run Archon against files open in the Figma desktop
  app):** enable Figma's local MCP server in the desktop app's preferences
  first, then connect to it the same way your Archon environment connects to
  any local MCP server.
- **Connector directory:** if your Archon environment exposes a connector
  picker, search for Figma there and connect it — this is generally the
  simplest path if it's available, since it handles the token exchange for
  you.

Provide the API key wherever that connection method asks for it (an
environment variable, a connector's own credential prompt, or the MCP
server's own configuration — this varies by how you host Archon, so check
your Archon environment's MCP documentation for the exact mechanism).

**`requires: [figma]` in the YAML.** `archon-ship.yaml` declares
`requires: [github]` and I've extended that pattern to
`requires: [github, figma]` on the assumption that the engine's `requires:`
mechanism accepts an arbitrary connector name and gates the run on it being
connected. I have not seen this verified for any value besides `github`. If
your Archon version rejects `figma` as an unrecognized `requires` entry,
delete `figma` from that list — the workflow still works, because
`figma-ground.md`'s Step 2 checks for a working connection itself and
declares `grounded: false` with a clear message when none exists, rather than
guessing.

## 3. New inputs

| Input | Default | Meaning |
|---|---|---|
| `figma_frame` | `""` | The approved high-fidelity frame — a Figma file or node URL. Required whenever the work has a UI surface; leave empty for backend-only work. |
| `design_system` | `""` | The Figma file for the linked design system, when it lives apart from `figma_frame`. Leave empty to let the run find the library the frame itself links to. |

`target`, `errors` and `publish` are unchanged from `archon-ship`.

**Getting the frame URL.** In Figma, right-click the top-level frame of the
approved prototype → Copy link. Paste that as `figma_frame`. Do the same for
the design-system file's page (or a representative frame in it) if it's a
separate file from the prototype.

## 4. Running it

Same invocation shape as `archon-ship`, with the two new inputs:

```
archon-ship-figma \
  target="<issue URL>" \
  figma_frame="<Figma frame URL>" \
  design_system="<Figma design-system file URL>"   # omit if it's linked from the frame
```

(I haven't verified the exact CLI flag syntax your Archon build uses — check
`archon workflow run --help` or your usual entry point; the input names above
match what the YAML declares regardless of how you pass them.)

## 5. Reading the result

Same terminal shape as `archon-ship`: `delivered` (boolean) plus a summary.
Two new ways a run can stop before delivery, both reported honestly rather
than as a failure with no explanation:

| What happened | Where to look | What to do |
|---|---|---|
| No UI in scope | `figma-ground` declared `ui_required: false` | Nothing — delivery ran normally. |
| UI in scope but not grounded | `gate-design` refused; message lists open questions | Resolve each question — in the Figma frame, the design system, or the issue itself — then rerun with the same inputs. |

`design-brief.md` in the run's artifacts is the full audit: every screen and
state found, the component mapping and both lists (open questions, unmapped
elements) verbatim. When delivery does run, its implementation report cites
this same file, so a reviewer can check the shipped UI against it directly.

## 6. What this does not do (possible future work)

- **No mid-run interactive Q&A.** `archon-deliver` has a `wait: { attention:
  ... }` node that pauses for a human to act on late CI red and then
  resumes — I considered reusing that same mechanism here so an operator
  could answer `figma-ground`'s open questions inline and have the run
  continue. I didn't build it because I have no verified example of the pack
  reading a free-form human answer back into structured node output; the
  `ci-attention` case only re-probes an external CI state, it doesn't ingest
  new content. Until that's confirmed, this pack uses the safer, already-
  verified pattern instead: stop, name the question, let a person resolve it
  at the source, rerun.
- **No design-specific review lens.** `archon-review`'s lenses (code, seams,
  simplify, tests, errors, docs) are unmodified and know nothing about
  `design-brief.md`. Fidelity checking currently happens only in
  `figma-ground` before delivery and in whatever a human reviewer checks by
  eye against the linked frame. A `review-design` lens that diffs the shipped
  UI against `design-brief.md` would need changes inside `archon-review`
  itself, which this variation deliberately left untouched.
- **No fixtures.** The `sdlc` pack's own README states its test for whether
  something is a real guard: "if this pack's fixture suite cannot exercise
  the guard, it is not a guard." `gate-design` is written to pass that test —
  it protects delivery's spend on a question `figma-ground` asked and could
  not get answered — but I did not have the pack's dry-run engine available
  to write and run `.stubs.yaml` fixtures against it. Before relying on this
  in production, add fixtures for `figma-ground` and `gate-design` mirroring
  the shape of `sdlc/triage/fixtures/blocked.stubs.yaml` and
  `sdlc/plan/fixtures/blocked.stubs.yaml`.
