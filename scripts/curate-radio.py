# Rebuilds the curated radio list (src/lib/curated-radio.json) from the Radio Browser API: each wanted station by name, https, MP3/AAC/OGG, not HLS, last check OK, 64 kbps or more, and a live check of the stream.
# Drop anything unreputable by hand afterwards (the first run found a few third-party chill stations that were removed).
import json,urllib.request,urllib.parse,ssl,concurrent.futures as cf,re
BASE='https://de1.api.radio-browser.info'
# (name query, exact-ish regex the result name must match, country code, tags)
L=[
# focus: ambient / lofi / chill
('SomaFM Groove Salad',r'^SomaFM.*Groove Salad$','US','lofi,ambient,chillout'),
('SomaFM Drone Zone',r'Drone Zone','US','ambient,meditation'),
('SomaFM Deep Space One',r'Deep Space One','US','ambient'),
('SomaFM Space Station Soma',r'Space Station','US','ambient'),
('SomaFM Lush',r'Lush','US','chillout'),
('SomaFM Fluid',r'Fluid','US','chillout'),
('SomaFM Sonic Universe',r'Sonic Universe','US','jazz'),
('SomaFM Secret Agent',r'Secret Agent','US','chillout'),
('SomaFM Illinois Street Lounge',r'Illinois Street','US','chillout'),
('SomaFM Beat Blender',r'Beat Blender','US','deep house'),
('SomaFM The Trip',r'The Trip','US','deep house'),
('SomaFM Folk Forward',r'Folk Forward','US','instrumental'),
('SomaFM Thistle Radio',r'Thistle','US','instrumental'),
('SomaFM Mission Control',r'Mission Control','US','ambient'),
('SomaFM cliqhop',r'cliqhop','US','lofi'),
('Radio Paradise',r'^Radio Paradise( \(.*\))?$','US','ambient'),
('Radio Paradise Mellow',r'Mellow','US','chillout'),
('Radio Paradise World',r'Global|World','US','instrumental'),
('NTS Radio 1',r'^NTS (Radio )?1','GB','ambient'),
('NTS Radio 2',r'^NTS (Radio )?2','GB','ambient'),
('KEXP',r'^KEXP','US','instrumental'),
('KCRW Eclectic',r'KCRW.*Eclectic','US','chillout'),
('WFMU',r'^WFMU','US','instrumental'),
('Jazz24',r'^Jazz ?24','US','jazz'),
('WWOZ',r'^WWOZ','US','jazz'),
('Radio Swiss Jazz',r'Swiss Jazz','CH','jazz'),
('Radio Swiss Classic',r'Swiss Classic','CH','classical,piano'),
('Radio Swiss Pop',r'Swiss Pop','CH','instrumental'),
('KUSC',r'^KUSC','US','classical'),
('WQXR',r'^WQXR','US','classical,piano'),
('BBC Radio 3',r'^BBC Radio 3$','GB','classical'),
('BBC Radio 4',r'^BBC Radio 4$','GB','talk,news'),
('BBC Radio 6 Music',r'6 Music','GB','instrumental'),
('BBC World Service',r'World Service','GB','news,talk'),
('BBC Radio 1',r'^BBC Radio 1$','GB','instrumental'),
('BBC Radio 2',r'^BBC Radio 2$','GB','instrumental'),
('BBC Radio 5 Live',r'5 Live','GB','news,talk'),
('Classic FM',r'^Classic FM','GB','classical'),
('Linn Classical',r'Linn Classical','GB','classical'),
('Linn Jazz',r'Linn Jazz','GB','jazz'),
('FIP',r'^FIP$','FR','jazz,instrumental'),
('France Inter',r'^France Inter','FR','talk,news'),
('France Culture',r'^France Culture','FR','talk'),
('France Musique',r'^France Musique','FR','classical'),
('franceinfo',r'^franceinfo','FR','news'),
('FIP Jazz',r'FIP.*Jazz','FR','jazz'),
('FIP Groove',r'FIP.*Groove','FR','chillout'),
('FIP Electro',r'FIP.*Electro','FR','deep house'),
('FIP Monde',r'FIP.*Monde','FR','instrumental'),
('FIP Reggae',r'FIP.*Reggae','FR','instrumental'),
('Deutschlandfunk',r'^Deutschlandfunk$','DE','news,talk'),
('Deutschlandfunk Kultur',r'Deutschlandfunk Kultur','DE','talk'),
('Deutschlandfunk Nova',r'Deutschlandfunk Nova','DE','talk'),
('WDR 3',r'^WDR 3','DE','classical'),
('NDR Kultur',r'^NDR Kultur','DE','classical'),
('BR-Klassik',r'BR-?Klassik','DE','classical'),
('SWR2',r'^SWR2','DE','classical,talk'),
('Bayern 2',r'^Bayern 2','DE','talk'),
('Radio Swiss',r'Radio Swiss','CH','instrumental'),
('SRF 2 Kultur',r'SRF 2','CH','classical,talk'),
('SRF 3',r'^SRF 3','CH','instrumental'),
('ORF Ö1',r'Ö1|Oe1','AT','talk,classical'),
('ORF FM4',r'FM4','AT','instrumental'),
('RTÉ Radio 1',r'RT[ÉE] Radio 1','IE','news,talk'),
('RTÉ lyric fm',r'lyric','IE','classical'),
('RTÉ Gold',r'RT[ÉE] (Radio )?Gold','IE','instrumental'),
('RTÉ 2fm',r'2 ?fm','IE','instrumental'),
('ABC Classic',r'ABC Classic','AU','classical,piano'),
('ABC Jazz',r'ABC Jazz','AU','jazz'),
('ABC News Radio',r'ABC NewsRadio|ABC News Radio','AU','news'),
('triple j',r'triple j|Triple J','AU','instrumental'),
('ABC Radio National',r'Radio National','AU','talk'),
('CBC Radio One',r'CBC Radio (One|1)','CA','news,talk'),
('CBC Music',r'CBC Music','CA','instrumental'),
('Radio-Canada Première',r'Premi[eè]re','CA','news,talk'),
('NRK P1',r'NRK P1','NO','news,talk'),
('NRK Klassisk',r'NRK Klassisk','NO','classical'),
('NRK P2',r'NRK P2','NO','talk'),
('NRK Jazz',r'NRK Jazz','NO','jazz'),
('NRK Nyheter',r'NRK Nyheter','NO','news'),
('DR P1',r'^DR P1','DK','news,talk'),
('DR P2',r'^DR P2','DK','classical'),
('DR P6 Beat',r'P6 Beat','DK','instrumental'),
('SR P1',r'^SR P1|Sveriges Radio P1','SE','news,talk'),
('SR P2',r'Sveriges Radio P2|^SR P2','SE','classical'),
('Yle Radio 1',r'Yle Radio 1','FI','news,talk'),
('Yle Klassinen',r'Klassinen','FI','classical'),
('RNZ National',r'RNZ National','NZ','news,talk'),
('RNZ Concert',r'RNZ Concert','NZ','classical'),
('NPO Radio 1',r'NPO Radio 1$','NL','news,talk'),
('NPO Radio 2',r'NPO Radio 2$','NL','instrumental'),
('NPO Klassiek',r'NPO (Radio 4|Klassiek)','NL','classical'),
('NPO Soul',r'NPO Soul','NL','jazz'),
('Klara',r'^Klara','BE','classical'),
('Radio Nacional de España',r'Radio Nacional','ES','news,talk'),
('RNE Radio Clásica',r'Radio Cl[aá]sica','ES','classical'),
('Rai Radio 3',r'Rai Radio 3|RAI Radio 3','IT','classical'),
('Rai Radio 1',r'Rai Radio 1|RAI Radio 1','IT','news,talk'),
('Antena 2',r'Antena 2','PT','classical'),
('Polskie Radio Dwójka',r'Dw[oó]jka','PL','classical'),
('Polskie Radio 24',r'Polskie Radio 24','PL','news'),
('Radio Bremen Nordwestradio',r'Nordwestradio','DE','instrumental'),
('Concertzender',r'Concertzender','NL','classical,jazz'),
('Venice Classic Radio',r'Venice Classic','IT','classical,piano'),
('Radio Art Piano',r'Radio Art.*Piano','FR','piano'),
('Calm Radio',r'^Calm Radio','CA','meditation,nature'),
('Nature Sounds',r'Nature','','nature'),
('Chillhop',r'Chillhop','','lofi'),
('Lofi Girl',r'Lofi Girl|Lo-?fi Radio','','lofi'),
('Jazz FM',r'^Jazz FM','GB','jazz'),
('JAZZ RADIO',r'^Jazz Radio','FR','jazz'),
('WBGO',r'^WBGO','US','jazz'),
('KNKX',r'^KNKX','US','jazz'),
('WNYC FM',r'^WNYC','US','news,talk'),
('KQED',r'^KQED','US','news,talk'),
('WBUR',r'^WBUR','US','news,talk'),
('WAMU',r'^WAMU','US','news,talk'),
('NPR',r'^NPR','US','news,talk'),
('WXPN',r'^WXPN','US','instrumental'),
('KCRW',r'^KCRW','US','instrumental'),
('Capital Public Radio',r'Capital Public','US','news'),
('Minnesota Public Radio',r'^MPR|Minnesota Public','US','news'),
('WFMT',r'^WFMT','US','classical'),
('Interlochen',r'Interlochen','US','classical'),
('Naturescapes',r'Naturescapes','','nature'),
('Ambient Sleeping Pill',r'Sleeping Pill','','ambient,meditation'),
('Dublab',r'dublab','US','instrumental'),
('Radio Nova',r'^Nova','','instrumental'),
('Mixcloud',r'zzzzzz','','x'),
]
ctx=ssl.create_default_context()
def get(u,t=12):
    return urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'friction-curate/1.0'}),timeout=t,context=ctx)
