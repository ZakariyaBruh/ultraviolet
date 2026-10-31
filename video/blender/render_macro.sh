#!/bin/bash
# 1) the title's macro shot (46 frames), 2) the close-up of the hook re-rendered larger (frames 150-222). Resumable.
B=/tmp/claude-0/blender/blender-4.5.15-linux-x64/blender
S=/home/user/ultraviolet/video/blender/knob.py
M=/home/user/ultraviolet/video/public/v4/macro
H=/home/user/ultraviolet/video/public/v4/run_hq
mkdir -p $M $H
for f in $(seq 1 46); do
  n=$(printf "%04d" $f); [ -f $M/m$n.png ] && continue
  nice -n 10 $B -b -P $S -- macro $f 1600 900 14 $M/m$n.png > /dev/null 2>&1
  echo "macro $f $(date +%T)" >> /tmp/claude-0/bl/progress2.log
done
for f in $(seq 150 222); do
  n=$(printf "%04d" $f); [ -f $H/f$n.png ] && continue
  nice -n 10 $B -b -P $S -- run $f 1600 900 14 $H/f$n.png > /dev/null 2>&1
  echo "hq $f $(date +%T)" >> /tmp/claude-0/bl/progress2.log
done
echo done >> /tmp/claude-0/bl/progress2.log
