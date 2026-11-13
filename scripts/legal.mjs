// The pages Google AdSense (and any visitor) expects: About, Contact, Privacy Policy, Cookie Policy, Terms of Use and a Disclaimer.
// Plain HTML outside the app, written into dist/<name>/index.html in the postbuild step (Vercel serves a file before the SPA rewrite),
// in the same station look as the blog: the stylesheet is lifted from api/blog.ts so the two cannot drift apart.
// Edit the words here. There is no public email address: the Contact page is a form (api/contact.ts) and `mail` links to it.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const SITE = 'https://www.frictionx.app'
const UPDATED = '11 November 2026'
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const blog = readFileSync(new URL('../api/blog.ts', import.meta.url), 'utf8')
const STYLE = blog.slice(blog.indexOf('<style>'), blog.indexOf('</style>') + 8)
const BARS = ['#f3f1ea', '#ffd23f', '#3ee0ff', '#4ade80', '#ff5d8f', '#ff3b3b', '#3b5bff']
const MARK = '<svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="5" transform="rotate(-100 32 32)" stroke-dasharray="1 1" pathLength="1"/><rect x="40" y="10" width="16" height="16" fill="#ffd23f"/></svg>'
const mail = '<a href="/contact">the contact form</a>'
const ext = (h, t) => `<a href="${h}" target="_blank" rel="noopener">${t}</a>`
/** the streams and sources notice, shared by Terms, Disclaimer and Contact: Friction lists public content and owns none of it */
const SOURCES = `<p>Friction does not own, host, produce or control any radio station, TV channel, podcast, song, news story or web page you can open from it. They are published by other people and are publicly available from the sources below. Friction lists them and plays them straight from their own servers; it does not copy, re-broadcast or store them.</p>
<ul>
<li><strong>Radio stations:</strong> a hand-picked list of about 70 public-service and independent stations (for example France Inter, Deutschlandfunk, NRK, SR, NPO, RAI, ABC-style public broadcasters, WQXR, WNYC, SomaFM and Radio Paradise), found through the community directory ${ext('https://www.radio-browser.info', 'Radio Browser')}. Each station is run by its own broadcaster and played from its own server.</li>
<li><strong>Live TV channels:</strong> a hand-picked list of about 100 public-service and international broadcasters (for example ARD, ORF, RTVE, RAI, ERR, DR, Euronews, DW, France 24, NHK World, ABC and CBC channels and PBS Kids), found through the public playlists of ${ext('https://github.com/iptv-org/iptv', 'iptv-org')} and kept only where the stream address belongs to the broadcaster itself. It is played from the broadcaster's own server.</li>
<li><strong>Podcasts:</strong> found with the ${ext('https://performance-partners.apple.com/search-api', 'iTunes Search API')} and played from each podcast's own feed and host.</li>
<li><strong>Songs:</strong> ${ext('https://audius.co', 'Audius')}, ${ext('https://openverse.org', 'Openverse')}, the ${ext('https://archive.org', 'Internet Archive')} (including its Free Music Archive, Musopen and Live Music Archive collections), ${ext('https://commons.wikimedia.org', 'Wikimedia Commons')} and the ${ext('https://www.loc.gov/collections/national-jukebox/', 'Library of Congress National Jukebox')}.</li>
<li><strong>News:</strong> the public feeds of each publisher, linked to the publisher's own page.</li>
<li><strong>Lessons:</strong> text from ${ext('https://www.wikipedia.org', 'Wikipedia')}, shortened and rearranged into lessons and questions, used under the ${ext('https://creativecommons.org/licenses/by-sa/4.0/', 'Creative Commons Attribution-ShareAlike 4.0 licence')} (each lesson links to its article and its history). Each song shows the licence its source gives it where there is one.</li>
</ul>
<p>If you have an issue with a particular stream or recording, such as copyright, a takedown request, offensive or unlawful content, or a stream that is wrong or broken, please contact the source that publishes it: the broadcaster, channel owner, podcast host, or the service listed above. They control the content and can fix or remove it.</p>
<h3>Requests from rights holders</h3>
<p>Friction keeps no copy of any stream. Our radio and TV lists are short hand-picked lists of addresses, so removing something from them is easy once a request is verified, but the real fix for content that should not be on the web is always at the source. If you are the rights holder, or authorised to act for them, and you also want something hidden inside Friction, use ${mail} with the address of the item, who you are, and why you are entitled to ask. We check every request and we act only on those that come from the rights holder or someone authorised for them. Anonymous, bulk or repeated requests, and requests that look meant to harass a stream, a publisher or this site, are ignored. Knowingly sending a false claim can have legal consequences for the sender.</p>`

