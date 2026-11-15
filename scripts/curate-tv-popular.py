# Adds the well-known channels to src/lib/curated-tv.json and ranks the list so the familiar ones come first.
# Every address here is a stream the broadcaster itself publishes openly, on its own host (the same rule as curate-tv.py); each is checked live
# and for CORS (a browser needs the manifest to be readable from our origin) before it is kept. Needs /tmp/iptv_logos.json and /tmp/iptv_channels.json
# from https://iptv-org.github.io/api/ (logos only). Run it now and then: streams move.
# Not here, on purpose: CNN, Fox News, ESPN, Discovery, MTV and the like (no official free stream), and the Pluto TV / Samsung TV Plus / Rakuten
# style channel lists (their streams belong to those platforms, with per-viewer ads and licences that stop at the platform).
import json, re, ssl, sys, urllib.request, concurrent.futures as cf
ORIGIN = 'https://www.frictionx.app'
PATH = 'src/lib/curated-tv.json'
# (iptv-org id, shown name, address, categories, country, rank 1 to 3)
ADD = [
 ('BloombergTV.us', 'Bloomberg TV', 'https://bloomberg.com/media-manifest/streams/us.m3u8', ['news'], 'US', 3),
 ('EuronewsEnglish.fr', 'Euronews English', 'https://cdn-euronews.akamaized.net/live/eds/euronews-en/25002/index.m3u8', ['news'], 'FR', 3),
 ('France24English.fr', 'France 24 English', 'https://live.france24.com/hls/live/2037218/F24_EN_HI_HLS/master_2300.m3u8', ['news'], 'FR', 3),
 ('France24French.fr', 'France 24 Francais', 'https://live.france24.com/hls/live/2037179/F24_FR_HI_HLS/master_2300.m3u8', ['news'], 'FR', 1),
 ('AlJazeeraEnglish.qa', 'Al Jazeera English', 'https://live-hls-apps-aje-fa.getaj.net/AJE/01.m3u8', ['news'], 'QA', 3),
 ('NHKWorldJapan.jp', 'NHK World-Japan', 'https://media-tyo.hls.nhkworld.jp/hls/w/live/master.m3u8', ['news'], 'JP', 3),
 ('CBSNews247.us', 'CBS News 24/7', 'https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8', ['news'], 'US', 3),
 ('TheWeatherChannel.us', 'The Weather Channel', 'https://twcprod-live.twc-tv.com/v1/manifest/b4d4d63a49309cc5140171fb2e92485c31be1e9e/DSP_6228e4760505741a116f1ba2_twcprod-live/6bf09ce5-366b-463c-b67e-c4b799f73c3f/4.m3u8', ['weather', 'education'], 'US', 3),
 ('RedBullTV.at', 'Red Bull TV', 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8', ['sports', 'outdoor'], 'AT', 3),
 ('NASATVEducation.us', 'NASA TV', 'https://ntv2.akamaized.net/hls/live/2013923/NASA-NTV2-HLS/master.m3u8', ['education', 'science'], 'US', 3),
 ('TRTWorld.tr', 'TRT World', 'https://tv-trtworld.medya.trt.com.tr/master.m3u8', ['news'], 'TR', 2),
 ('ArirangTV.kr', 'Arirang TV', 'https://amdlive-ch01-ctnd-com.akamaized.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8', ['entertainment', 'culture'], 'KR', 2),
 ('i24NEWSEnglishWorld.il', 'i24NEWS English', 'https://i24newsenglish-cdn.encoders.immergo.tv/master.m3u8', ['news'], 'IL', 2),
 ('AfricanewsEnglish.fr', 'Africanews English', 'https://cdn-euronews.akamaized.net/live/eds/africanews-en/25049/index.m3u8', ['news'], 'FR', 2),
 ('FoxWeather.us', 'Fox Weather', 'https://247wlive.foxweather.com/stream/index.m3u8', ['education'], 'US', 2),
 ('ScrippsNews.us', 'Scripps News', 'https://content.uplynk.com/channel/4bb4901b934c4e029fd4c1abfc766c37.m3u8', ['news'], 'US', 2),
 ('VoATV.us', 'VOA', 'https://voa-ingest.akamaized.net/hls/live/2033874/tvmc06/playlist.m3u8', ['news'], 'US', 1),
 ('SkyNewsExtra3.au', 'Sky News Extra (Australia)', 'https://skynewsau-live.akamaized.net/hls/live/2002691/skynewsau-extra3/master.m3u8', ['news'], 'AU', 1),
 ('KiKA.de', 'KiKA', 'https://kikahls.akamaized.net/hls/live/2022690/livetvkika_ww/master.m3u8', ['kids'], 'DE', 1),
]
# names that were showing the wrong language, and the familiar ones among what was already there
RENAME = {'France24.fr': 'France 24 Arabic', 'AlJazeera.qa': 'Al Jazeera Arabic', 'ABCNewsLive1.us': 'ABC News Live'}
RANK = {'BBCNews.uk': 3, 'DW.de': 3, 'ABCNewsLive1.us': 3, 'NBCNewsNOW.us': 3, 'CBCNewsNetwork.ca': 2, 'PBSKids.us': 2, 'ABCNews.au': 2, 'RaiNews24.it': 2, 'DasErste.de': 2, 'NHKWorldPremium.jp': 1,
        'Tagesschau24.de': 2, 'tagesschau24.de': 2, 'DD News': 0, 'SkyNewsArabia.ae': 1, 'ARDalpha.de': 1}
# regional repeats of one channel and minor feeds: dropped so the list is not mostly the same things
DROP = re.compile(r'^(DD (Assam|Girnar|Goa|Haryana|Himachal|Malayalam|Manipur|Meghalaya|Mizoram|Nagaland|Punjabi|Sahyadri|Tripura)|TVR (Cluj|Craiova|Folclor)|CBS News (Baltimore|Bay Area|Boston|Colorado|Detroit|Miami|Minnesota|Philly|Pittsburgh|Sacramento)|PBS Kids (Alaska|Hawaii|Mountain|Pacific)|24 Horas (Canarias|Catalunya)|La [12] (Canarias|Catalunya)|Al Jazeera Mubasher.*|Euronews (Hungarian|Romania|Greek|Russian)|ORF (Kids|Sport\+)|ETV\+?|ETV 2|TVE Star|Canal Institucional|Senal Colombia|Ici RDI)$')
ctx = ssl.create_default_context()
def check(url):
    try:
        r = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (friction-check)', 'Origin': ORIGIN}), timeout=12, context=ctx)
        ok = r.status == 200 and r.read(1500).startswith(b'#EXTM3U')
        cors = r.headers.get('access-control-allow-origin')
        return ok and cors in ('*', ORIGIN)
    except Exception:
        return False
logos = {}
try:
    for l in json.load(open('/tmp/iptv_logos.json')):
        if l.get('channel') and (l.get('url') or '').startswith('https://'):
            if l['channel'] not in logos or (l.get('width') or 0) > logos[l['channel']][0]: logos[l['channel']] = (l.get('width') or 0, l['url'])
except Exception: pass
rows = json.load(open(PATH))
have = {r['id']: r for r in rows}
with cf.ThreadPoolExecutor(12) as ex:
    alive = list(ex.map(lambda a: check(a[2]), ADD))
added = 0
for (cid, name, url, cats, cc, rank), ok in zip(ADD, alive):
    if not ok: print('  skipped (not live or no CORS):', name); continue
    row = have.get(cid) or {'id': cid}
    row.update({'name': name, 'url': url, 'logo': (logos.get(cid, (0, None))[1]) or row.get('logo'), 'cc': cc, 'cats': cats, 'pop': rank})
    if cid not in have: rows.append(row); have[cid] = row; added += 1
for r in rows:
    if r['id'] in RENAME: r['name'] = RENAME[r['id']]
    if r['id'] in RANK and 'pop' not in r: r['pop'] = RANK[r['id']]
before = len(rows)
rows = [r for r in rows if not DROP.match(r['name'])]
for r in rows:
    if not r.get('pop'): r.pop('pop', None)
rows.sort(key=lambda r: (-(r.get('pop') or 0), r['name'].lower()))
json.dump(rows, open(PATH, 'w'), ensure_ascii=False, indent=0)
print(f'added {added}, dropped {before - len(rows)}, now {len(rows)}; ranked {sum(1 for r in rows if r.get("pop"))}')
