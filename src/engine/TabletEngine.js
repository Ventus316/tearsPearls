// src/engine/TabletEngine.js
import { setupTablet } from './TabletController';

export function createTabletEngine(containerElement, onSettlement) {
  const app = new window.PIXI.Application({
    // 🌟 修復 1：改為追蹤 React 容器，避免視窗縮放或翻轉時 PIXI 數學坐標跑掉
    resizeTo: containerElement, 
    backgroundColor: 0x050507, 
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  
  // 🌟 強制設定 CSS 確保 Canvas 百分之百貼合外層 Div
  app.view.style.position = 'absolute';
  app.view.style.top = '0';
  app.view.style.left = '0';
  app.view.style.width = '100%';
  app.view.style.height = '100%';
  containerElement.appendChild(app.view);

  const tabletCtrl = setupTablet(app, onSettlement);
  
  app.ticker.add((delta) => {
    const frameCounter = app.ticker.lastTime * 0.06; 
    tabletCtrl.updateWater(delta, frameCounter * 0.015);
  });

  return {
    receiveTear: (nx, z) => {
      const targetX = nx * app.screen.width;
      const normZ = 1.0 - (z / 3.0); 
      const targetY = normZ * app.screen.height; 
      tabletCtrl.addRipple(targetX, targetY);
    },
    revealGem: (gemType) => { tabletCtrl.revealGem(gemType); },
    monitorFinished: () => { tabletCtrl.monitorFinished(); },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}