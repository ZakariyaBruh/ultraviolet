#!/bin/bash
# the new hook, in chunks so it can be watched and resumed (one Blender process per chunk). 186 frames, 1440x810.
B=/tmp/claude-0/blender/blender-4.5.15-linux-x64/blender
S=/home/user/ultraviolet/video/blender/hook6.py
O=/home/user/ultraviolet/video/public/v6/hook
mkdir -p $O
for a in $(seq 1 31 186); do
  b=$((a+30)); [ $b -gt 186 ] && b=186
  [ -f $O/h_$(printf "%04d" $b).png ] && continue
  nice -n 8 $B -b -P $S -- $a $b $O 1440 810 7 > /tmp/claude-0/hk/chunk_$a.log 2>&1
  echo "chunk $a-$b $(date +%T)" >> /tmp/claude-0/hk/progress.log
done
echo done >> /tmp/claude-0/hk/progress.log