const PAGES = {
  '/about': {
    title: 'About Friction: a free focus timer with no feed',
    description: 'Friction is a free focus timer with radio, live TV, lessons and a small arcade. No account, no feed. Who makes it, why, and what it costs.',
    h1: 'About Friction',
    lead: 'A focus timer that makes leaving the tab the one thing that costs you, with radio, live TV and lessons to stay with instead of a feed.',
    body: `
<h2>What it is</h2>
<p>Friction is a free web app for studying and working without being pulled away. You choose how long to focus and lock in. While you are locked in, the clock runs only while this tab is in front of you. Leave it and the session records a drift, the one unit Friction measures.</p>
<p>Around the timer there is a station to stay with: internet radio, live TV channels, podcasts, news, lessons built from Wikipedia text by fixed rules, a small arcade you pay for with credits you earn by focusing, study windows such as a notepad and a calculator, and Together rooms for studying with friends.</p>
<h2>Why it exists</h2>
<p>Most focus tools block things or scold you. Friction does the opposite: it gives you something good to do inside the tab, and keeps an honest count of how often you left. It does not invent proof, it does not send you notifications to come back, and it has no feed.</p>
<h2>Who makes it</h2>
<p>Friction is made and run by one independent developer. It has no investors and no sales team. If you have a question, a bug or an idea, use ${mail}.</p>
<h2>How it is paid for</h2>
<p>Friction is free to use. The hosting, the database and the cloud browser cost real money, so the site may show advertising from Google AdSense on its public pages, such as the blog. Ads never change the timer, the lessons or your data. How ads and cookies work is explained in the <a href="/privacy">Privacy Policy</a> and the <a href="/cookies">Cookie Policy</a>.</p>
<h2>Where AI is used, and where it is not</h2>
<p>Lessons, their questions and the Debrief are plain rules and computed text, never AI. AI appears in only three labelled places: demos for lesson topics without a built-in one, an optional Ask AI window you open and type into, and a check that helps the Browser window block games and short-form social media. The articles on the <a href="/blogs">blog</a> are written with AI and published automatically, and each one says so.</p>
<h2>Your data</h2>
<p>Everything you make (sessions, notes, settings, credits) is kept in your own browser. There is no account. See the <a href="/privacy">Privacy Policy</a> for the few things that do leave your browser, and how to erase them.</p>`,
  },
  '/contact': {
    title: 'Contact Friction: questions, bugs, privacy requests',
    description: 'How to reach the person who runs Friction: questions, bug reports, privacy and data requests, advertising and press. One form, read by a human.',
    h1: 'Contact',
    lead: 'A message form, read by the person who builds Friction.',
    body: `
<h2>Send a message</h2>
<p>There is no public email address: messages go through this form straight to the person who runs Friction. Leave a way to reach you if you want an answer (an email address or a link); without one the message is still read but cannot be answered. A reply usually takes a few days, and there is no support team, so a clear message with what you were doing, the screen you were on, and your device and browser helps most.</p>
<form id="cf" class="cf" novalidate>
<label for="cf-topic">What is it about?</label>
<select id="cf-topic" name="topic"><option value="bug">A bug or something that looks wrong</option><option value="site">A site that does not work in the Browser window</option><option value="privacy">Privacy or my data</option><option value="rights">I am a rights holder asking for something to be hidden</option><option value="ads">Advertising, press or partnerships</option><option value="other">Something else</option></select>
<label for="cf-message">Your message</label>
<textarea id="cf-message" name="message" rows="7" maxlength="2000" required></textarea>
<label for="cf-name">Your name (optional)</label>
<input id="cf-name" name="name" maxlength="60" autocomplete="name">
<label for="cf-reply">How to reach you (optional, needed for a reply)</label>
<input id="cf-reply" name="reply" maxlength="120" autocomplete="email" placeholder="you@example.com">
<div class="cf-hp" aria-hidden="true"><label>Leave this empty <input name="site" tabindex="-1" autocomplete="off"></label></div>
<button class="cta" type="submit" id="cf-go">Send</button>
<p id="cf-status" role="status" aria-live="polite"></p>
</form>
<script>
(function () {
  var t0 = Date.now(), f = document.getElementById('cf'), st = document.getElementById('cf-status'), go = document.getElementById('cf-go')
  f.addEventListener('submit', function (e) {
    e.preventDefault()
    var d = { topic: f.topic.value, message: f.message.value, name: f.name.value, reply: f.reply.value, site: f.site.value, ms: Date.now() - t0 }
    if (d.message.trim().length < 10) { st.textContent = 'Please write a little more (at least 10 characters).'; return }
    go.disabled = true; st.textContent = 'Sending...'
    fetch('/api/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(d) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j } }) })
      .then(function (x) { if (x.ok) { f.reset(); st.textContent = 'Thank you. Your message was sent.' } else { st.textContent = (x.j && x.j.error) || 'Sorry, that did not go through.'; go.disabled = false } })
      .catch(function () { st.textContent = 'Sorry, that did not go through. Please try again in a moment.'; go.disabled = false })
      .then(function () { setTimeout(function () { go.disabled = false }, 4000) })
  })
})()
</script>
<h2>What to write about</h2>
<ul>
<li><strong>A bug or something that looks wrong.</strong> Say what you expected and what happened.</li>
<li><strong>A site that does not work in the Browser window.</strong> The Browser reads pages only, and the cloud browser is experimental; some sites will not work.</li>
<li><strong>Privacy and data.</strong> You can erase everything yourself under Settings, then Data, then Erase everything. For anything else, such as a question about this policy, use the form.</li>
<li><strong>Advertising, press and partnerships.</strong> Pick that topic in the form and say what you have in mind.</li>
<li><strong>Streams, takedowns and copyright.</strong> The radio, TV, podcasts and songs in Friction are published by other people and are publicly available from their sources, not owned or hosted by us (see the list on the <a href="/disclaimer">Disclaimer</a> page). For a problem with a stream itself, contact its source. Rights holders who want something hidden in Friction can use the form, as described under Requests from rights holders on the Disclaimer page; we verify who is asking and do not act on anonymous or bulk requests.</li>
</ul>
<h2>Before you write</h2>
<p>The <a href="/about">About</a> page says what Friction is. The <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Use</a> answer most questions about data and rules.</p>`,
  },
  '/privacy': {
    title: 'Privacy Policy: what Friction keeps and what leaves',
    description: 'What Friction stores in your browser, the few things sent to servers, how Google advertising and analytics cookies work, and how to erase everything.',
    h1: 'Privacy Policy',
    lead: `Friction has no accounts and keeps what you make in your own browser. This page lists the exceptions. Last updated ${UPDATED}.`,
    body: `
<h2>In short</h2>
<ul>
<li>There is no account. Your sessions, notes, settings and credits are saved in your browser, not on our servers.</li>
<li>You can erase everything in Settings, then Data, then Erase everything.</li>
<li>Third parties, listed below, receive some data when you use a feature that needs them, and Google may set cookies for analytics and advertising.</li>
</ul>
<h2>Who is responsible</h2>
<p>Friction is run by an independent developer. For privacy questions or requests use ${mail}.</p>
<h2>What stays in your browser</h2>
<p>Your profile name, settings, sessions, drifts, credits, lessons, notes, to-do lists, layout and shop items are stored in your browser (localStorage and IndexedDB). We cannot see them, and clearing site data or using Erase everything removes them. Your private identity key is a random value that also stays in your browser; only a hash of it is ever sent anywhere.</p>
<h2>What is sent to our servers</h2>
<ul>
<li><strong>The leaderboard (optional).</strong> If you set a public alias and take part, we store a public code (a hash), the alias you chose, the minutes you have focused since joining (with two numbers used to check them) and, if you are a supporter, a flag that shows a star by your alias. Erase everything deletes your row.</li>
<li><strong>Together rooms (optional).</strong> A room stores the names members chose, chat messages, what is being shared and an optional Discord or Slack webhook address the host sets. A room with nobody left is deleted. Erase everything removes your seat.</li>
<li><strong>The contact form.</strong> A message you send is stored with the topic you chose and, only if you give them, your name and a way to reach you. Your network address is kept only as a one-way hash, to stop spam (three messages a day). Messages are deleted after 180 days. Please do not put anything sensitive in a message.</li>
<li><strong>Moving your data.</strong> If you use Move my data, your data is encrypted in your browser with a code only you see, kept for ten minutes, and deleted when read. We never see the code or the contents.</li>
<li><strong>The Browser window and cloud browser allowance.</strong> Pages are fetched by our server on your behalf and are not stored. The daily time allowance for the cloud browser is counted against a hash of your network address, which is kept for the day.</li>
<li><strong>Technical logs.</strong> Our host, Vercel, processes requests and keeps standard server logs such as address, time and page requested.</li>
</ul>
<h2>Third-party services</h2>
<ul>
<li><strong>Google (Tag Manager, analytics, AdSense).</strong> The site loads Google Tag Manager, which measures how screens are used, and may show Google AdSense advertising on public pages. Google and its partners may use cookies and similar technologies, including to show personalised or non-personalised ads. Google's use of advertising cookies lets it and its partners serve ads based on visits to this and other sites. You can manage personalised advertising at <a href="https://adssettings.google.com">adssettings.google.com</a> and learn how Google uses data at <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>. Nothing from Google loads until you press Accept on the cookie notice. Reject (or not answering) loads nothing, and you can change your choice at any time under Settings, then Help, then Cookie choice.</li>
<li><strong>Hyperbeam and relay servers (cloud browser).</strong> If you open the cloud browser, a real browser runs on a third party's servers and that party can see what you do in it. A card says so before it starts. No cookies or profile are saved.</li>
<li><strong>AI services.</strong> Lesson demos send only the topic title to Google Gemini through our server. Ask AI sends what you type to free language-model services (Pollinations and LLM7). The Browser's site check sends an address, title and a short excerpt to the same kind of service. Do not type anything private into Ask AI.</li>
<li><strong>Content sources.</strong> Radio, TV, podcasts, news, songs, Wikipedia, maps and translation come from public services your browser or our server contacts when you use them; they see your address as any website would.</li>
<li><strong>Cloud backup (supporters, optional).</strong> If you turn it on, your browser seals a copy of its data with a backup key that never leaves your devices, and we store the sealed copy: one row with an identifier made from the key, a hash of a second value that proves you hold it, the sealed data and the time. We cannot read it. It is deleted when you turn backup off or erase everything, and after about 400 days without a save. If you lose the key, nobody can open the copy.</li>
<li><strong>Whop (supporters).</strong> If you choose to support Friction, the payment is made on Whop's own pages. Whop collects your payment details and email as the seller; Friction never receives them. When you return, a single flag in your browser records that you are a supporter.</li>
<li><strong>Product Hunt badge.</strong> The front page shows a badge image served by Product Hunt, which therefore sees your network address and browser, as any website that loads an image does.</li>
<li><strong>Video and audio embeds.</strong> YouTube videos open in the privacy-friendly embed.</li>
</ul>
<h2>Cookies and local storage</h2>
<p>See the <a href="/cookies">Cookie Policy</a>.</p>
<h2>Children</h2>
<p>Friction is a general study tool and is not aimed at children under 13. We do not knowingly collect personal data from them. If you think a child has given us data, use ${mail}.</p>
<h2>Your rights</h2>
<p>Because almost everything is in your browser, you can see and delete it yourself. For data on our servers (a leaderboard row, a room seat), Erase everything deletes it. You may also ask us to access, correct or delete data, or object to its use, by writing to ${mail}. If you are in the EEA, UK or California you have additional rights under local law, and you may complain to your data-protection authority.</p>
<h2>Security</h2>
<p>Pages are served over HTTPS. Keys and secrets live only on the server and never in the client. No system is perfectly secure, so do not put anything highly sensitive into any web page, including this one.</p>
<h2>Changes</h2>
<p>When this policy changes we update the date at the top. Material changes are also noted on the front page.</p>`,
  },
  '/cookies': {
    title: 'Cookie Policy: cookies and storage Friction uses',
    description: 'The cookies, local storage and similar technologies Friction and its advertising and analytics partners use, what each is for, and how to control them.',
    h1: 'Cookie Policy',
    lead: `What is stored on your device when you use Friction, and how to control it. Last updated ${UPDATED}.`,
    body: `
<h2>What we store ourselves</h2>
<p>Friction uses your browser's local storage and IndexedDB, not cookies, to remember your settings, sessions, notes and layout, plus small flags such as whether you have seen the tour. These are needed for the app to work and are never sent to advertisers.</p>
<p>So that Friction opens without a connection and starts faster on a repeat visit, your browser also keeps a copy of the app's own public files (its pages, scripts, styles and fonts) in its cache storage. That copy holds nothing about you, is the same for every visitor, and is removed when you clear site data.</p>
<table>
<thead><tr><th>Name</th><th>Purpose</th><th>Kept</th></tr></thead>
<tbody>
<tr><td>friction:*</td><td>Your data, settings, layout, private identity key and small flags</td><td>Until you erase it</td></tr>
<tr><td>learn:demo:*</td><td>A cached lesson demo so it is written once</td><td>Until you erase it</td></tr>
</tbody></table>
<h2>Cookies from partners</h2>
<ul>
<li><strong>Google Tag Manager and analytics.</strong> Measure how pages and features are used so they can be improved. Loaded only after you press Accept on the cookie notice.</li>
<li><strong>Google AdSense and its partners.</strong> If advertising is shown, Google and its partners may set or read cookies to show ads, limit how often you see one, and measure results. These may be personalised.</li>
</ul>
<h2>How to control them</h2>
<ul>
<li>Use your browser's settings to block or delete cookies for this site. Friction still works, though ads may be less relevant.</li>
<li>Change your choice on Friction at any time: Settings, then Help, then Cookie choice.</li>
<li>Manage Google's personalised ads at <a href="https://adssettings.google.com">adssettings.google.com</a>, or opt out of many third-party vendors at <a href="https://www.aboutads.info">aboutads.info</a>.</li>
<li>Erase everything in Settings, then Data, removes what Friction itself stores.</li>
</ul>
<p>More on how Google uses information from sites that use its services is at <a href="https://policies.google.com/technologies/partner-sites">policies.google.com/technologies/partner-sites</a>. For the rest of what we handle, see the <a href="/privacy">Privacy Policy</a>.</p>`,
  },
  '/terms': {
    title: 'Terms of Use: the rules for using Friction',
    description: 'The terms for using Friction: what the service is, acceptable use, third-party content, the Browser and cloud browser limits, credits, and liability.',
    h1: 'Terms of Use',
    lead: `Plain rules for using Friction. By using the site you agree to them. Last updated ${UPDATED}.`,
    body: `
<h2>The service</h2>
<p>Friction is a free web app provided as it is. Parts of it (the Browser window, the cloud browser, some AI features) are experimental and may be slow, wrong or unavailable at any time.</p>
<h2>Using it</h2>
<ul>
<li>You may use Friction for personal, non-commercial study and work.</li>
<li>Do not try to break, overload or probe the service, scrape it at scale, get around its limits (such as the cloud browser's daily time or the Browser's blocklist), or use it to do anything unlawful.</li>
<li>Do not use Together rooms or the leaderboard to harass anyone or to post unlawful, hateful or sexual content. Aliases and room names may be removed.</li>
<li>The Browser is built to block games and short-form social media. Do not try to avoid that.</li>
</ul>
<h2 id="sources">Streams and third-party content</h2>
${SOURCES}
<p>We are not responsible for what they say, and we do not guarantee that they are available or lawful where you are. Their own terms apply.</p>
<h2>Credits and the shop</h2>
<p>Credits are earned only by focusing and finishing lessons. They have no cash value, cannot be bought with money or won in games, and are stored in your browser. Clearing your data removes them.</p>
<h2>AI features</h2>
<p>AI output can contain mistakes. Check it against a reliable source. Do not rely on it for medical, legal or financial decisions.</p>
<h2>Advertising</h2>
<p>Public pages may show ads served by Google AdSense. We are not responsible for the ads' content. See the <a href="/privacy">Privacy Policy</a>.</p>
<h2>Supporting Friction</h2>
<p>You may support Friction through Whop (see <a href="/support">Support</a>). Supporting is optional, is a gift that adds a few extras in the app (five more themes, an encrypted cloud backup, and a star and a mark next to your name), and does not change what the free app does: what is free is not moved into the extras. Whop is the seller and handles payment, receipts, taxes and refunds under its own terms. We may change or remove the extras, and we will not remove what a supporter has already unlocked without a good reason, such as misuse.</p>
<h2>Ownership</h2>
<p>Friction's design, code and text belong to its maker. Content you write (notes, chat, aliases) remains yours; you let us store and show it as needed to run the feature you used.</p>
<h2>No warranty and limit of liability</h2>
<p>To the fullest extent the law allows, Friction is provided without warranties of any kind, and we are not liable for any loss arising from using it, including lost data, missed deadlines or results from a study tool. Nothing here limits rights you have by law that cannot be limited.</p>
<h2>Changes and ending</h2>
<p>We may change the service or these terms, and may end or limit access for misuse. The date above shows the latest version.</p>
<h2>Contact</h2>
<p>${mail}</p>`,
  },
  '/thanks': {
    noindex: true,
    title: 'Thank you for supporting Friction',
    description: 'Thank you for supporting Friction. Your goodies are switched on in this browser.',
    h1: 'Thank you',
    lead: 'You are keeping Friction free for everyone. That means a lot.',
    body: `
<div id="ok" hidden><h2>Your extras are on</h2><p>The five extra themes (pick one in Settings, under Look), the cloud backup in Settings, under Data, and the star by your alias are yours. They are switched on in this browser. Keep this page's link (or your Whop receipt): opening it on another device switches them on there too.</p><p><a class="cta" href="/focus">Open Friction</a></p></div>
<div id="no" hidden><h2>That link did not work</h2><p>If you paid and see this, use <a href="/contact">the contact form</a> with your Whop receipt details and I will sort it out.</p></div>
<script>
(async function () {
  var q = new URLSearchParams(location.search), k = q.get('k') || '', st = q.get('status'), ok = false
  try {
    var h = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k)))).map(function (b) { return b.toString(16).padStart(2, '0') }).join('')
    ok = (st === 'succeeded' && /^pay_/.test(q.get('payment') || '')) || ((!st || st === 'succeeded') && h === '3189dd4a169dc6520bb6dfc6cdbfc840635079bd2aa472ed81cdd7822e349a40')
  } catch (e) {}
  if (ok) { try { localStorage.setItem('friction:supporter', '1') } catch (e) {} }
  document.getElementById(ok ? 'ok' : 'no').hidden = false
})()
</script>`,
  },
  '/disclaimer': {
    title: 'Disclaimer: study help, not professional advice',
    description: 'Friction is a study and focus tool. Lessons come from Wikipedia text, AI output can be wrong, and nothing here is professional advice. Read this first.',
    h1: 'Disclaimer',
    lead: 'Friction helps you focus and learn. It is not a substitute for professional advice or a primary source.',
    body: `
<h2>Education only</h2>
<p>Lessons are built by fixed rules from Wikipedia text and may be incomplete or out of date. Demos written by AI can contain mistakes and say so. Check anything important against the source.</p>
<h2>No professional advice</h2>
<p>Nothing on Friction is medical, legal, financial or mental-health advice. If you are struggling, speak to a qualified person.</p>
<h2 id="sources">Streams and external content</h2>
${SOURCES}
<p>We do not control or endorse them, and their availability can change without notice.</p>
<h2>Advertising</h2>
<p>Where ads appear they are placed by Google AdSense and are not endorsements by Friction.</p>
<p>See also the <a href="/terms">Terms of Use</a> and the <a href="/privacy">Privacy Policy</a>.</p>`,
  },
}

