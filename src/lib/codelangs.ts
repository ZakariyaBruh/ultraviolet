import type { Engine } from './coderun'

/** The Code window's languages: what runs each one, how long a run may take once it has started, and a few examples to start from. */
export type LangId = 'python' | 'javascript' | 'typescript' | 'html' | 'sql' | 'bash' | 'cpp' | 'ruby' | 'lua' | 'php' | 'dos'
export interface Example { name: string; code: string; input?: string }
export interface Lang {
  id: LangId
  label: string
  /** the worker that runs it (null: HTML, shown in a frame instead) */
  engine: Engine | null
  /** the JavaScript worker runs TypeScript too, after stripping the types */
  sub?: 'ts'
  ext: string
  /** seconds a run may take after its engine has loaded */
  limit: number
  /** one plain line on where it runs and what it keeps */
  note: string
  /** whether programs in it read from the Input box */
  reads: boolean
  examples: Example[]
}

export const LANGS: Lang[] = [
  {
    id: 'python', label: 'Python', engine: 'py', ext: 'py', limit: 60, reads: true,
    note: 'Python 3.12 (Pyodide), about 6 MB from jsDelivr the first time. numpy, pandas and matplotlib load when you import them; turtle and matplotlib draw on the picture. Variables last until Stop.',
    examples: [
      { name: 'Start', code: '# Write Python and press Run (Ctrl + Enter).\nname = "Friction"\nfor i in range(3):\n    print(f"{i + 1}. Hello from {name}")\n' },
      { name: 'Read input', code: '# input() takes the next line of the Input box.\nname = input("Your name: ")\nage = int(input("Your age: "))\nprint(f"{name}, in ten years you\'ll be {age + 10}.")\n', input: 'Ada\n36\n' },
      { name: 'Plot', code: '# numpy and matplotlib load the first time (a few MB more).\nimport numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 2 * np.pi, 200)\nplt.plot(x, np.sin(x), label="sin")\nplt.plot(x, np.cos(x), label="cos")\nplt.title("Waves")\nplt.legend()\nplt.show()\n' },
      { name: 'Statistics', code: 'from statistics import mean, median, stdev\n\nscores = [72, 88, 95, 61, 79, 84]\nprint("mean  ", round(mean(scores), 1))\nprint("median", median(scores))\nprint("spread", round(stdev(scores), 1))\n' },
      { name: 'Turtle', code: '# Turtle graphics: it draws on the picture above the output.\nimport turtle as t\n\ncolours = ["red", "orange", "gold", "green", "blue", "purple"]\nt.width(2)\nfor i in range(72):\n    t.pencolor(colours[i % 6])\n    t.forward(i * 3)\n    t.left(59)\nt.done()\n' },
      { name: 'Canvas', code: '# The canvas is a 480 x 320 picture you can draw on directly.\nfrom js import canvas\nimport math\n\ng = canvas.getContext("2d")\nfor i in range(12):\n    g.fillStyle = f"hsl({i * 30} 80% 55%)"\n    a = i / 12 * 2 * math.pi\n    g.beginPath()\n    g.arc(240 + math.cos(a) * 110, 160 + math.sin(a) * 110, 20, 0, 2 * math.pi)\n    g.fill()\n' },
    ],
  },
  {
    id: 'javascript', label: 'JavaScript', engine: 'js', ext: 'js', limit: 20, reads: true,
    note: 'Runs in a worker of its own, fresh each time. prompt() takes the next line of the Input box; canvas is a picture to draw on.',
    examples: [
      { name: 'Start', code: '// Write JavaScript and press Run (Ctrl + Enter).\nconst days = [\'Mon\', \'Tue\', \'Wed\']\nfor (const [i, d] of days.entries()) console.log(`${i + 1}. ${d}`)\n' },
      { name: 'Read input', code: '// prompt() takes the next line of the Input box.\nconst name = prompt(\'Your name: \')\nconst n = Number(prompt(\'Pick a number: \'))\nconsole.log(`${name}, ${n} squared is ${n * n}.`)\n', input: 'Ada\n12\n' },
      { name: 'Await', code: '// Top-level await works here.\nconst wait = (ms) => new Promise((r) => setTimeout(r, ms))\nfor (let i = 3; i > 0; i--) {\n  console.log(i)\n  await wait(300)\n}\nconsole.log(\'Lift off\')\n' },
      { name: 'Canvas', code: '// canvas is a 480 x 320 picture above the output. This one moves for two seconds.\nconst g = canvas.getContext(\'2d\')\nfor (let f = 0; f < 60; f++) {\n  g.fillStyle = \'white\'\n  g.fillRect(0, 0, 480, 320)\n  for (let i = 0; i < 12; i++) {\n    const a = (i / 12) * 2 * Math.PI + f / 10\n    g.fillStyle = `hsl(${i * 30 + f * 4} 80% 55%)`\n    g.beginPath()\n    g.arc(240 + Math.cos(a) * 110, 160 + Math.sin(a) * 110, 18, 0, 2 * Math.PI)\n    g.fill()\n  }\n  await new Promise((r) => setTimeout(r, 33))\n}\n' },
    ],
  },
  {
    id: 'typescript', label: 'TypeScript', engine: 'js', sub: 'ts', ext: 'ts', limit: 20, reads: true,
    note: 'The types are stripped (Sucrase, from this site), not checked, then it runs as JavaScript.',
    examples: [
      { name: 'Start', code: 'interface Task { title: string; minutes: number }\n\nconst tasks: Task[] = [\n  { title: \'Read\', minutes: 25 },\n  { title: \'Write\', minutes: 40 },\n]\nconst total = tasks.reduce((sum, t) => sum + t.minutes, 0)\nconsole.log(`${tasks.length} tasks, ${total} minutes`)\n' },
      { name: 'Generics', code: 'function last<T>(items: T[]): T | undefined {\n  return items[items.length - 1]\n}\nenum Mood { Calm, Focus, Night }\nconsole.log(last([1, 2, 3]), Mood[Mood.Focus])\n' },
      { name: 'Canvas', code: 'type Bar = { label: string; value: number }\nconst bars: Bar[] = [{ label: \'Mon\', value: 50 }, { label: \'Tue\', value: 75 }, { label: \'Wed\', value: 30 }]\nconst g = (canvas as OffscreenCanvas).getContext(\'2d\')!\ng.fillStyle = \'white\'\ng.fillRect(0, 0, 480, 320)\nbars.forEach((b, i) => {\n  g.fillStyle = \'goldenrod\'\n  g.fillRect(40 + i * 140, 280 - b.value * 3, 100, b.value * 3)\n  g.fillStyle = \'black\'\n  g.fillText(b.label, 80 + i * 140, 300)\n})\n' },
    ],
  },
  {
    id: 'html', label: 'HTML', engine: null, ext: 'html', limit: 0, reads: false,
    note: 'The page runs in a sealed frame with no network.',
    examples: [
      { name: 'Page', code: '<h1>Hello</h1>\n<p>Pressed <b id="n">0</b> times.</p>\n<button onclick="n.textContent = +n.textContent + 1">Press</button>\n\n<style>\n  body { font-family: system-ui, sans-serif; padding: 1rem }\n  button { font: inherit; padding: .5rem 1rem }\n</style>\n' },
      { name: 'Canvas', code: '<canvas id="c" width="300" height="150"></canvas>\n<script>\n  const g = c.getContext(\'2d\')\n  for (let i = 0; i < 12; i++) {\n    g.fillStyle = `hsl(${i * 30} 80% 55%)`\n    g.fillRect(i * 25, 150 - i * 12, 20, i * 12)\n  }\n</script>\n' },
    ],
  },
  {
    id: 'sql', label: 'SQL', engine: 'sql', ext: 'sql', limit: 30, reads: false,
    note: 'SQLite (sql.js), 300 KB from jsDelivr the first time. A result of names and numbers is drawn as bars. The database lasts until Stop.',
    examples: [
      { name: 'Start', code: 'DROP TABLE IF EXISTS books;\nCREATE TABLE books (title TEXT, pages INT);\nINSERT INTO books VALUES (\'Dune\', 412), (\'Emma\', 474), (\'Ubik\', 202);\n\nSELECT title, pages FROM books WHERE pages > 300 ORDER BY pages;\n' },
      { name: 'Join', code: 'DROP TABLE IF EXISTS people;\nDROP TABLE IF EXISTS sessions;\nCREATE TABLE people (id INT, name TEXT);\nCREATE TABLE sessions (who INT, minutes INT);\nINSERT INTO people VALUES (1, \'Ada\'), (2, \'Lin\');\nINSERT INTO sessions VALUES (1, 25), (1, 50), (2, 40);\n\nSELECT name, COUNT(*) AS sessions, SUM(minutes) AS total\nFROM sessions JOIN people ON people.id = sessions.who\nGROUP BY name ORDER BY total DESC;\n' },
      { name: 'Chart', code: 'DROP TABLE IF EXISTS hours;\nCREATE TABLE hours (day TEXT, minutes INT);\nINSERT INTO hours VALUES (\'Mon\', 50), (\'Tue\', 75), (\'Wed\', 30), (\'Thu\', 90), (\'Fri\', 60);\n\n-- a name and a number: the result is drawn as bars too\nSELECT day, minutes FROM hours;\n' },
    ],
  },
  {
    id: 'bash', label: 'Bash', engine: 'bash', ext: 'sh', limit: 30, reads: true,
    note: 'A bash written in JavaScript (just-bash, from this site) with ls, grep, sed, awk, sort, jq and more, and draw for pictures. Files last until Stop.',
    examples: [
      { name: 'Start', code: 'name="you"\nfor i in 1 2 3; do\n  echo "$i. hello, $name"\ndone\necho "a day has $(( 24 * 60 )) minutes"\n' },
      { name: 'Pipes', code: 'printf "pear\\napple\\npear\\nfig\\napple\\npear\\n" > fruit.txt\nsort fruit.txt | uniq -c | sort -rn\nwc -l < fruit.txt\n' },
      { name: 'Read input', code: '# read takes the next line of the Input box.\nwhile read -r line; do\n  echo "${#line} letters: $line"\ndone\n', input: 'focus\nfriction\n' },
      { name: 'Draw', code: '# draw puts shapes on the picture above the output\ndraw clear white\ndraw color teal\nfor i in $(seq 0 9); do\n  draw fillcircle $(( 30 + i * 46 )) 160 $(( 6 + i * 2 ))\ndone\ndraw color black\ndraw text 20 300 drawn by bash\n' },
    ],
  },
  {
    id: 'cpp', label: 'C / C++', engine: 'cpp', ext: 'cpp', limit: 30, reads: true,
    note: 'An interpreter (JSCPP, from this site) for most of C and C++: iostream, cstdio, cmath, cstring. No templates or std::string. graphics.h draws, as in Turbo C.',
    examples: [
      { name: 'Start', code: '#include <iostream>\nusing namespace std;\n\nint main() {\n    for (int i = 1; i <= 3; i++) {\n        cout << i << ". hello" << endl;\n    }\n    return 0;\n}\n' },
      { name: 'Read input', code: '#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a << " + " << b << " = " << a + b << endl;\n    return 0;\n}\n', input: '3 4\n' },
      { name: 'C', code: '#include <stdio.h>\n#include <math.h>\n\nint main() {\n    for (int i = 1; i <= 5; i++) {\n        printf("%d squared is %d, root %.2f\\n", i, i * i, sqrt(i));\n    }\n    return 0;\n}\n' },
      { name: 'Graphics', code: '// graphics.h, as in Turbo C: a 640 x 480 picture above the output\n#include <graphics.h>\n\nint main() {\n    int gd = DETECT, gm;\n    initgraph(&gd, &gm, "");\n    for (int i = 0; i < 15; i++) {\n        setcolor(i + 1);\n        circle(320, 240, 20 + i * 12);\n    }\n    setcolor(YELLOW);\n    outtextxy(260, 450, "Hello, BGI");\n    closegraph();\n    return 0;\n}\n' },
    ],
  },
  {
    id: 'ruby', label: 'Ruby', engine: 'ruby', ext: 'rb', limit: 30, reads: true,
    note: 'Ruby 3.4 (ruby.wasm), about 8 MB from jsDelivr the first time. gets takes the next line of the Input box.',
    examples: [
      { name: 'Start', code: '%w[read write rest].each_with_index do |word, i|\n  puts "#{i + 1}. #{word.capitalize}"\nend\n' },
      { name: 'Read input', code: '# gets takes the next line of the Input box.\nname = gets.chomp\nputs "Hello, #{name}. That\'s #{name.length} letters."\n', input: 'Ada\n' },
      { name: 'Canvas', code: '# JS.global[:canvas] is the picture above the output\nrequire "js"\ng = JS.global[:canvas].getContext("2d")\n12.times do |i|\n  g[:fillStyle] = "hsl(#{i * 30} 80% 55%)"\n  g.fillRect(20 + i * 37, 160 - i * 10, 30, 20 + i * 20)\nend\n' },
    ],
  },
  {
    id: 'lua', label: 'Lua', engine: 'lua', ext: 'lua', limit: 30, reads: true,
    note: 'Lua 5.4 (wasmoon), 100 KB from jsDelivr the first time. io.read takes the next line of the Input box; draw.rect and friends draw.',
    examples: [
      { name: 'Start', code: 'local tasks = { "read", "write", "rest" }\nfor i, t in ipairs(tasks) do\n  print(i .. ". " .. t)\nend\n' },
      { name: 'Functions', code: 'local function fib(n)\n  if n < 2 then return n end\n  return fib(n - 1) + fib(n - 2)\nend\n\nlocal out = {}\nfor i = 1, 12 do out[#out + 1] = fib(i) end\nprint(table.concat(out, ", "))\n' },
      { name: 'Read input', code: 'io.write("Your name: ")\nlocal name = io.read()\nprint("Hello, " .. name)\n', input: 'Ada\n' },
      { name: 'Draw', code: '-- draw.<shape> puts it on the picture above the output\ndraw.clear("white")\nfor i = 0, 11 do\n  draw.fill(string.format("hsl(%d 80%% 55%%)", i * 30))\n  local a = i / 12 * 2 * math.pi\n  draw.fillcircle(240 + math.cos(a) * 110, 160 + math.sin(a) * 110, 20)\nend\ndraw.color("black")\ndraw.text(190, 165, "drawn by Lua")\n' },
    ],
  },
  {
    id: 'php', label: 'PHP', engine: 'php', ext: 'php', limit: 30, reads: true,
    note: 'PHP 8.4 (php-wasm), about 3 MB from jsDelivr the first time. fgets(STDIN) takes the next line of the Input box.',
    examples: [
      { name: 'Start', code: '<?php\n$tasks = [\'read\' => 25, \'write\' => 40, \'rest\' => 5];\nforeach ($tasks as $name => $min) {\n    echo ucfirst($name), ": $min min\\n";\n}\necho \'Total: \', array_sum($tasks), " min\\n";\n' },
      { name: 'Read input', code: '<?php\n// fgets(STDIN) takes the next line of the Input box.\n$name = trim(fgets(STDIN));\necho "Hello, $name.\\n";\n', input: 'Ada\n' },
      { name: 'SVG', code: '<?php\n// Print an SVG and it shows as a picture. Any language can do this.\n$days = [\'Mon\' => 50, \'Tue\' => 75, \'Wed\' => 30, \'Thu\' => 90, \'Fri\' => 60];\necho \'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160">\';\n$x = 10;\nforeach ($days as $day => $min) {\n    $h = $min * 1.4;\n    echo "<rect x=\'$x\' y=\'" . (140 - $h) . "\' width=\'40\' height=\'$h\' fill=\'goldenrod\'/>";\n    echo "<text x=\'" . ($x + 8) . "\' y=\'155\' font-size=\'12\'>$day</text>";\n    $x += 58;\n}\necho \'</svg>\';\n' },
    ],
  },
]

LANGS.push({
  id: 'dos', label: 'MS-DOS', engine: null, ext: 'bat', limit: 0, reads: false,
  note: 'MS-DOS 4.00 in a PC emulator.',
  examples: [{ name: 'Start', code: '' }],
})

export const langOf = (id: string | undefined): Lang => LANGS.find((l) => l.id === id) ?? LANGS[0]
export const LANG_IDS = LANGS.map((l) => l.id)
