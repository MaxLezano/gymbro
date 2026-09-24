// Generates GymBro mockup imagery (program covers, welcome backgrounds) on a
// local ComfyUI server with DreamShaper XL Turbo (8 steps). Exercise media is NOT
// generated: it comes from the exercises dataset.
//
// Usage: start ComfyUI on 127.0.0.1:8188, then `node scripts/media/generate_images.mjs [name...]`.
// Two seeds per image land in scripts/media/out/raw; pick one, crop to 800x450
// (covers) or 720px wide (welcome) and replace the file in assets/images/.
import fs from 'node:fs';
import path from 'node:path';

const HOST = process.env.COMFY_HOST ?? 'http://127.0.0.1:8188';
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/(\w:)/, '$1'), 'out', 'raw');
fs.mkdirSync(OUT, { recursive: true });

const STYLE =
  'cinematic photo, dark moody gym interior, near-black background, warm amber rim light, dramatic chiaroscuro lighting, ' +
  'high contrast, shallow depth of field, 35mm lens, subtle film grain, professional fitness editorial photography, sharp focus';
const NEGATIVE =
  'text, watermark, logo, letters, signature, lowres, blurry, jpeg artifacts, deformed hands, extra fingers, missing fingers, ' +
  'extra limbs, bad anatomy, disfigured face, cartoon, illustration, 3d render, bright white background, oversaturated, neon blue';

const PORTRAIT = [832, 1216];
const LANDSCAPE = [1216, 832];

const JOBS = [
  ['welcome_1', PORTRAIT, 'muscular man lifting a heavy barbell deadlift, chalk dust floating in the air, determined expression'],
  ['welcome_2', PORTRAIT, 'athletic woman holding a pair of dumbbells, confident look, standing in a dark gym, side light'],
  ['welcome_3', PORTRAIT, 'athlete resting on a bench after training, towel on shoulder, looking at phone, calm focused mood'],
  ['cover_push', LANDSCAPE, 'athlete bench pressing a loaded barbell on a flat bench, chest and triceps'],
  ['cover_pull', LANDSCAPE, 'muscular back of an athlete doing pull-ups on a bar, lats flexed, view from behind'],
  ['cover_legs', LANDSCAPE, 'athlete performing a deep barbell back squat in a squat rack, powerful legs'],
  ['cover_full_body', LANDSCAPE, 'athlete swinging a kettlebell, full body movement, dynamic pose'],
  ['cover_upper', LANDSCAPE, 'athlete doing seated dumbbell shoulder press, strong shoulders and arms'],
  ['cover_arms', LANDSCAPE, 'close up of an athlete doing a dumbbell biceps curl, veins, arm muscles'],
  ['cover_core', LANDSCAPE, 'athlete holding a forearm plank on a mat, core engaged, low camera angle'],
  ['cover_glutes', LANDSCAPE, 'woman doing a barbell hip thrust on a bench, glutes, side view'],
  ['cover_home', LANDSCAPE, 'person doing push-ups on a living room floor at night, dumbbells and yoga mat nearby, cozy dark apartment, warm lamp light'],
  ['cover_hiit', LANDSCAPE, 'athlete doing explosive jump training, sweat droplets, motion, intense conditioning workout'],
  ['cover_cardio', LANDSCAPE, 'runner on a treadmill in a dark gym, motion blur on legs, endurance training'],
];

function workflow(prompt, [width, height], seed, prefix) {
  return {
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'DreamShaperXL_Turbo_v2_1.safetensors' } },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: `${prompt}, ${STYLE}`, clip: ['4', 1] } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: NEGATIVE, clip: ['4', 1] } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 } },
    '3': {
      class_type: 'KSampler',
      inputs: { seed, steps: 8, cfg: 2, sampler_name: 'dpmpp_sde', scheduler: 'karras', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] },
    },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    '9': { class_type: 'SaveImage', inputs: { filename_prefix: `gymbro/${prefix}`, images: ['8', 0] } },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name, size, prompt, seed) {
  const res = await fetch(`${HOST}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow(prompt, size, seed, name), client_id: 'gymbro-media' }),
  });
  const { prompt_id, error, node_errors } = await res.json();
  if (!prompt_id) throw new Error(`${name}: ${JSON.stringify(error ?? node_errors)}`);
  for (;;) {
    await sleep(1500);
    const history = await (await fetch(`${HOST}/history/${prompt_id}`)).json();
    const entry = history[prompt_id];
    if (!entry) continue;
    const image = entry.outputs?.['9']?.images?.[0];
    if (!image) throw new Error(`${name}: no output (${JSON.stringify(entry.status)})`);
    const url = `${HOST}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder)}&type=output`;
    const buffer = Buffer.from(await (await fetch(url)).arrayBuffer());
    const file = path.join(OUT, `${name}_s${seed}.png`);
    fs.writeFileSync(file, buffer);
    return file;
  }
}

const only = process.argv.slice(2);
const seeds = [101, 202];
for (const [name, size, prompt] of JOBS) {
  if (only.length && !only.includes(name)) continue;
  for (const seed of seeds) {
    const t0 = Date.now();
    const file = await run(name, size, prompt, seed);
    console.log(`${name} seed ${seed} -> ${path.basename(file)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}
