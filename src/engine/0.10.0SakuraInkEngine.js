// src/engine/style/0.10.0SakuraInkEngine.js

// 📝 引入全域常數：包含尺寸、時間、字體、物理預設值以及心理測驗字典[cite: 19]
import { 
  WORDS, TOTAL_H, MONITOR_H, TABLET_START_Y, TABLET_H, 
  CRYING_DURATION, FONT_FAMILY, FONT_SIZE_BASE, 
  TEXT_STROKE_WIDTH, TEXT_FILL_COLOR, TEXT_STROKE_COLOR, TEXT_STROKE_ALPHA, // 新增的常數
  EYE_OFFSET, WORD_SPAWN_INTERVAL, 
  GEM_MAPPING 
} from '../config/constants';

// 📝 [物理參數] 文字生成的基礎水平初速[cite: 19]
export const BASE_VELOCITY_X = 0.05;     
// 📝 [跨螢幕同步] 文字掉出上半部螢幕後，經過多少影格 (Frame) 才會在下半部激起水波[cite: 19]
const NETWORK_DELAY_FRAMES = 18; 

// 📝 引入上下兩塊螢幕的獨立控制器[cite: 19]
import { setupMonitor } from './MonitorController';
import { setupTablet } from './TabletController'; 

export function createInkEngine(containerElement, getEyeData, videoElement, onComplete) {
  // ==========================================
  // 1. 初始化 PIXI 核心與畫布 (Canvas)
  // ==========================================
  const app = new window.PIXI.Application({
    width: 400, 
    height: TOTAL_H, 
    backgroundColor: 0x0a0a0c, 
    resolution: window.devicePixelRatio || 1, 
    autoDensity: true,
  });
  containerElement.appendChild(app.view);

  // ==========================================
  // 2. 效能優化：文字紋理預先生成 (Texture Cache)
  // ==========================================
  const uniqueChars = new Set(WORDS.join('').split(''));
  const charTextures = {};
  uniqueChars.forEach(char => {
    // 📝 使用 constants.js 中的常數進行樣式設定
    const textGraphic = new window.PIXI.Text(char, {
      fontFamily: FONT_FAMILY, 
      fontSize: FONT_SIZE_BASE, 
      fontWeight: 'bold',
      fill: TEXT_FILL_COLOR,           // 使用淺藍色常數
      stroke: TEXT_STROKE_COLOR,       // 使用邊框顏色常數
      strokeThickness: TEXT_STROKE_WIDTH, 
      // 📝 透過樣式屬性控制邊框透明度
      lineJoin: 'round',               // 讓邊框轉角更平滑
    });

    // 💡 為了達成邊框半透明效果，我們直接調整物件的 alpha 
    // 或者在 PIXI 7 中，stroke 支援 alpha 屬性 (取決於渲染模式)
    textGraphic.style.strokeAlpha = TEXT_STROKE_ALPHA; 

    charTextures[char] = app.renderer.generateTexture(textGraphic);
    textGraphic.destroy();
  });

  // ==========================================
  // 3. 圖層管理 (Layers Setup)
  // ==========================================
  const masterContainer = new window.PIXI.Container();
  app.stage.addChild(masterContainer);
  const textContainer = new window.PIXI.Container(); 
  masterContainer.addChild(textContainer);

  // 初始化上下兩塊螢幕的控制器[cite: 19]
  const monitorCtrl = setupMonitor(app, videoElement);
  const tabletCtrl = setupTablet(app); 

  // ==========================================
  // 4. 狀態與陣列宣告
  // ==========================================
  const drops = [];       // 存放目前畫面上所有正在掉落的字元精靈[cite: 19]
  const dropQueue = [];   // 文字生成佇列 (控制每個字元間隔 WORD_SPAWN_INTERVAL 依序生成)[cite: 19]
  const tabletQueue = []; // 跨螢幕傳輸佇列 (紀錄哪個字在多久後要掉到下半部水池)[cite: 19]
  
  let frameCounter = 0;   // 全域影格計數器[cite: 19]
  let isCrying = false;   // 宣洩狀態判定[cite: 19]
  let cryingTime = 0;     // 宣洩已經持續的時間[cite: 19]
  let wordSpawnTimer = 0; // 控制宣洩過程中文字生成頻率的計時器[cite: 19]
  let wasActive = false;  // 用於判斷互動是否「剛結束」(觸發結算用)[cite: 19]
  let currentWordPool = WORDS; 

  // ==========================================
  // 5. 核心邏輯：情緒結算 (心理測驗)
  // ==========================================
  const determineGemType = (userWords) => {
    if (!userWords || userWords.length === 0) return 'diamond'; 
    const counts = { pearl: 0, diamond: 0, quartz: 0, opal: 0, lapis: 0 };
    // 將使用者選的字，丟進字典比對積分[cite: 19]
    userWords.forEach(word => {
      for (const [gem, wordsList] of Object.entries(GEM_MAPPING)) {
        if (wordsList.includes(word)) counts[gem]++;
      }
    });
    // 找出得分最高的寶石[cite: 19]
    let maxCount = -1; 
    let selectedGem = 'diamond';
    for (const [gem, count] of Object.entries(counts)) {
      if (count > maxCount) { maxCount = count; selectedGem = gem; }
    }
    return selectedGem;
  };
  
  // ==========================================
  // 6. 核心邏輯：詞彙生成流 (打字節奏控制)
  // ==========================================
  // 將一個詞 (例：'捨不得') 拆解成字元 ('捨', '不', '得')，並推入佇列排隊生成[cite: 19]
  const spawnWordFlow = (userWords, isInner = Math.random() > 0.5, sizeScale = 1.0) => {
    const pool = userWords && userWords.length > 0 ? userWords : WORDS;
    const word = pool[Math.floor(Math.random() * pool.length)];
    const chars = word.split('');
    const isLeftEye = Math.random() > 0.5; 
    
    // 向 App.jsx 請求當下的 MediaPipe 眼眶座標資料[cite: 19]
    const eyeData = getEyeData(); 
    let eyeX, eyeY;
    
    if (eyeData) {
      if (eyeData.leftLowerEdge && eyeData.rightLowerEdge) {
        // 從眼眶下緣隨機挑選一個點作為淚滴的出生地[cite: 19]
        const edgePoints = isLeftEye ? eyeData.leftLowerEdge : eyeData.rightLowerEdge;
        const randomPoint = edgePoints[Math.floor(Math.random() * edgePoints.length)];
        eyeX = randomPoint.x; eyeY = randomPoint.y;
      } else {
        // 備用邏輯：只用內外側兩點[cite: 19]
        if (isLeftEye) { eyeX = isInner ? eyeData.leftInner.x : eyeData.leftOuter.x; eyeY = isInner ? eyeData.leftInner.y : eyeData.leftOuter.y; } 
        else { eyeX = isInner ? eyeData.rightInner.x : eyeData.rightOuter.x; eyeY = isInner ? eyeData.rightInner.y : eyeData.rightOuter.y; }
      }
    } else {
      // 備用邏輯：抓不到臉時，固定位置生成[cite: 19]
      eyeX = app.screen.width * (isLeftEye ? 0.3 : 0.7) + (isInner ? EYE_OFFSET : -EYE_OFFSET); eyeY = 150; 
    }
    
    // 將每個字元壓入佇列，並加上 triggerFrame (觸發時間點)，產生打字機般的連續掉落感[cite: 19]
    chars.forEach((char, index) => { dropQueue.push({ char, x: eyeX, y: eyeY, triggerFrame: frameCounter + (index * WORD_SPAWN_INTERVAL), scale: sizeScale }); });
  };

  // ==========================================
  // 7. 核心邏輯：單一字元生成 (櫻花物理初始化)
  // ==========================================
  const spawnSingleChar = (char, startX, startY, scale) => {
    const dropSprite = new window.PIXI.Sprite(charTextures[char]);
    dropSprite.anchor.set(0.5); dropSprite.position.set(startX, startY); dropSprite.alpha = 1; 
    
    // 📝 空間感：隨機分配一個 0~3 的 Z 軸深度。Z 值越大，文字越小，代表距離越遠[cite: 19]
    const z = Math.random() * 3.0; 
    const depthScale = scale * (1.0 - (z / 3.0) * 0.5); 
    dropSprite.baseScale = depthScale;
    dropSprite.scale.set(depthScale);
    textContainer.addChild(dropSprite);
    
    const f = Math.random(); // 隨機數子(0~1)，決定每片櫻花飄落的個性[cite: 19]
    drops.push({ 
      sprite: dropSprite, char, baseScale: depthScale, 
      vx: (Math.random() - 0.5) * BASE_VELOCITY_X, // 水平亂數初速[cite: 19]
      vy: (Math.random() * 0.1 + 1) * (0.8 + depthScale * 0.2), // 垂直初速 (近的掉比較快)[cite: 19]
      z: z, f: f, 
      si: Math.sign(Math.sin(f * 175.0)) || 1, // 決定旋轉方向 (順或逆)[cite: 19]
      rotOffset: Math.sin(f * 175.0) * 1854.0  // 初始旋轉角度的偏移量[cite: 19]
    });
  };

  // ==========================================
  // 8. 遊戲主迴圈 (Main Update Loop)
  // ==========================================
  app.ticker.add((delta) => {
    frameCounter += delta;
    const iTime = frameCounter * 0.015; // 統一時間變數，供物理公式使用[cite: 19]
    
    // 更新背景系統[cite: 19]
    monitorCtrl.updateVideoScale();
    tabletCtrl.updateWater(delta, iTime); 

    // 📝 判定「是否所有的動畫與互動都已完全結束」
    const isAnimating = isCrying || dropQueue.length > 0 || tabletQueue.length > 0 || drops.length > 0;

    // 觸發結束回調 (OnComplete)[cite: 19]
    if (wasActive && !isAnimating) {
        if (typeof onComplete === 'function') onComplete();
    }
    wasActive = isAnimating; 

    // 📝 [大哭狀態] 處理 15 秒宣洩期內的密集文字生成[cite: 19]
    if (isCrying) {
      cryingTime += delta * 16.66; // 換算成毫秒[cite: 19]
      const p = Math.min(cryingTime / CRYING_DURATION, 1); // 宣洩進度 0~1[cite: 19]
      
      // 文字生成的頻率曲線：中間最密集，結尾最稀疏 (形成完美的「宣洩 -> 沉澱」節奏)[cite: 19]
      const framesPerWord = (1000 - Math.sin(p * Math.PI) * 800) / 16.66;
      wordSpawnTimer += delta;
      
      if (wordSpawnTimer >= framesPerWord) { 
        wordSpawnTimer = 0; 
        spawnWordFlow(currentWordPool, Math.random() < (1 - p), 0.4 + Math.sin(p * Math.PI) * 0.6); 
      }
      if (p === 1) isCrying = false; 
    }

    // 📝 [佇列檢查] 依照時間順序，將文字實體化[cite: 19]
    for (let i = dropQueue.length - 1; i >= 0; i--) { if (frameCounter >= dropQueue[i].triggerFrame) { const item = dropQueue[i]; spawnSingleChar(item.char, item.x, item.y, item.scale); dropQueue.splice(i, 1); } }
    
    // 📝 [佇列檢查] 處理跨螢幕延遲後，在平板激起水波[cite: 19]
    for (let i = tabletQueue.length - 1; i >= 0; i--) { 
        if (frameCounter >= tabletQueue[i].triggerFrame) { 
            const item = tabletQueue[i]; 
            tabletCtrl.addRipple(item.x, item.y); 
            tabletQueue.splice(i, 1); 
        } 
    }

    // 📝 [物理引擎] 更新所有存活文字的坐標與動態[cite: 19]
    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      // Y 軸下落，並加上基於時間的微小震盪感[cite: 19]
      const speedFactor = (Math.sin(drop.f + 0.1) * 0.5 + 1.0);
      drop.sprite.y += drop.vy * speedFactor * delta; 
      
      // 計算 3D 旋轉感 (X軸搖擺與 Y軸翻轉)[cite: 19]
      const rotAngle = drop.si * iTime + drop.rotOffset;
      drop.sprite.rotation = rotAngle;
      drop.sprite.x += drop.vx * delta + Math.cos(rotAngle) * (drop.f * 0.2);
      
      // 利用 Scale 壓扁模擬 3D 翻轉效果[cite: 19]
      const shaderScale = 0.9 + (drop.f * 0.5);
      const flipFactor = Math.abs(Math.sin(rotAngle)); 
      drop.sprite.scale.set(drop.baseScale * shaderScale, drop.baseScale * shaderScale * (0.4 + flipFactor * 0.6));

      // 📝 [跨螢幕越界檢查] 文字掉出上半部螢幕！
      if (drop.sprite.y > MONITOR_H) { 
        const targetX = drop.sprite.x;
        // 映射 Z 軸深度到平板的 Y 軸 (近的打在前面，遠的打在後面)[cite: 19]
        const normZ = 1.0 - (drop.z / 3.0); 
        const targetY = TABLET_START_Y + (normZ * TABLET_H);
        
        // 推入水波佇列，等待 NETWORK_DELAY_FRAMES 後觸發[cite: 19]
        tabletQueue.push({ x: targetX, y: targetY, triggerFrame: frameCounter + NETWORK_DELAY_FRAMES }); 
        
        // 刪除文字精靈，釋放資源[cite: 19]
        textContainer.removeChild(drop.sprite); 
        drop.sprite.destroy(); 
        drops.splice(i, 1); 
      }
    }
  });

  // 匯出引擎的公用方法 (給 App.jsx 呼叫)[cite: 19]
  return {
    spawnWord: (userWords) => { currentWordPool = userWords; spawnWordFlow(userWords, Math.random() > 0.5, 0.8); },
    triggerCryingSequence: (userWords) => { 
      if(!isCrying) { 
        currentWordPool = userWords; 
        isCrying = true; 
        cryingTime = 0; 
        wordSpawnTimer = 0; 
        spawnWordFlow(userWords, Math.random() > 0.5, 0.8); 
        
        // 【觸發寶石顯影】在開始大哭的瞬間，結算情緒，並通知下半部螢幕準備顯影動畫[cite: 19]
        const targetGem = determineGemType(userWords);
        tabletCtrl.revealGem(targetGem);
      } 
    },
    destroy: () => app.destroy(true, { children: true, texture: true, baseTexture: true })
  };
}