const NAV = [['/about', 'About'], ['/contact', 'Contact'], ['/privacy', 'Privacy'], ['/terms', 'Terms']]
const FOOT = '<a href="/about">About</a> · <a href="/contact">Contact</a> · <a href="/privacy">Privacy</a> · <a href="/cookies">Cookies</a> · <a href="/terms">Terms</a> · <a href="/disclaimer">Disclaimer</a> · <a href="/support">Support</a> · <a href="/blogs">Blog</a>'
const EXTRA = '<style>@media(max-width:640px){header nav{gap:10px;flex-wrap:wrap;justify-content:flex-end}header nav a{padding:6px 0}}table{width:100%;border-collapse:collapse;margin:0 0 20px}th,td{text-align:left;padding:10px 12px 10px 0;border-bottom:1px solid var(--rule);vertical-align:top;font-size:16px;color:var(--ink-2)}th{color:var(--ink-3);font:600 15px/1 var(--cond);letter-spacing:.16em;text-transform:uppercase}.article a{color:var(--signal)}.cf{display:grid;gap:8px;max-width:36rem;margin:0 0 28px}.cf label{color:var(--ink-3);font:600 15px/1.2 var(--cond);letter-spacing:.14em;text-transform:uppercase;margin-top:10px}.cf input,.cf select,.cf textarea{width:100%;min-height:48px;padding:10px 12px;background:transparent;color:var(--ink);border:1px solid var(--rule);font:inherit;font-size:17px;border-radius:0}.cf textarea{resize:vertical}.cf input:focus,.cf select:focus,.cf textarea:focus{outline:3px solid var(--ink);outline-offset:2px}.cf option{background:#05070c}.cf-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}.cf button{border:0;cursor:pointer;margin-top:18px}.cf button:disabled{opacity:.6;cursor:default}#cf-status{min-height:1.5em;margin:6px 0 0;color:var(--ink-2)}</style>'

