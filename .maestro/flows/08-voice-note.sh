#!/bin/bash
# TC26–TC28. Maestro cannot speak, so this plays a spoken note through the
# Mac's speakers while the simulator records from the Mac's microphone.
# Needs the Mac's volume up and the simulator allowed to use the microphone.
#
# WARNING: the simulator records whatever the Mac's microphone hears. Run this
# only in a quiet room, or it transcribes and saves nearby conversation into
# the test account (and sends it to OpenAI) instead of the line below.
set -euo pipefail
cd "$(dirname "$0")"
MAESTRO=${MAESTRO:-maestro}
$MAESTRO test voice/start-recording.yaml "$@"
sleep 1
say -r 160 "I'm completely hooked on this book. There's this line on page twelve: we were all lost lambs once. It made me think about my own sisters."
sleep 1
$MAESTRO test voice/stop-and-save.yaml "$@"
