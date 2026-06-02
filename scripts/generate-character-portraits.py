#!/usr/bin/env python3
"""Generate local SDXL portraits for the racer character selector."""

from __future__ import annotations

import argparse
import gc
from dataclasses import dataclass
from pathlib import Path

import torch
from diffusers import DPMSolverMultistepScheduler, StableDiffusionXLImg2ImgPipeline, StableDiffusionXLPipeline


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "images" / "characters"
VARIANT_DIR = Path("/tmp/racing-character-portraits")
BASE_MODEL = Path("/home/sam/claude-workspace/ComfyUI/models/checkpoints/Juggernaut-XL_v9_RunDiffusionPhoto_v2.safetensors")
REFINER_MODEL = Path("/home/sam/claude-workspace/ComfyUI/models/checkpoints/sd_xl_refiner_1.0.safetensors")


@dataclass(frozen=True)
class CharacterPrompt:
    id: str
    seed: int
    prompt: str
    prompt_2: str
    final_pass: int = 2


CHARACTERS = [
    CharacterPrompt(
        id="emberclaw-drake",
        seed=23011,
        prompt=(
            "tough arcade racing game character portrait, Emberclaw Drake, anthropomorphic dragon warlord racer, "
            "nonhuman reptilian dragon head, burnished red scales, horns, fangs, black racing armor, glowing amber eyes"
        ),
        prompt_2=(
            "cinematic neon harbor garage backdrop, half-body hero bust, sharp silhouette, polished AAA game key art, "
            "high detail scales and armor, warm fire rim light, cool cyan fill light, centered composition, no human face"
        ),
    ),
    CharacterPrompt(
        id="kage-viper",
        seed=23047,
        prompt=(
            "tough arcade racing game character portrait, Kage Viper, masked ninja racer, matte black tactical suit, "
            "emerald visor, serpent crest, fast and dangerous"
        ),
        prompt_2=(
            "cinematic neon harbor garage backdrop, half-body hero bust, sharp silhouette, polished AAA game key art, "
            "green edge lighting, smoke wisps, precise armor plates, centered composition"
        ),
    ),
    CharacterPrompt(
        id="iron-valkyrie",
        seed=23101,
        prompt=(
            "tough arcade racing game character portrait, Iron Valkyrie, armored storm captain racer, steel winged helmet, "
            "scarred silver battle armor, blue electric accents, fearless warrior expression, heavy shield shoulder plates"
        ),
        prompt_2=(
            "cinematic neon harbor garage backdrop, half-body hero bust, sharp silhouette, polished AAA game key art, "
            "crisp metal texture, cool lightning rim light, heroic Norse racing champion posture, centered composition"
        ),
        final_pass=1,
    ),
    CharacterPrompt(
        id="void-revenant",
        seed=23159,
        prompt=(
            "tough arcade racing game character portrait, Void Revenant, nitro phantom racer, dark spectral armor, "
            "violet flame visor, torn racing cloak, intimidating calm"
        ),
        prompt_2=(
            "cinematic neon harbor garage backdrop, half-body hero bust, sharp silhouette, polished AAA game key art, "
            "purple energy glow, glossy black armor, high contrast vapor trails, centered composition"
        ),
    ),
]

