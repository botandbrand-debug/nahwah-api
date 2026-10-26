import { createAvatar } from '@dicebear/core';
import { lorelei } from '@dicebear/collection';

/**
 * Deterministic avatar generation.
 * Same seed + style always produces the same SVG — no storage needed.
 * The SVG is returned inline; the frontend renders it directly.
 */
export function generateAvatarSvg(seed: string): string {
  return createAvatar(lorelei, {
    seed,
    size: 128,
    backgroundColor: ['b6e3f4', 'c0aede', 'd1d4f9', 'ffd5dc', 'ffdfbf'],
  }).toString();
}