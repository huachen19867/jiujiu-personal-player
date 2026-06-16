import type { PlaybackMode } from '../types/music';

type RandomSource = () => number;

export function getNextIndex(
  currentIndex: number,
  queueLength: number,
  mode: PlaybackMode,
  random: RandomSource = Math.random,
) {
  return getIndexByDirection(currentIndex, queueLength, mode, 1, random);
}

export function getPreviousIndex(
  currentIndex: number,
  queueLength: number,
  mode: PlaybackMode,
  random: RandomSource = Math.random,
) {
  return getIndexByDirection(currentIndex, queueLength, mode, -1, random);
}

function getIndexByDirection(
  currentIndex: number,
  queueLength: number,
  mode: PlaybackMode,
  direction: 1 | -1,
  random: RandomSource,
): number | null {
  if (queueLength <= 0) {
    return null;
  }

  const normalizedIndex = clampIndex(currentIndex, queueLength);

  if (mode === 'repeat-one' || queueLength === 1) {
    return normalizedIndex;
  }

  if (mode === 'shuffle') {
    return getShuffleIndex(normalizedIndex, queueLength, random);
  }

  const nextIndex = normalizedIndex + direction;
  if (mode === 'repeat-all') {
    return (nextIndex + queueLength) % queueLength;
  }

  return nextIndex >= 0 && nextIndex < queueLength ? nextIndex : null;
}

function getShuffleIndex(currentIndex: number, queueLength: number, random: RandomSource) {
  const candidates = Array.from({ length: queueLength }, (_, index) => index).filter(
    (index) => index !== currentIndex,
  );
  const selectedIndex = Math.min(Math.floor(random() * candidates.length), candidates.length - 1);
  return candidates[selectedIndex];
}

function clampIndex(index: number, queueLength: number) {
  if (index < 0) {
    return 0;
  }
  if (index >= queueLength) {
    return queueLength - 1;
  }
  return index;
}
