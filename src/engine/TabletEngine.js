// src/engine/TabletEngine.js
import { setupTablet } from './TabletController';

export function createTabletEngine(containerElement, onSettlement) {
  const app = new window.PIXI.Application({
    resizeTo: containerElement, 
    backgroundColor: 0x050507, 
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  
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
    // 🌟 核心新增：接收 char 參數
    receiveTear: (nx, z, char) => {
      const targetX = nx * app.screen.width;
      const normZ = 1.0 - (z / 3.0); 
      const targetY = normZ * app.screen.height; 
      tabletCtrl.addRipple(targetX, targetY, char); // 🌟 傳遞給水波生成器
    },
    revealGem: (gemType) => { tabletCtrl.revealGem(gemType); },
    monitorFinished: () => { tabletCtrl.monitorFinished(); },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}