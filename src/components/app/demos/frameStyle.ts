/**
 * The stylesheet every AI generated demo is placed in. It is the app's own look in small: the same faces, hairlines, flat buttons and
 * condensed labels, and the same structural change each theme makes (Paper keylines and hard shadows, Phosphor double frames,
 * Blueprint dashed frames, Sunset pills). A demo only has to use these classes and the colour variables to look like part of the app.
 * api/demo.ts describes the same classes to the model, with sample markup; change them together.
 */
export const FRAME_VARS: [name: string, from: string, fallback: string][] = [
  ['--ink', '--ink', '#e8e8e8'], ['--ink2', '--ink-2', '#b0b0b0'], ['--ink3', '--ink-3', '#888'],
  ['--ground', '--ground', '#0b0d12'], ['--surface', '--surface', '#10131a'], ['--signal', '--signal', '#ffd23f'], ['--on-signal', '--on-signal', '#111'],
  ['--rule', '--rule', 'rgba(128,128,128,.4)'], ['--good', '--ok', '#2fbf71'], ['--bad', '--danger', '#e5484d'], ['--warn', '--warn', '#e0a100'], ['--ice', '--ice', '#4aa8d8'],
  ['--f-body', '--font-sans', 'system-ui,sans-serif'], ['--f-cond', '--font-cond', '"Arial Narrow",sans-serif'], ['--f-dot', '--font-dot', 'system-ui,sans-serif'],
]

export const FRAME_CSS = `
:root{--line:color-mix(in srgb,var(--ink) 30%,transparent);--wash:color-mix(in srgb,var(--ink) 9%,transparent)}
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:var(--ground);color:var(--ink);font:15px/1.4 var(--f-body);-webkit-text-size-adjust:100%;-webkit-font-smoothing:antialiased}
body{overflow:auto}
#app{display:flex;flex-direction:column;gap:10px;height:100%;min-height:0;padding:10px}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.col{display:flex;flex-direction:column;gap:8px;min-width:0}
.grow{flex:1;min-height:0;min-width:0}
.hud,label{font:600 13px/1.2 var(--f-cond);letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}
.big{font:600 clamp(22px,5vw,34px)/1.1 var(--f-dot);letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.fig,output{font-variant-numeric:tabular-nums}
.muted{color:var(--ink2)}
.ok{color:var(--good)}.bad{color:var(--bad)}.warn{color:var(--warn)}
.sep{border:0;border-top:1px solid var(--rule);margin:0}
.card{border:1px solid var(--rule);padding:8px 10px;min-width:0;background:color-mix(in srgb,var(--ink) 3%,transparent)}
.stage{position:relative;border:1px solid var(--rule);overflow:hidden;min-width:0;background:color-mix(in srgb,var(--ink) 3%,transparent)}
.stage::before,.stage::after{content:"";position:absolute;width:9px;height:9px;pointer-events:none;border:2px solid var(--signal)}
.stage::before{left:0;top:0;border-right:0;border-bottom:0}
.stage::after{right:0;bottom:0;border-left:0;border-top:0}
.stage>canvas,.stage>svg{display:block;width:100%;height:100%}
svg text{font-family:var(--f-body)}
.meter{height:10px;border:1px solid var(--line);min-width:60px;flex:1}
.meter>i{display:block;height:100%;width:0;background:var(--signal)}
.key{display:inline-block;width:10px;height:10px;margin-right:6px;background:var(--signal);vertical-align:-1px}
button{min-height:44px;padding:0 16px;font:600 14px/1 var(--f-body);color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:0;cursor:pointer;transition:background-color .15s ease-out,border-color .15s ease-out,transform .1s ease-out}
button:hover{background:var(--wash)}
button:active{transform:scale(.98)}
button.primary{background:var(--signal);color:var(--on-signal);border-color:var(--signal)}
button.primary:hover{background:var(--signal);filter:brightness(1.08)}
button[aria-pressed=true]{background:var(--ink);color:var(--ground);border-color:var(--ink)}
button:disabled{opacity:.4;cursor:default}
.seg{display:flex;flex-wrap:wrap}
.seg button+button{margin-left:-1px}
select,input[type=text],input[type=number]{min-height:44px;font:inherit;color:var(--ink);background:transparent;border:1px solid var(--line);border-radius:0;padding:0 10px;min-width:0}
select option{color:#111;background:#fff}
label.check{flex-direction:row;align-items:center;gap:8px;min-height:44px}
input[type=checkbox],input[type=radio]{accent-color:var(--signal);width:22px;height:22px;margin:0}
label{display:flex;flex-direction:column;gap:2px;min-width:0}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:44px;margin:0;background:transparent;accent-color:var(--signal)}
input[type=range]::-webkit-slider-runnable-track{height:2px;background:var(--line)}
input[type=range]::-moz-range-track{height:2px;background:var(--line)}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:28px;margin-top:-13px;background:var(--signal);border:0;border-radius:1px}
input[type=range]::-moz-range-thumb{width:14px;height:28px;background:var(--signal);border:0;border-radius:1px}
:focus-visible{outline:2px solid var(--signal);outline-offset:2px}
/* Paper, a manga page: heavy ink keylines and hard offset shadows */
html[data-theme=paper] #app{padding:10px 14px 14px 10px}
html[data-theme=paper] .card,html[data-theme=paper] .stage{border:0;background:var(--surface);box-shadow:0 0 0 2px var(--ink),4px 4px 0 var(--ink)}
html[data-theme=paper] .stage::before,html[data-theme=paper] .stage::after{display:none}
html[data-theme=paper] button{border:2px solid var(--ink);box-shadow:2px 2px 0 var(--ink)}
html[data-theme=paper] button:active{transform:translate(2px,2px);box-shadow:none}
html[data-theme=paper] .big{font-weight:400;text-transform:uppercase;letter-spacing:0}
/* Phosphor, a green terminal: double frames, everything capitals */
html[data-theme=phosphor] .card,html[data-theme=phosphor] .stage{border-color:var(--signal);box-shadow:inset 0 0 0 3px var(--ground),inset 0 0 0 4px var(--rule)}
html[data-theme=phosphor] .big{text-transform:uppercase}
/* Blueprint, a drafting sheet: ink frames with a dashed line inside */
html[data-theme=blueprint] .card,html[data-theme=blueprint] .stage{border:1px solid var(--ink);outline:1px dashed var(--ink);outline-offset:-4px;background:var(--ground)}
html[data-theme=blueprint] .big{font-weight:700;letter-spacing:.06em;text-transform:uppercase}
/* Sunset: round and soft */
html[data-theme=sunset] .card,html[data-theme=sunset] .stage{border-radius:16px;border-color:transparent;background:var(--surface)}
html[data-theme=sunset] .stage::before,html[data-theme=sunset] .stage::after{display:none}
html[data-theme=sunset] button,html[data-theme=sunset] select,html[data-theme=sunset] input[type=text],html[data-theme=sunset] input[type=number]{border-radius:999px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`
