#!/usr/bin/env python3
"""Create a portable single-file build, with CSP hashes and no network assets."""
import base64
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent

def build():
    modules=[]
    logo='data:image/svg+xml;base64,'+base64.b64encode((ROOT/'mark.svg').read_bytes()).decode()
    for name in ('machine.js','curriculum.js','lessons.js','compiled.js','micro.js','fuzz.js','fuzzer.js','tso.js','elfdata.js','cfg.js','diff.js','diffpairs.js','app.js'):
        text=(ROOT/'src'/name).read_text()
        text=re.sub(r'^import .*?;\n','',text,flags=re.MULTILINE)
        text=re.sub(r'^export (?=(const|class|function)\b)','',text,flags=re.MULTILINE)
        text=text.replace('./mark.svg',logo)
        modules.append('// '+name+'\n'+text)
    script='\n'.join(modules)
    if '</script' in script.lower(): raise ValueError('Script closing tag must be escaped before bundling')
    css=(ROOT/'src/styles.css').read_text()
    sh=base64.b64encode(hashlib.sha256(script.encode()).digest()).decode()
    ch=base64.b64encode(hashlib.sha256(css.encode()).digest()).decode()
    html=(ROOT/'index.html').read_text()
    html=html.replace("script-src 'self'",f"script-src 'sha256-{sh}'")
    html=html.replace("style-src 'self'",f"style-src 'sha256-{ch}'")
    html=html.replace('href="./mark.svg"',f'href="{logo}"')
    html=html.replace('<link rel="stylesheet" href="./src/styles.css">','<style>'+css+'</style>')
    html=html.replace('<script type="module" src="./src/app.js"></script>','<script type="module">'+script+'</script>')
    out=ROOT/'dist';out.mkdir(exist_ok=True)
    dest=out/'teard0wn-lab.html';dest.write_text(html)
    print(f'Built {dest.name}: {dest.stat().st_size:,} bytes')
    return dest

if __name__=='__main__': build()
