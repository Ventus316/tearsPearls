// src/engine/TabletEngine.js
import { setupTablet } from './TabletController';

export function createTabletEngine(containerElement, onSettlement) {
  const app = new window.PIXI.Application({
    resizeTo: window, 
    backgroundColor: 0x050507, 
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  containerElement.appendChild(app.view);

  // 傳入 UI 結算畫面的回呼函式
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
    // 🌟 新增：接收來自 Socket 的大螢幕完畢通知，轉交給控制器
    monitorFinished: () => { tabletCtrl.monitorFinished(); },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}