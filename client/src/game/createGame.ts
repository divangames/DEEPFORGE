import Phaser from 'phaser';
import { detectQualityTier } from '../core/device';
import { FoundationScene } from './scenes/FoundationScene';

export function createGame(parent: HTMLElement) {
  const quality = detectQualityTier();
  const targetFps = quality === 'LOW' ? 30 : 60;
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#15181d',
    scene: [FoundationScene],
    fps: {
      target: targetFps,
      min: quality === 'LOW' ? 20 : 30,
      forceSetTimeOut: quality === 'LOW',
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: quality !== 'LOW',
      roundPixels: true,
    },
  });
}
