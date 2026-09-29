import Phaser from 'phaser';
import { FoundationScene } from './scenes/FoundationScene';

export function createGame(parent: HTMLElement) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#15181d',
    scene: [FoundationScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      antialias: true,
      roundPixels: true,
    },
  });
}
