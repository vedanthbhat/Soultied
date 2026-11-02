# Keeps what the native iPhone app's run produced on the `native-shots` branch (replaced every run), so it can
# be looked at without signing in to GitHub: the screenshots from the demo room, and the build's errors and
# warnings. Used by .github/workflows/native-ios.yml:
#   GH_TOKEN=… python3 .github/native-shots.py
import glob, os, re, shutil, subprocess

tmp = os.environ.get('RUNNER_TEMP', '.')
sha = os.environ.get('GITHUB_SHA', '')
repo = os.environ.get('GITHUB_REPOSITORY', '')
run = f"{os.environ.get('GITHUB_SERVER_URL', 'https://github.com')}/{repo}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}"
out = os.path.join(tmp, 'native-shots')
shutil.rmtree(out, ignore_errors=True)
os.makedirs(out)

# the screenshots, as JPEGs a little smaller than the simulator's
shots = sorted(glob.glob(os.path.join(tmp, 'shots', '*.png')))
for png in shots:
    name = os.path.splitext(os.path.basename(png))[0]
    jpg = os.path.join(out, name + '.jpg')
    subprocess.run(['sips', '-Z', '1200', '-s', 'format', 'jpeg', '-s', 'formatOptions', '70', png, '--out', jpg], check=True, capture_output=True)

# the shared code's tests (the end of the log), and the build's errors and warnings (each once)
core = os.path.join(tmp, 'core.log')
if os.path.exists(core):
    lines = open(core, errors='replace').read().splitlines()
    open(os.path.join(out, 'core-tests.txt'), 'w').write('\n'.join(lines[-400:]) + '\n')
build = os.path.join(tmp, 'build.log')
if os.path.exists(build):
    seen, keep = set(), []
    for line in open(build, errors='replace'):
        line = line.rstrip('\n')
        if re.search(r'(error|warning):', line) or '** BUILD' in line:
            short = re.sub(r'^/\S*?/native/', 'native/', line)
            if short not in seen:
                seen.add(short)
                keep.append(short)
    open(os.path.join(out, 'build.txt'), 'w').write('\n'.join(keep[:3000]) + '\n')

with open(os.path.join(out, 'README.md'), 'w') as f:
    f.write(f'# The iPhone app, as of {sha[:7]}\n\nFrom {run}\n\n')
    for png in shots:
        name = os.path.splitext(os.path.basename(png))[0]
        f.write(f'## {name}\n\n![{name}]({name}.jpg)\n\n')

def git(*args):
    subprocess.run(['git', *args], cwd=out, check=True)

git('init', '-q')
git('checkout', '-q', '-b', 'native-shots')
git('add', '-A')
git('-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-q', '-m', f'The iPhone app as of {sha[:7]}')
token = os.environ['GH_TOKEN']
git('push', '-q', '-f', f'https://x-access-token:{token}@github.com/{repo}.git', 'HEAD:refs/heads/native-shots')
print(f'kept {len(shots)} screenshots on the native-shots branch')
