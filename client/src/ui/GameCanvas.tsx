import { memo, useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createGame } from '../game/createGame';

export const GameCanvas = memo(function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || gameRef.current) return;
    const game = createGame(host);
    gameRef.current = game;
    let frame = 0;
    let lastWidth = 0;
    let lastHeight = 0;
    // Dock/Safari меняют контейнер без window.resize. RESIZE перечитывает его размер.
    const resize = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width; lastHeight = height;
      cancelAnimationFrame(frame);
      if (width > 0 && height > 0) frame = requestAnimationFrame(() => { if (game.canvas?.isConnected) game.scale.refresh(); });
    });
    resize.observe(host);
    return () => {
      resize.disconnect(); cancelAnimationFrame(frame);
      game.destroy(true); gameRef.current = null;
    };
  }, []);
  return <div ref={hostRef} className="game-canvas" aria-label="Шахта. Выберите объект на сцене или в панели управления." />;
});
