from pathlib import Path
from PIL import Image

frames_dir = Path('docs/demo-frames')
paths = sorted(frames_dir.glob('*.png'))
if len(paths) != 7:
    raise SystemExit(f'Expected 7 frames, found {len(paths)}')

frames = []
for path in paths:
    with Image.open(path) as image:
        frame = image.convert('RGB')
        frame.thumbnail((390, 844))
        frames.append(frame.convert('P', palette=Image.Palette.ADAPTIVE, colors=128))

output = Path('docs/demo.gif')
frames[0].save(output, save_all=True, append_images=frames[1:], duration=[1300, 1300, 1500, 1500, 1500, 1800, 1800], loop=0, optimize=True)
print(f'Created {output} ({output.stat().st_size} bytes)')
