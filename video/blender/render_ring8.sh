#!/bin/bash
# the ring of tablets, in chunks so it can be watched and resumed. 120 frames, 1440x810, transparent.
B=/tmp/claude-0/blender/blender-4.5.15-linux-x64/blender
S=/home/user/ultraviolet/video/blender/ring8.py
O=/home/user/ultraviolet/video/public/v6/ring
mkdir -p $O /tmp/claude-0/rg
for a in $(seq 1 30 120); do
  b=$((a+29)); [ $b -gt 120 ] && b=120
  [ -f $O/r_$(printf "%04d" $b).png ] && continue
  nice -n 8 $B -b -P $S -- $a $b $O 1440 810 10 > /tmp/claude-0/rg/chunk_$a.log 2>&1
  echo "chunk $a-$b $(date +%T)" >> /tmp/claude-0/rg/progress.log
done
echo done >> /tmp/claude-0/rg/progress.log
