// src/engine/MonitorController.js
// 📝 引入常數：上半部顯示器高度 (MONITOR_H) 與 兩螢幕實體間隙高度 (GAP_H)[cite: 18]
import { MONITOR_H, GAP_H } from '../config/constants';

export function setupMonitor(app, videoElement) {
  // ==========================================
  // 🎥 1. 視訊鏡頭背景層 (Video Background)
  // ==========================================
  // 將 HTML5 <video> 元素轉換為 PIXI 渲染引擎可以看懂的紋理[cite: 18]
  const videoBaseTexture = new window.PIXI.BaseTexture(videoElement);
  const videoTexture = new window.PIXI.Texture(videoBaseTexture);
  const videoSprite = new window.PIXI.Sprite(videoTexture);
  const videoContainer = new window.PIXI.Container();
  
  // 設定錨點為中心，方便後續縮放與鏡像翻轉[cite: 18]
  videoSprite.anchor.set(0.5); 
  videoContainer.addChild(videoSprite);
  // 📝 視覺微調：將視訊畫面稍微調暗 (alpha: 0.6)，避免搶走文字掉落與寶石的視覺焦點[cite: 18]
  videoSprite.alpha = 0.6; 

  // ==========================================
  // ✂️ 2. 顯示器遮罩層 (Monitor Mask)
  // ==========================================
  // 建立一個純白色的矩形，大小等同於上半部實體螢幕的大小 (400 x MONITOR_H)[cite: 18]
  const monitorMask = new window.PIXI.Graphics();
  monitorMask.beginFill(0xFFFFFF); 
  monitorMask.drawRect(0, 0, 400, MONITOR_H); 
  monitorMask.endFill();
  
  // 將這個矩形設為視訊容器的遮罩，確保視訊畫面「絕對不會」跑到下方平板或間隙區[cite: 18]
  videoContainer.mask = monitorMask;
  
  // 將視訊與遮罩加入主舞台的最底層 (index: 0)，當作最遠的背景[cite: 18]
  app.stage.addChildAt(videoContainer, 0); 
  app.stage.addChildAt(monitorMask, 0);

  // ==========================================
  // ⬛ 3. 實體邊框/間隙層 (Bezel / Gap)
  // ==========================================
  // 繪製一個黑色區塊，用來模擬展場兩塊實體螢幕中間那段「沒有畫面的物理間隙」[cite: 18]
  const bezelContainer = new window.PIXI.Container();
  app.stage.addChild(bezelContainer);
  
  const bezel = new window.PIXI.Graphics(); 
  // 📝 使用深黑色 (0x111315) 填滿間隙[cite: 18]
  bezel.beginFill(0x111315); 
  // 從上半部螢幕的底邊 (y = MONITOR_H) 開始畫，高度為 GAP_H[cite: 18]
  bezel.drawRect(0, MONITOR_H, 400, GAP_H); 
  bezel.endFill();
  bezelContainer.addChild(bezel);

  // ==========================================
  // 🔄 4. 視訊動態更新邏輯 (Update Loop)
  // ==========================================
  // 這個函式會在 SakuraInkEngine 的每一幀 (app.ticker) 中被持續呼叫[cite: 18]
  const updateVideoScale = () => {
    // 確保視訊已經成功載入並擁有長寬數據[cite: 18]
    if (videoElement.videoWidth > 0) {
       // 計算「裁切並填滿 (Object-fit: cover)」所需的縮放比例[cite: 18]
       // 取寬度或高度縮放比例中「較大」的一個，確保畫面沒有黑邊[cite: 18]
       const scale = Math.max(400 / videoElement.videoWidth, MONITOR_H / videoElement.videoHeight);
       videoSprite.scale.set(scale); 
       
       // 📝 鏡像反轉：讓使用者看到自己就像照鏡子一樣 (X軸縮放乘以 -1)[cite: 18]
       videoSprite.scale.x *= -1; 
       
       // 將視訊畫面鎖定在上半部螢幕的正中央[cite: 18]
       videoSprite.position.set(200, MONITOR_H / 2); 
    }
  };

  // 匯出更新函式給外部的引擎驅動[cite: 18]
  return { updateVideoScale };
}