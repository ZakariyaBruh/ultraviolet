// tsfr <sf2> <preset> <events.txt> <seconds> <out.f32>   events: "start dur key vel" per line; renders stereo float32 at 48 kHz
#define TSF_IMPLEMENTATION
#include "../tsf.h"
#include <stdio.h>
#include <stdlib.h>
typedef struct { long on, off; int key; float vel; } Ev;
static int cmp(const void* a, const void* b){ return (int)(((Ev*)a)->on - ((Ev*)b)->on); }
int main(int argc, char** argv){
  const int SR = 48000;
  tsf* f = tsf_load_filename(argv[1]); if(!f){ fprintf(stderr,"sf2\n"); return 1; }
  int preset = atoi(argv[2]); double secs = atof(argv[4]);
  tsf_set_output(f, TSF_STEREO_INTERLEAVED, SR, 0);
  FILE* e = fopen(argv[3], "r"); Ev* ev = malloc(sizeof(Ev) * 20000); int n = 0; double s, d, k, v;
  while (fscanf(e, "%lf %lf %lf %lf", &s, &d, &k, &v) == 4) { ev[n].on = (long)(s * SR); ev[n].off = (long)((s + d) * SR); ev[n].key = (int)k; ev[n].vel = (float)v; n++; }
  fclose(e); qsort(ev, n, sizeof(Ev), cmp);
  long total = (long)(secs * SR); float* out = calloc(total * 2, sizeof(float));
  // offs: a second list sorted by off time
  Ev* offs = malloc(sizeof(Ev) * n); for (int i = 0; i < n; i++) offs[i] = ev[i];
  int io = 0, ioff = 0;
  // sort offs by off
  for (int i = 1; i < n; i++) { Ev t = offs[i]; int j = i - 1; while (j >= 0 && offs[j].off > t.off) { offs[j+1] = offs[j]; j--; } offs[j+1] = t; }
  long pos = 0; const int B = 64;
  while (pos < total) {
    while (io < n && ev[io].on <= pos) { tsf_note_on(f, preset, ev[io].key, ev[io].vel); io++; }
    while (ioff < n && offs[ioff].off <= pos) { tsf_note_off(f, preset, offs[ioff].key); ioff++; }
    int cnt = (total - pos < B) ? (int)(total - pos) : B;
    tsf_render_float(f, out + pos * 2, cnt, 0);
    pos += cnt;
  }
  FILE* o = fopen(argv[5], "wb"); fwrite(out, sizeof(float), total * 2, o); fclose(o);
  return 0;
}
