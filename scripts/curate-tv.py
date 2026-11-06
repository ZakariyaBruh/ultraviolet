# Rebuilds the curated TV list (src/lib/curated-tv.json). Needs /tmp/iptvd/{channels,streams,logos}.json from https://iptv-org.github.io/api/ and the allowlists in this repo notes:
# owner names of public-service and international broadcasters, then only streams on the broadcaster's own hosts (see CLAUDE.md), then a live check. Run it now and then: streams move.
import json,collections,urllib.request,ssl,concurrent.futures as cf,re
ids=set(json.load(open('sel_ids.json')))
c={x['id']:x for x in json.load(open('channels.json'))}
s=json.load(open('streams.json'))
logos=collections.defaultdict(list)
for l in json.load(open('logos.json')):
    if l.get('channel') and l.get('url','').startswith('https://'): logos[l['channel']].append(l)
by=collections.defaultdict(list)
for x in s:
    if x['channel'] in ids and x['url'].startswith('https://') and not x.get('user_agent') and not x.get('referrer') and 'Geo-blocked' not in (x['labels'] or []) and 'Not 24/7' not in (x['labels'] or []): by[x['channel']].append(x)
def q(x):
    m=re.match(r'(\d+)',x.get('quality') or ''); return -(int(m.group(1)) if m else 0)
ctx=ssl.create_default_context()
def alive(url):
    try:
        r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (friction-check)'}),timeout=9,context=ctx)
        if r.status!=200: return False
        b=r.read(2000)
        return b.startswith(b'#EXTM3U') or '.m3u8' not in url
    except Exception: return False
def best(cid):
    for x in sorted(by[cid],key=q)[:3]:
        if alive(x['url']): return cid,x
    return cid,None
out=[]
with cf.ThreadPoolExecutor(24) as ex:
    for cid,x in ex.map(best,list(by)):
        if x: out.append((cid,x))
print(len(by),'with candidates;',len(out),'alive')
res=[]
for cid,x in out:
    ch=c[cid]
    lg=sorted(logos.get(cid,[]),key=lambda l:-(l.get('width') or 0))
    res.append({'id':cid,'name':ch['name'],'url':x['url'],'logo':(lg[0]['url'] if lg else None),'country':ch['country'],'cats':ch['categories'],'q':x.get('quality')})
json.dump(res,open('tv_alive.json','w'),ensure_ascii=False)
print(collections.Counter(r['country'] for r in res).most_common(30))