def alive(u):
    try:
        r=get(u,8); ct=(r.headers.get('content-type') or '').lower(); r.read(512)
        return r.status==200 and ('audio' in ct or 'ogg' in ct or 'octet' in ct or 'mpeg' in ct or 'aac' in ct)
    except Exception: return False
def pick(item):
    q,rx,cc,tags=item
    try:
        p=urllib.parse.urlencode({'name':q,'hidebroken':'true','order':'votes','reverse':'true','limit':'25','is_https':'true'}|({'countrycode':cc} if cc else {}))
        d=json.load(get(BASE+'/json/stations/search?'+p))
    except Exception as e: return q,None,str(e)
    for s in d:
        if not re.search(rx,s['name'].strip(),re.I): continue
        if s.get('hls') or s['codec'].upper() not in ('MP3','AAC','AAC+','OGG','AAC+'): continue
        if not s['url_resolved'].startswith('https://') or not s.get('lastcheckok'): continue
        if s['bitrate'] and s['bitrate']<64: continue
        if alive(s['url_resolved']): return q,s,tags
    return q,None,'none'
out=[];miss=[]
with cf.ThreadPoolExecutor(12) as ex:
    for q,s,t in ex.map(pick,L):
        if s: out.append({'uuid':s['stationuuid'],'name':s['name'].strip(),'url':s['url_resolved'],'logo':(s['favicon'] if s['favicon'].startswith('https://') else None),'country':s['country'],'cc':s['countrycode'],'codec':s['codec'],'bitrate':s['bitrate'],'tags':t.split(','),'home':s.get('homepage') or None})
        else: miss.append(q)
print(len(out),'found;',len(miss),'missing:',miss)
json.dump(out,open('radio.json','w'),ensure_ascii=False,indent=0)
for o in out: print(o['cc'],o['name'],o['codec'],o['bitrate'])
