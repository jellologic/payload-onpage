// Regenerate the documentation media: screenshots and recordings of examples/basic
// (e2e/media.capture.ts), then each recording → an optimized GIF in docs/media.
// Needs the packages built (`bun run build`) and ffmpeg on PATH.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const VIDEO_DIR = '/tmp/payload-onpage-media-video'
const MEDIA = 'docs/media'
/** GIF width (px) and frame rate: readable in a README, small enough to load fast. */
const WIDTH = 880
const FPS = 10

rmSync(VIDEO_DIR, { recursive: true, force: true })
execFileSync('bunx', ['playwright', 'test', '-c', 'e2e/media.config.ts'], { stdio: 'inherit' })

for (const name of readdirSync(VIDEO_DIR)) {
  const dir = join(VIDEO_DIR, name)
  const webm = readdirSync(dir).find((f) => f.endsWith('.webm'))
  if (!webm) continue
  const gif = join(MEDIA, `${name}.gif`)
  // Two-pass palette: far smaller and cleaner than ffmpeg's default GIF palette.
  const filters = `fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`
  // -ss skips the blank first frames before the page paints.
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-ss',
    '0.8',
    '-i',
    join(dir, webm),
    '-vf',
    filters,
    '-loop',
    '0',
    gif,
  ])
  console.log(`${gif}  ${(statSync(gif).size / 1024).toFixed(0)} KB`)
}
for (const f of readdirSync(MEDIA).filter((f) => f.endsWith('.png')))
  console.log(`${join(MEDIA, f)}  ${(statSync(join(MEDIA, f)).size / 1024).toFixed(0)} KB`)
if (!existsSync(MEDIA)) process.exit(1)
