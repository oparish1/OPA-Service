#!/usr/bin/env python3
"""Compare env var NAMES the code reads with NAMES Vercel already has.
Never reads or prints values. Usage:
  python3 env_diff.py [app_dir] [--vercel-names names.txt]
If --vercel-names is omitted and the vercel CLI is linked+authed, it runs `vercel env ls`.
"""
import os, re, subprocess, sys

PUBLIC_PREFIXES = ("NEXT_PUBLIC_", "VITE_", "PUBLIC_", "REACT_APP_", "NUXT_PUBLIC_", "EXPO_PUBLIC_", "GATSBY_")
SECRETISH = re.compile(r"(SECRET|TOKEN|PASSWORD|PRIVATE|API_?KEY|SERVICE_ROLE|CREDENTIAL)", re.I)
PATTERNS = [re.compile(p) for p in (
    r"process\.env\.([A-Z][A-Z0-9_]*)",
    r"process\.env\[\s*['\"]([A-Z][A-Z0-9_]*)['\"]\s*\]",
    r"import\.meta\.env\.([A-Z][A-Z0-9_]*)",
    r"Deno\.env\.get\(\s*['\"]([A-Z][A-Z0-9_]*)['\"]",
)]
SKIP_DIRS = {"node_modules", ".git", ".next", ".vercel", "dist", "build", ".turbo", ".svelte-kit", ".nuxt", ".output", "coverage"}
EXTS = (".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro")
BUILTIN = {"NODE_ENV", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_REGION", "CI", "PORT", "MODE", "DEV", "PROD", "BASE_URL", "SSR"}

def code_names(root):
    found = {}
    for d, dirs, files in os.walk(root):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            if f.endswith(EXTS):
                p = os.path.join(d, f)
                try: text = open(p, encoding="utf-8", errors="ignore").read()
                except OSError: continue
                for rx in PATTERNS:
                    for m in rx.finditer(text):
                        found.setdefault(m.group(1), p)
    return {k: v for k, v in found.items() if k not in BUILTIN and not k.startswith("VERCEL_")}

def env_file_names(root):
    """Names declared in .env.example-style files (names only)."""
    names = set()
    for f in os.listdir(root):
        if re.match(r"\.env\.(example|sample|template)$", f):
            for line in open(os.path.join(root, f), encoding="utf-8", errors="ignore"):
                m = re.match(r"\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=", line)
                if m: names.add(m.group(1))
    return names

def vercel_names(path):
    if path:
        return {l.strip() for l in open(path) if l.strip()}
    try:
        out = subprocess.run(["vercel", "env", "ls"], capture_output=True, text=True, timeout=60)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None
    if out.returncode != 0: return None
    return set(re.findall(r"^\s*([A-Z][A-Z0-9_]*)\s", out.stdout, re.M))

def main():
    args = sys.argv[1:]
    names_file = None
    if "--vercel-names" in args:
        i = args.index("--vercel-names"); names_file = args[i + 1]; del args[i:i + 2]
    root = args[0] if args else "."
    code = code_names(root); declared = env_file_names(root)
    wanted = set(code) | declared
    have = vercel_names(names_file)
    print(f"Env var names the app references: {len(wanted)}")
    if have is None:
        print("Vercel names unavailable (not linked/authenticated). Listing wanted names only:")
        for n in sorted(wanted): print("  ", n)
    else:
        print(f"MISSING on Vercel ({len(wanted - have)}):")
        for n in sorted(wanted - have): print("  ", n, "" if n in code else "(from .env.example only)")
        print(f"PRESENT on Vercel ({len(wanted & have)}):", ", ".join(sorted(wanted & have)) or "none")
        print(f"ON VERCEL BUT NOT REFERENCED ({len(have - wanted)}):", ", ".join(sorted(have - wanted)) or "none")
    risky = sorted(n for n in wanted if n.startswith(PUBLIC_PREFIXES) and SECRETISH.search(n))
    if risky:
        print("\nWARNING: browser-exposed prefix on a secret-looking name (public in the bundle):")
        for n in risky: print("  ", n)
    return 0

if __name__ == "__main__":
    sys.exit(main())
