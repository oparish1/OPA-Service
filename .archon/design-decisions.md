# Approved design decisions (binding for figma-ground and implementation)

These answer open questions. Treat each as resolved. Do not re-ask.

## Local-implementation components (counted as mapped)
These are built in the frontend from design tokens only, not added to the Figma design system. List them in component_mapping as "Local: <name>", not in unmapped_elements.
- **Notice:** tone = neutral | success | error. Icons: shield-check (neutral), circle-check (success), circle-alert (error). The Screen 7 token recovery banner is Notice tone=error containing AA/RecoveryResponse and its action buttons.
- **PublicFooter:** local frame as drawn. "Privacy" and "Terms" are AA/TextLink with href="#".
- **StepIndicator:** local frame as drawn. Steps are separated by a middle dot "·" in Body/13 grey.
- **Endpoint URL field:** read-only custom element, 44px height, 1px border, tokens only. Not AA/Form/Input; not editable.
- **CodeBlock:** wrapper for the code-surface style (IBM Plex Mono 14/22 on #F8F7F8). Used inside AA/ResponseCard and AA/TokenCard. Not used standalone at page level.

## States and behavior
- **API screens before "Run request":** show the ResponseCard shell with placeholder text "Run the request to see the response" (Body/14 grey). No auto-populated response.
- **Projects success body (after token refresh):** `{ "projects": [ { "id": "prj_01", "name": "Atlas", "status": "active" }, { "id": "prj_02", "name": "Beacon", "status": "active" }, { "id": "prj_03", "name": "Cedar", "status": "archived" } ] }`
- **Workspace selector:** the "Agentic Advantage" label and chevron are fully inert (no menu).
- **Help links ("Need help?", "Can't access your provider?"):** AA/TextLink with href="#" and no navigation.
- **Screen 1 height:** keep 1080px as drawn (viewport-filling split layout).
- **Profile API token-expired state:** reuse the Projects API 401 recovery treatment.
- **Copy:** icon swaps to check and label reads "Copied" for 2 seconds.
- **Token reveal:** toggles Reveal ⇄ Hide; resets to masked on session refresh and on leaving Overview.
- **Sign out:** navigates to Sign in and clears mock session state.
- **Headers tab:** three rows (status, content-type, date) from mock data.
- **Icons:** all Lucide React.

## Round 3 decisions (approved)

- **Organisation SSO row (ProviderRow):** AA/ProviderRow is a generic, props-driven component (icon, name, subtitle, badge tone and label, action label). All four rows are instances of it. The Microsoft, Okta and Google "Loaded" variants are presets; Organisation SSO is a fourth preset with a generic building-2 icon, subtitle "Organisation single sign-on", badge Tone=Neutral "Not connected", and a Connect button. No new Figma variant is needed.
- **"JSON · Pretty" label (ResponseCard):** static, non-interactive text. No Pretty/Raw toggle.
- **Select and Recovery select validation:** when submitted with no provider chosen, the field enters its Error state with the message "Choose an identity provider to continue." (Body/13, same Error styling as the email input).
- **"Documentation" sidebar link:** AA/TextLink with href="#", no navigation.
- **RequestPanel:** extract one shared RequestPanel component (HttpMethodBadge + endpoint URL field + TokenSelect + Run request button + View session link). Screen 6 uses it inline and AA/RecoveryResponse on Screen 7 renders the same component.

## Standing rules for anything else not drawn
These are approved defaults. Use them instead of adding an open question, and list each one used under "Assumptions" in the design brief:
- Network or unexpected failure on any action: Notice tone=error with "Something went wrong. Try again." and a Retry button.
- Mock latency: 400 to 1500 ms per request.
- Keyboard: tab order follows visual order; Enter submits forms; Escape closes open listboxes and returns focus to the trigger.
- Document titles: "<Screen name> · Your Identity".
- Layout: desktop only (1280px and up); no mobile or tablet.
- Any other undrawn state: use the nearest existing component variant and its tokens.
EOF