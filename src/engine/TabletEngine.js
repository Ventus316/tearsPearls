// src/engine/TabletEngine.js
import { setupTablet } from './TabletController';

/**
 * 平板物理引擎入口 (Tablet Engine)
 * 負責：初始化 PIXI 畫布、維持全螢幕滿版縮放、接收並轉換跨裝置的座標數據。
 */
export function createTabletEngine(containerElement, onSettlement) {
  const app = new window.PIXI.Application({
    resizeTo: containerElement, // 追蹤 React 容器大小，確保畫布邊界準確
    backgroundColor: 0x050507, 
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });
  
  // 強制設定 CSS 確保 Canvas 百分之百貼合外層容器 (包含圓角遮罩)
  app.view.style.position = 'absolute';
  app.view.style.top = '0';
  app.view.style.left = '0';
  app.view.style.width = '100%';
  app.view.style.height = '100%';
  containerElement.appendChild(app.view);

  // 初始化控制器
  const tabletCtrl = setupTablet(app, onSettlement);
  
  // 註冊主渲染迴圈
  app.ticker.add((delta) => {
    const frameCounter = app.ticker.lastTime * 0.06; 
    tabletCtrl.updateWater(delta, frameCounter * 0.015);
  });

  return {
    /**
     * 接收來自大螢幕的眼淚數據，並轉換為平板實體座標
     * @param {number} nx - 歸一化 X 座標 (0.0 ~ 1.0)
     * @param {number} z - Z 軸深度 (決定 Y 軸落點與水波縮放)
     * @param {string} char - 觸發的字元 (用於匹配對應的水波貼圖)
     */
    receiveTear: (nx, z, char) => {
      const targetX = nx * app.screen.width;
      const normZ = 1.0 - (z / 3.0); 
      const targetY = normZ * app.screen.height; 
      tabletCtrl.addRipple(targetX, targetY, char); 
    },
    /**
     * 啟動寶石顯影動畫
     * @param {string} gemType - 寶石種類 (pearl, diamond, quartz, opal, lapis)
     */
    revealGem: (gemType) => { 
      tabletCtrl.revealGem(gemType); 
    },
    /**
     * 標記大螢幕動畫已結束，準備進入結算流程
     */
    monitorFinished: () => { 
      tabletCtrl.monitorFinished(); 
    },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}