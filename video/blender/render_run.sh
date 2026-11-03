#!/bin/bash
# Renders the dial shot frame by frame (resumable). Usage: render_run.sh [first] [last]
B=/tmp/claude-0/blender/blender-4.5.15-linux-x64/blender
S=/home/user/ultraviolet/video/blender/knob.py
O=/home/user/ultraviolet/video/public/v4/run
mkdir -p $O
[ -f $O/top.png ] || nice -n 12 $B -b -P $S -- top 1 1024 1024 48 $O/top.png > /dev/null 2>&1
for f in $(seq ${1:-1} ${2:-222}); do
  n=$(printf "%04d" $f)
  [ -f $O/f$n.png ] && continue
  nice -n 12 $B -b -P $S -- run $f 1280 720 14 $O/f$n.png > /tmp/claude-0/bl/last.log 2>&1
  echo "$f $(date +%T)" >> /tmp/claude-0/bl/progress.log
done
echo done >> /tmp/claude-0/bl/progress.log
