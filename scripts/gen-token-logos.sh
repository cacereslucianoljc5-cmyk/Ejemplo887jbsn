#!/usr/bin/env bash
# Pre-generate a unique logo per token using Pollinations.ai (free, no API key)
# — same engine AgentHood uses. Saves PNGs into public/tokens/.
set -u
OUT="public/tokens"
mkdir -p "$OUT"

STYLE="flat vector mascot emblem logo, bold thick black outlines, bright acid lime green and black, solid off-white background, centered, minimalist sticker, no text, no letters, high contrast, crypto coin logo"

# ticker | seed | subject
ROWS=(
  "PERCH|11|a robin bird perched on a small branch"
  "FLDG|12|a cute fluffy baby bird chick hatching"
  "LARK|13|a skylark songbird singing with music notes"
  "QUIV|14|a quiver full of arrows, robin hood style"
  "TALON|15|a sharp eagle talon claw grabbing"
  "DOWN|16|a soft fluffy down feather"
  "WREN|17|a tiny round wren bird"
  "ROOST|18|a bird roosting on a perch at night with a moon"
  "PLUME|19|an elegant curved feather plume"
  "SWIFT|20|a fast swift bird diving in flight, motion lines"
  "KSTR|21|a fierce kestrel falcon head"
  "FTHR|22|a single detailed feather"
  "QUILL|23|a quill pen feather with an ink drop"
  "TLNH|24|an eagle wearing a small robin hood hat"
  "NEST|25|a cozy bird nest with three eggs"
  "AERIE|26|a majestic eagle nest high on a cliff"
  "GLIDE|27|a bird gliding with wings spread wide"
  "UP|28|an upward rocket made of feathers launching, arrow up"
)

fetch_one() {
  local ticker="$1" seed="$2" subj="$3"
  local prompt="$subj, $STYLE"
  local enc; enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$prompt")
  local url="https://image.pollinations.ai/prompt/${enc}?width=384&height=384&seed=${seed}&nologo=true&model=flux&referrer=fledge"
  for attempt in 1 2 3; do
    code=$(curl -s -o "$OUT/${ticker}.png" -w "%{http_code}" --max-time 90 "$url")
    if [ "$code" = "200" ] && [ -s "$OUT/${ticker}.png" ]; then
      echo "OK  ${ticker} (seed ${seed})"; return 0
    fi
    sleep $((attempt*2))
  done
  echo "FAIL ${ticker} (code ${code})"; return 1
}
export -f fetch_one
export OUT STYLE

printf '%s\n' "${ROWS[@]}" | \
  xargs -I{} -P 4 bash -c 'IFS="|" read -r t s d <<< "{}"; fetch_one "$t" "$s" "$d"'

echo "--- generated ---"
ls -la "$OUT"
