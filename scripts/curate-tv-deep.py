# Adds channels in more categories and drops dead ones from src/lib/curated-tv.json.
# Needs /tmp/iptvd/{channels,streams,logos}.json from https://iptv-org.github.io/api/.
# A stream counts as alive only when the master playlist, a variant playlist and the first media segment all answer (a master that answers
# while its variants 404, as ABC News Live did, is dead), and as playable from here only with CORS for our origin.
# A candidate is kept only when the stream host carries a word of the channel's own name or owner (the broadcaster's own server, not a re-host).
# It writes candidates to /tmp/iptvd/more.json for a person to read before they go in the list; nothing is added by itself.
import json,re,ssl,sys,urllib.request,urllib.parse,collections,concurrent.futures as cf
D='/tmp/iptvd/'; ORIGIN='https://www.frictionx.app'
ctx=ssl.create_default_context()
def get(url,n=60000,t=10):
    r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 (friction-check)','Origin':ORIGIN}),timeout=t,context=ctx)
    return r.status,r.headers.get('access-control-allow-origin'),r.read(n)
def deep(url):
    try:
        st,cors,b=get(url)
        if st!=200 or not b.startswith(b'#EXTM3U') or cors not in ('*',ORIGIN): return False
        t=b.decode('utf8','replace'); lines=[l.strip() for l in t.splitlines() if l.strip()]
        for _ in range(2):
            if any(l.startswith('#EXT-X-STREAM-INF') for l in lines):
                v=[l for l in lines if not l.startswith('#')]
                if not v: return False
                url=urllib.parse.urljoin(url,v[len(v)//2 if len(v)>2 else 0]); st,cors,b=get(url)
                if st!=200: return False
                lines=[l.strip() for l in b.decode('utf8','replace').splitlines() if l.strip()]
            else: break
        segs=[l for l in lines if not l.startswith('#')]
        if not segs: return False
        s=urllib.parse.urljoin(url,segs[-1]); r=urllib.request.urlopen(urllib.request.Request(s,headers={'User-Agent':'Mozilla/5.0','Range':'bytes=0-1023'}),timeout=10,context=ctx)
        return r.status in (200,206)
    except Exception: return False
if __name__=='__main__':
    cur=json.load(open('src/lib/curated-tv.json'))
    if '--prune' in sys.argv:
        with cf.ThreadPoolExecutor(20) as ex: ok=list(ex.map(lambda r:deep(r['url']),cur))
        for r,o in zip(cur,ok):
            if not o: print('DEAD',r['name'])
        json.dump([r for r,o in zip(cur,ok) if o],open('src/lib/curated-tv.json','w'),ensure_ascii=False,indent=1); sys.exit()
    WANT={'documentary','science','lifestyle','travel','cooking','business','weather','relax','comedy','animation','classic','outdoor','entertainment','movies','series','family','culture','music','sports','kids','education','public','news','general'}
    ch={x['id']:x for x in json.load(open(D+'channels.json'))}
    have={r['id'] for r in cur}
    logos=collections.defaultdict(list)
    for l in json.load(open(D+'logos.json')):
        if l.get('channel') and l.get('url','').startswith('https://'): logos[l['channel']].append(l)
    SHORT={'dw','nhk','abc','sbs','bbc','cbc','ard','zdf','srf','rts','rsi','svt','yle','nrk','orf','rtp','rte','vrt','npo','tvp','kbs','cna','pbs','rai','trt','ert','err','hrt','rtl','tg4','bvn','tv5','cgtn','arte','tvnz','ntv','nasa','esa','ndr','wdr','mdr','swr','rbb','br','hr','sr','dr','nos','rtve','tve','tvr','rtr','rtv','vtm','sbt','tvbs'}
    def words(x): return {w for w in re.findall(r'[a-z0-9]{2,}',' '.join([x['name'],x.get('network') or '',*x.get('owners',[]),*x.get('alt_names',[])]).lower())}-{'television','channel','tv','radio','network','news','live','group','media','online','international','broadcasting','digital'}
    by=collections.defaultdict(list)
    for s in json.load(open(D+'streams.json')):
        c=ch.get(s['channel']);
        if not c or c['id'] in have or c.get('closed') or c.get('is_nsfw') or not WANT&set(c['categories']): continue
        if not s['url'].startswith('https://') or s.get('user_agent') or s.get('referrer') or set(s.get('labels') or [])&{'Geo-blocked','Not 24/7'}: continue
        host=urllib.parse.urlparse(s['url']).hostname or ''
        hw=set(re.findall(r'[a-z0-9]{2,}',host)); ws=words(c)
        if {w for w in ws&hw if len(w)>=4 or w in SHORT} or any(w in host.replace('-','') for w in ws if len(w)>=5): by[c['id']].append(s)
    print(len(by),'candidates with a host that carries the channel name')
    def pick(cid):
        for s in sorted(by[cid],key=lambda x:-int((re.match(r'(\d+)',x.get('quality') or '') or [0,0])[1] or 0))[:2]:
            if deep(s['url']): return cid,s
        return cid,None
    out=[]
    with cf.ThreadPoolExecutor(24) as ex:
        for cid,s in ex.map(pick,list(by)):
            if s:
                c=ch[cid]; lg=sorted(logos.get(cid,[]),key=lambda l:-(l.get('width') or 0))
                out.append({'id':cid,'name':c['name'],'url':s['url'],'logo':lg[0]['url'] if lg else None,'cc':c['country'],'cats':c['categories'],'host':urllib.parse.urlparse(s['url']).hostname})
    json.dump(out,open(D+'more.json','w'),ensure_ascii=False,indent=1)
    print(len(out),'alive and playable'); 
    for o in sorted(out,key=lambda o:(o['cats'][0],o['name'])): print(o['cats'][0].ljust(12),o['cc'],o['name'][:34].ljust(34),o['host'])
