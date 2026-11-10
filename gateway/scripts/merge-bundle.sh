#!/bin/sh
# Verifies the pulled published bundle with the committed production key, then
# re-signs it with the decision-log mask added. OPA loads only a signed bundle,
# and the published bundle's root covers the whole data document, so the mask
# cannot ride alongside it as a second bundle.
set -eu

PUBLISHED=${1:?published bundle path}
VERIFICATION_KEY=${2:?published verification key}
MASK=${3:?mask rule path}
SIGNING_KEY=${4:?ephemeral signing key}
OUT=${5:?output bundle path}

opa build -b --verification-key "$VERIFICATION_KEY" --signing-alg ES256 -o /dev/null "$PUBLISHED"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

tar -xzf "$PUBLISHED" -C "$WORK"
rm -f "$WORK/.signatures.json" "$WORK/.manifest"
mkdir -p "$WORK/system/log"
cp "$MASK" "$WORK/system/log/mask.rego"

opa build -b --signing-key "$SIGNING_KEY" --signing-alg ES256 -o "$OUT" "$WORK"
