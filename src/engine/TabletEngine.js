// src/engine/TabletEngine.js
import { setupTablet } from './TabletController';

export function createTabletEngine(containerElement) {
  const app = new window.PIXI.Application({
    resizeTo: window, // 🌟 讓平板水池也是自動全螢幕
    backgroundColor: 0x050507, 
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  containerElement.appendChild(app.view);

  const tabletCtrl = setupTablet(app);
  
  app.ticker.add((delta) => {
    const frameCounter = app.ticker.lastTime * 0.06; 
    tabletCtrl.updateWater(delta, frameCounter * 0.015);
  });

  return {
    receiveTear: (nx, z) => {
      // 🌟 還原真實座標：大螢幕傳來的比例 nx * 平板螢幕總寬
      const targetX = nx * app.screen.width;
      // Y軸深度一樣映射為比例
      const normZ = 1.0 - (z / 3.0); 
      const targetY = normZ * app.screen.height; 
      
      tabletCtrl.addRipple(targetX, targetY);
    },
    revealGem: (gemType) => { tabletCtrl.revealGem(gemType); },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}