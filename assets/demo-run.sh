#!/bin/bash
# Demo wrapper — hides internal bun path for clean VHS recording
exec bun run dev -- --demo --print "$@" 2>/dev/null