for (const [path, p] of Object.entries(PAGES)) {
  const url = SITE + path
  const ld = { '@context': 'https://schema.org', '@type': path === '/about' ? 'AboutPage' : path === '/contact' ? 'ContactPage' : 'WebPage', name: p.title, description: p.description, url, isPartOf: { '@type': 'WebSite', name: 'Friction', url: SITE + '/' }, inLanguage: 'en' }
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#05070c">
${p.noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta name="google-adsense-account" content="ca-pub-4954107433114846">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Friction">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
${STYLE}
${EXTRA}
</head>
<body>
<div class="bars" aria-hidden="true">${BARS.map((c) => `<i style="background:${c}"></i>`).join('')}</div>
<header><div class="wrap">
  <a class="mark" href="/" aria-label="Friction home">${MARK} Friction</a>
  <nav aria-label="Main">${NAV.map(([h, t]) => `<a href="${h}"${h === path ? ' aria-current="page"' : ''}>${t}</a>`).join('')}</nav>
</div></header>
<main>
<div class="head"><div class="wrap"><p class="kicker"><a href="/">Friction</a></p><h1>${esc(p.h1)}</h1><p class="lead">${p.lead}</p></div></div>
<div class="wrap body"><div class="article">${p.body}</div></div>
</main>
<footer><div class="wrap"><p>Friction is a free focus timer with radio, live TV and lessons. No account, no feed. Your data stays in your browser.</p><p>${FOOT}</p></div></footer>
</body>
</html>
`
  mkdirSync(`dist${path}`, { recursive: true })
  writeFileSync(`dist${path}/index.html`, html)
}
console.log('legal pages:', Object.keys(PAGES).join(' '))
export const LEGAL_PATHS = Object.keys(PAGES)
