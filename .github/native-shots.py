# Puts the native app's screenshots on the run as notices (small JPEGs, base64, in pieces), so they can be
# looked at without signing in to GitHub. Used by .github/workflows/native-ios.yml:
#   python3 .github/native-shots.py home letters …
import base64, os, subprocess, sys

shots = os.path.join(os.environ.get('RUNNER_TEMP', '.'), 'shots')
PIECE = 40000

for name in sys.argv[1:]:
    png = os.path.join(shots, name + '.png')
    if not os.path.exists(png):
        print(f'::warning title=shot {name}::no screenshot')
        continue
    jpg = os.path.join(shots, name + '.jpg')
    subprocess.run(['sips', '-Z', '860', '-s', 'format', 'jpeg', '-s', 'formatOptions', '45', png, '--out', jpg], check=True, capture_output=True)
    data = base64.b64encode(open(jpg, 'rb').read()).decode()
    pieces = [data[i:i + PIECE] for i in range(0, len(data), PIECE)]
    for i, p in enumerate(pieces):
        print(f'::notice title=shot {name} {i + 1}/{len(pieces)}::{p}')
