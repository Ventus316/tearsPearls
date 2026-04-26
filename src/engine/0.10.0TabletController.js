// src/engine/0.10.0TabletController.js
import { TABLET_START_Y, TABLET_H } from '../config/constants';

export function setupTablet(app) {
  // 1. 純土色背景 (無濾鏡)
  const tabletBg = new window.PIXI.Graphics();
  tabletBg.beginFill(0x70543E); 
  tabletBg.drawRect(0, TABLET_START_Y, 400, TABLET_H); 
  tabletBg.endFill();

  const waterContainer = new window.PIXI.Container();
  waterContainer.addChild(tabletBg);
  app.stage.addChildAt(waterContainer, 1); 

  // 2. 測試用的觀察小圓點
  const drawDebugDot = (x, y) => {
    const dot = new window.PIXI.Graphics();
    dot.beginFill(0xFFFFFF); // 白色小點
    dot.drawCircle(0, 0, 3); // 半徑 3px
    dot.endFill();
    dot.x = x;
    dot.y = y;
    
    waterContainer.addChild(dot);
    
    // 讓小圓點在一秒內慢慢淡出並自我銷毀，避免畫面塞滿點點
    const fadeOut = () => {
        dot.alpha -= 0.02;
        if (dot.alpha <= 0) {
            waterContainer.removeChild(dot);
            dot.destroy();
            app.ticker.remove(fadeOut);
        }
    };
    app.ticker.add(fadeOut);
  };

  const updateWater = (delta) => {
      // 暫時沒有背景動畫需要更新
  };

  return { drawDebugDot, updateWater };
}