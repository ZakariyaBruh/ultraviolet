import type { Engine } from './coderun'

/** The Code window's languages: what runs each one, how long a run may take once it has started, and a few examples to start from. */
export type LangId = 'python' | 'javascript' | 'typescript' | 'html' | 'sql' | 'bash' | 'cpp' | 'ruby' | 'lua' | 'php'
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
    note: 'Python 3.12 (Pyodide), about 6 MB from jsDelivr the first time. numpy, pandas and matplotlib load when you import them. Variables last until Stop.',
    examples: [
      { name: 'Start', code: '# Write Python and press Run (Ctrl + Enter).\nname = "Friction"\nfor i in range(3):\n    print(f"{i + 1}. Hello from {name}")\n' },
      { name: 'Read input', code: '# input() takes the next line of the Input box.\nname = input("Your name: ")\nage = int(input("Your age: "))\nprint(f"{name}, in ten years you\'ll be {age + 10}.")\n', input: 'Ada\n36\n' },
      { name: 'Plot', code: '# numpy and matplotlib load the first time (a few MB more).\nimport numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 2 * np.pi, 200)\nplt.plot(x, np.sin(x), label="sin")\nplt.plot(x, np.cos(x), label="cos")\nplt.title("Waves")\nplt.legend()\nplt.show()\n' },
      { name: 'Statistics', code: 'from statistics import mean, median, stdev\n\nscores = [72, 88, 95, 61, 79, 84]\nprint("mean  ", round(mean(scores), 1))\nprint("median", median(scores))\nprint("spread", round(stdev(scores), 1))\n' },
    ],
  },
  {
    id: 'javascript', label: 'JavaScript', engine: 'js', ext: 'js', limit: 20, reads: true,
    note: 'Runs in a worker of its own, fresh each time. prompt() takes the next line of the Input box.',
    examples: [
      { name: 'Start', code: '// Write JavaScript and press Run (Ctrl + Enter).\nconst days = [\'Mon\', \'Tue\', \'Wed\']\nfor (const [i, d] of days.entries()) console.log(`${i + 1}. ${d}`)\n' },
      { name: 'Read input', code: '// prompt() takes the next line of the Input box.\nconst name = prompt(\'Your name: \')\nconst n = Number(prompt(\'Pick a number: \'))\nconsole.log(`${name}, ${n} squared is ${n * n}.`)\n', input: 'Ada\n12\n' },
      { name: 'Await', code: '// Top-level await works here.\nconst wait = (ms) => new Promise((r) => setTimeout(r, ms))\nfor (let i = 3; i > 0; i--) {\n  console.log(i)\n  await wait(300)\n}\nconsole.log(\'Lift off\')\n' },
    ],
  },
  {
    id: 'typescript', label: 'TypeScript', engine: 'js', sub: 'ts', ext: 'ts', limit: 20, reads: true,
    note: 'The types are stripped (Sucrase, from this site), not checked, then it runs as JavaScript.',
    examples: [
      { name: 'Start', code: 'interface Task { title: string; minutes: number }\n\nconst tasks: Task[] = [\n  { title: \'Read\', minutes: 25 },\n  { title: \'Write\', minutes: 40 },\n]\nconst total = tasks.reduce((sum, t) => sum + t.minutes, 0)\nconsole.log(`${tasks.length} tasks, ${total} minutes`)\n' },
      { name: 'Generics', code: 'function last<T>(items: T[]): T | undefined {\n  return items[items.length - 1]\n}\nenum Mood { Calm, Focus, Night }\nconsole.log(last([1, 2, 3]), Mood[Mood.Focus])\n' },
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
    note: 'SQLite (sql.js), 300 KB from jsDelivr the first time. The database lasts until Stop.',
    examples: [
      { name: 'Start', code: 'DROP TABLE IF EXISTS books;\nCREATE TABLE books (title TEXT, pages INT);\nINSERT INTO books VALUES (\'Dune\', 412), (\'Emma\', 474), (\'Ubik\', 202);\n\nSELECT title, pages FROM books WHERE pages > 300 ORDER BY pages;\n' },
      { name: 'Join', code: 'DROP TABLE IF EXISTS people;\nDROP TABLE IF EXISTS sessions;\nCREATE TABLE people (id INT, name TEXT);\nCREATE TABLE sessions (who INT, minutes INT);\nINSERT INTO people VALUES (1, \'Ada\'), (2, \'Lin\');\nINSERT INTO sessions VALUES (1, 25), (1, 50), (2, 40);\n\nSELECT name, COUNT(*) AS sessions, SUM(minutes) AS total\nFROM sessions JOIN people ON people.id = sessions.who\nGROUP BY name ORDER BY total DESC;\n' },
    ],
  },
  {
    id: 'bash', label: 'Bash', engine: 'bash', ext: 'sh', limit: 30, reads: true,
    note: 'A bash written in JavaScript (just-bash, from this site) with ls, grep, sed, awk, sort, jq and more. Files last until Stop.',
    examples: [
      { name: 'Start', code: 'name="you"\nfor i in 1 2 3; do\n  echo "$i. hello, $name"\ndone\necho "a day has $(( 24 * 60 )) minutes"\n' },
      { name: 'Pipes', code: 'printf "pear\\napple\\npear\\nfig\\napple\\npear\\n" > fruit.txt\nsort fruit.txt | uniq -c | sort -rn\nwc -l < fruit.txt\n' },
      { name: 'Read input', code: '# read takes the next line of the Input box.\nwhile read -r line; do\n  echo "${#line} letters: $line"\ndone\n', input: 'focus\nfriction\n' },
    ],
  },
  {
    id: 'cpp', label: 'C / C++', engine: 'cpp', ext: 'cpp', limit: 30, reads: true,
    note: 'An interpreter (JSCPP, from this site) for most of C and C++: iostream, cstdio, cmath, cstring. No templates or std::string.',
    examples: [
      { name: 'Start', code: '#include <iostream>\nusing namespace std;\n\nint main() {\n    for (int i = 1; i <= 3; i++) {\n        cout << i << ". hello" << endl;\n    }\n    return 0;\n}\n' },
      { name: 'Read input', code: '#include <iostream>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a << " + " << b << " = " << a + b << endl;\n    return 0;\n}\n', input: '3 4\n' },
      { name: 'C', code: '#include <stdio.h>\n#include <math.h>\n\nint main() {\n    for (int i = 1; i <= 5; i++) {\n        printf("%d squared is %d, root %.2f\\n", i, i * i, sqrt(i));\n    }\n    return 0;\n}\n' },
    ],
  },
  {
    id: 'ruby', label: 'Ruby', engine: 'ruby', ext: 'rb', limit: 30, reads: true,
    note: 'Ruby 3.4 (ruby.wasm), about 8 MB from jsDelivr the first time. gets takes the next line of the Input box.',
    examples: [
      { name: 'Start', code: '%w[read write rest].each_with_index do |word, i|\n  puts "#{i + 1}. #{word.capitalize}"\nend\n' },
      { name: 'Read input', code: '# gets takes the next line of the Input box.\nname = gets.chomp\nputs "Hello, #{name}. That\'s #{name.length} letters."\n', input: 'Ada\n' },
    ],
  },
  {
    id: 'lua', label: 'Lua', engine: 'lua', ext: 'lua', limit: 30, reads: true,
    note: 'Lua 5.4 (wasmoon), 100 KB from jsDelivr the first time. io.read takes the next line of the Input box.',
    examples: [
      { name: 'Start', code: 'local tasks = { "read", "write", "rest" }\nfor i, t in ipairs(tasks) do\n  print(i .. ". " .. t)\nend\n' },
      { name: 'Functions', code: 'local function fib(n)\n  if n < 2 then return n end\n  return fib(n - 1) + fib(n - 2)\nend\n\nlocal out = {}\nfor i = 1, 12 do out[#out + 1] = fib(i) end\nprint(table.concat(out, ", "))\n' },
      { name: 'Read input', code: 'io.write("Your name: ")\nlocal name = io.read()\nprint("Hello, " .. name)\n', input: 'Ada\n' },
    ],
  },
  {
    id: 'php', label: 'PHP', engine: 'php', ext: 'php', limit: 30, reads: true,
    note: 'PHP 8.4 (php-wasm), about 3 MB from jsDelivr the first time. fgets(STDIN) takes the next line of the Input box.',
    examples: [
      { name: 'Start', code: '<?php\n$tasks = [\'read\' => 25, \'write\' => 40, \'rest\' => 5];\nforeach ($tasks as $name => $min) {\n    echo ucfirst($name), ": $min min\\n";\n}\necho \'Total: \', array_sum($tasks), " min\\n";\n' },
      { name: 'Read input', code: '<?php\n// fgets(STDIN) takes the next line of the Input box.\n$name = trim(fgets(STDIN));\necho "Hello, $name.\\n";\n', input: 'Ada\n' },
    ],
  },
]

export const langOf = (id: string | undefined): Lang => LANGS.find((l) => l.id === id) ?? LANGS[0]
export const LANG_IDS = LANGS.map((l) => l.id)