NEGATIVE_PROMPT = (
    "text, letters, logo, watermark, signature, blurry, low detail, low contrast, duplicate face, extra limbs, "
    "deformed hands, cropped head, tiny subject, full body far away, car blocking character, helmet covering all identity, "
    "cute mascot, childish, gore, blood, horror, realistic human celebrity, flat icon, vector art"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--passes", type=int, default=2, help="Variants per character. Defaults to 2.")
    parser.add_argument("--steps", type=int, default=35, help="Inference steps per base/refiner pass.")
    parser.add_argument("--guidance", type=float, default=8.0, help="Classifier-free guidance scale.")
    parser.add_argument("--width", type=int, default=1024)
    parser.add_argument("--height", type=int, default=1024)
    parser.add_argument("--final-pass", type=int, default=0, help="1-based variant copied to the final asset path. Defaults to each character preference.")
    parser.add_argument("--only", nargs="*", default=None, help="Optional character ids to generate.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.passes < 1:
        raise SystemExit("--passes must be at least 1")
    if args.final_pass < 0 or args.final_pass > args.passes:
        raise SystemExit("--final-pass must be within --passes")
    if not torch.cuda.is_available():
        raise SystemExit("CUDA is required for local GPU generation")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    VARIANT_DIR.mkdir(parents=True, exist_ok=True)
    torch.cuda.empty_cache()

    print(f"Loading Juggernaut XL base: {BASE_MODEL}")
    base = StableDiffusionXLPipeline.from_single_file(
        str(BASE_MODEL),
        torch_dtype=torch.float16,
        use_safetensors=True,
    )
    configure_pipeline(base)
    base.enable_model_cpu_offload()
    base.vae.enable_tiling()

    print(f"Loading SDXL refiner: {REFINER_MODEL}")
    refiner = StableDiffusionXLImg2ImgPipeline.from_single_file(
        str(REFINER_MODEL),
        torch_dtype=torch.float16,
        use_safetensors=True,
    )
    configure_pipeline(refiner)
    refiner.enable_model_cpu_offload()
    refiner.vae.enable_tiling()

    requested_ids = set(args.only) if args.only else None
    selected_characters = [character for character in CHARACTERS if requested_ids is None or character.id in requested_ids]
    if requested_ids and len(selected_characters) != len(requested_ids):
        known = ", ".join(character.id for character in CHARACTERS)
        raise SystemExit(f"Unknown --only id. Known ids: {known}")

    for character in selected_characters:
        final_pass = args.final_pass or character.final_pass
        if final_pass > args.passes:
            raise SystemExit(f"{character.id} final pass {final_pass} is greater than --passes {args.passes}")
        final_variant_path = None
        for pass_index in range(1, args.passes + 1):
            seed = character.seed + pass_index * 1009
            print(f"[{character.id}] pass {pass_index}/{args.passes}, seed {seed}")
            generator = torch.Generator(device="cpu").manual_seed(seed)

            latent = base(
                prompt=character.prompt,
                prompt_2=character.prompt_2,
                negative_prompt=NEGATIVE_PROMPT,
                negative_prompt_2=NEGATIVE_PROMPT,
                width=args.width,
                height=args.height,
                num_inference_steps=args.steps,
                guidance_scale=args.guidance,
                denoising_end=0.82,
                output_type="latent",
                generator=generator,
            ).images

            image = refiner(
                prompt=character.prompt,
                prompt_2=character.prompt_2,
                negative_prompt=NEGATIVE_PROMPT,
                negative_prompt_2=NEGATIVE_PROMPT,
                image=latent,
                num_inference_steps=args.steps,
                guidance_scale=args.guidance,
                denoising_start=0.82,
                generator=generator,
            ).images[0]

            variant_path = VARIANT_DIR / f"{character.id}-pass-{pass_index}.jpg"
            image.save(variant_path, "JPEG", quality=92, optimize=True, progressive=True)
            print(f"  saved {variant_path}")

            if pass_index == final_pass:
                final_variant_path = variant_path
                final_path = OUTPUT_DIR / f"{character.id}.jpg"
                image.save(final_path, "JPEG", quality=92, optimize=True, progressive=True)
                print(f"  final {final_path}")

            del image, latent, generator
            gc.collect()
            torch.cuda.empty_cache()

        if final_variant_path is None:
            raise RuntimeError(f"No final variant selected for {character.id}")


def configure_pipeline(pipe: StableDiffusionXLPipeline | StableDiffusionXLImg2ImgPipeline) -> None:
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config,
        algorithm_type="dpmsolver++",
        solver_order=3,
        use_karras_sigmas=True,
    )
    try:
        pipe.enable_xformers_memory_efficient_attention()
    except Exception as exc:  # pragma: no cover - optional accelerator depends on local install.
        print(f"xFormers unavailable, continuing without it: {exc}")
    pipe.set_progress_bar_config(disable=True)


if __name__ == "__main__":
    main()
