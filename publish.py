#!/usr/bin/env python3
"""Create the requested public repo, push without force, then enable Pages.

Uses the user's existing GitHub CLI authentication. Never reads credentials.
The local state file binds retries to the repository this invocation created.
"""
import argparse
import json
import pathlib
import re
import shutil
import subprocess
import sys
import time

ROOT=pathlib.Path(__file__).resolve().parent
STATE=ROOT/'.teard0wn-publish.json'
PROJECT_FILES=['.github','.gitignore','.nojekyll','LICENSE','README.md','build.py',
               'index.html','mark.svg','native','package.json','publish.py','src',
               'tests','docs','dist']

def command(args, *, data=None, check=True):
    result=subprocess.run(args,cwd=ROOT,input=data,text=True,capture_output=True)
    if check and result.returncode:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or 'Command failed: '+args[0])
    return result

def api(path,method='GET',payload=None,check=True):
    args=['gh','api',path,'--method',method]
    if payload is not None: args.extend(['--input','-'])
    result=command(args,data=json.dumps(payload) if payload is not None else None,check=check)
    return result

def persist(state):
    temporary=STATE.with_suffix('.tmp')
    temporary.write_text(json.dumps(state,indent=2)+'\n')
    temporary.replace(STATE)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--owner',default='himasudo')
    parser.add_argument('--repo',default='teard0wn-lab')
    parser.add_argument('--resume',action='store_true',help='Resume only the repository recorded by this folder’s prior attempt')
    args=parser.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9-]{0,38}',args.owner) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,99}',args.repo):
        raise RuntimeError('Invalid owner or repository name.')
    for executable in ('git','gh','node'):
        if not shutil.which(executable): raise RuntimeError(f'{executable} is required. Install it, then rerun this command.')
    for filename in PROJECT_FILES:
        if not (ROOT/filename).exists(): raise RuntimeError(f'Project file missing: {filename}')
    if command(['gh','auth','status'],check=False).returncode:
        raise RuntimeError('GitHub CLI is not signed in. Run gh auth login --web, then rerun this command. Never paste tokens into chat.')
    profile=json.loads(api('user').stdout)
    if profile['login'].lower()!=args.owner.lower():
        raise RuntimeError(f'Signed in as {profile["login"]}, but target owner is {args.owner}. Select the correct GitHub CLI account first.')
    full=f'{args.owner}/{args.repo}'
    check=command(['git','rev-parse','--show-toplevel'],check=False)
    if check.returncode==0 and pathlib.Path(check.stdout.strip()).resolve()!=ROOT:
        raise RuntimeError('This project is inside another Git repository. Extract it into its own folder first.')
    print('Checking the engine and lesson contracts...',flush=True)
    tests=command(['node','--test','tests/machine.test.js'])
    print(tests.stdout.strip())
    command([sys.executable,'build.py'])
    if STATE.exists():
        if not args.resume: raise RuntimeError('A previous publish attempt exists. Use python3 publish.py --resume to continue it.')
        state=json.loads(STATE.read_text())
        if state.get('repository')!=full: raise RuntimeError('Resume target does not match the recorded repository.')
        repo=json.loads(api('repos/'+full).stdout)
        if repo['id']!=state.get('repository_id') or repo['private']:
            raise RuntimeError('Repository identity or public visibility changed. Stop and review it manually.')
    else:
        if args.resume: raise RuntimeError('No publish state exists in this folder.')
        # This command fails rather than modifying any repository of the same name.
        print(f'Creating public repository {full}...',flush=True)
        command(['gh','repo','create',full,'--public','--description','Original systems and security lessons with an inspectable x86-64 workbench.'])
        repo=json.loads(api('repos/'+full).stdout)
        state={'repository':full,'repository_id':repo['id'],'phase':'created'};persist(state)
    if not (ROOT/'.git').exists(): command(['git','init','-b','main'])
    branch=command(['git','branch','--show-current']).stdout.strip()
    if branch!='main': raise RuntimeError(f'Expected the main branch, found {branch}. No branch was changed.')
    origin=command(['git','remote','get-url','origin'],check=False)
    remote=f'https://github.com/{full}.git'
    if origin.returncode: command(['git','remote','add','origin',remote])
    elif origin.stdout.strip()!=remote: raise RuntimeError('Existing origin differs from the requested repository.')
    command(['git','add','--',*PROJECT_FILES])
    if command(['git','diff','--cached','--quiet'],check=False).returncode:
        email=f'{profile["id"]}+{profile["login"]}@users.noreply.github.com'
        command(['git','-c',f'user.name={profile["login"]}','-c',f'user.email={email}',
                 'commit','-m','Build teard0wn lab foundation and executable investigations'])
    # Use gh's credential helper for this command only. No global Git settings change.
    command(['git','-c','credential.https://github.com.helper=!gh auth git-credential',
             'push','--set-upstream','origin','main'])
    sha=command(['git','rev-parse','HEAD']).stdout.strip()
    state.update(phase='pushed',commit=sha);persist(state)
    print('Repository pushed. Waiting for Verify lab on this commit...',flush=True)
    verified=False
    for _ in range(120):
        runs=command(['gh','run','list','--repo',full,'--commit',sha,'--workflow','checks.yml',
                      '--limit','1','--json','status,conclusion,url'],check=False)
        if runs.returncode==0:
            values=json.loads(runs.stdout)
            if values and values[0]['status']=='completed':
                if values[0]['conclusion']!='success':
                    raise RuntimeError('Verify lab did not pass. Pages was not enabled. Review '+values[0]['url'])
                verified=True;break
        time.sleep(5)
    if not verified: raise RuntimeError('CI has not finished. Repository is saved; rerun with --resume after checking its Actions page. Pages was not enabled.')
    state['phase']='verified';persist(state)
    existing=api('repos/'+full+'/pages',check=False)
    payload={'build_type':'legacy','source':{'branch':'main','path':'/'}}
    if existing.returncode==0:
        pages=json.loads(existing.stdout)
        if pages.get('cname'): raise RuntimeError('A custom domain is configured. Review Pages settings manually; it was not changed.')
        api('repos/'+full+'/pages','PUT',payload)
    elif '404' in existing.stderr:
        api('repos/'+full+'/pages','POST',payload)
    else: raise RuntimeError(existing.stderr.strip())
    state['phase']='pages-enabled';persist(state)
    print(f'Repository: https://github.com/{full}',flush=True)
    print('Pages is enabled. Waiting for its build...',flush=True)
    for _ in range(60):
        result=api('repos/'+full+'/pages',check=False)
        if result.returncode==0:
            page=json.loads(result.stdout)
            if page.get('status')=='built':
                state['phase']='pages-built';state['site_url']=page['html_url'];persist(state)
                print('Pages build completed: '+page['html_url']);return
            if page.get('status')=='errored': raise RuntimeError('Pages build failed. Inspect the repository’s Pages/Actions status.')
        time.sleep(5)
    print('Pages remains pending. Check the repository’s Pages settings for its final URL.')

if __name__=='__main__':
    try: main()
    except (RuntimeError,ValueError,KeyError,OSError) as exc:
        print('STOP: '+str(exc),file=sys.stderr)
        if STATE.exists(): print('The created repository and local work are retained. Resume with: python3 publish.py --resume',file=sys.stderr)
        raise SystemExit(1)
