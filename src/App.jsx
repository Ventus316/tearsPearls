import React, { useEffect, useRef, useState } from 'react';

export default function App() {
  const pixiContainer = useRef(null);
  const appRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // ⚙️ [細微調整] 測試情緒詞彙 (可以自由增減詞彙)
  const words = ['焦慮', '壓力', '自責', '委屈', '孤單', '沒事', '怎辦', '想念'];

  // ==========================================
  // ⚙️ [細微調整] 顯示器與設備實體尺寸設定區
  // ==========================================
  const MONITOR_H = 450; // 主顯示器高度
  const GAP_H = 50;      // 實體縫隙高度 (黑條)
  const TABLET_H = 350;  // 平板區域高度

  // --- 自動計算的衍生常數 (請勿修改) ---
  const TOTAL_H = MONITOR_H + GAP_H + TABLET_H; 
  const TABLET_START_Y = MONITOR_H + GAP_H;     
  const VIRTUAL_H = MONITOR_H + TABLET_H;       
  // ==========================================

  useEffect(() => {
    if (window.PIXI) {
      initPixi();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js';
      script.onload = initPixi;
      document.body.appendChild(script);
    }

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true, baseTexture: true });
        appRef.current = null;
      }
    };
  }, []);

  const initPixi = () => {
    if (appRef.current) return;

    const app = new window.PIXI.Application({
      width: 400,
      height: TOTAL_H, 
      backgroundColor: 0xE8E4D9, // ⚙️ [細微調整] 背景顏色 (宣紙色)
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    
    pixiContainer.current.appendChild(app.view);
    appRef.current = app;

    // --- 效能優化：把所有「單字」預先算成圖片 ---
    const uniqueChars = new Set(words.join('').split(''));
    const charTextures = {};
    
    uniqueChars.forEach(char => {
      const textGraphic = new window.PIXI.Text(char, {
        fontFamily: '"PingFang TC", "STKaiti", "KaiTi", serif', // ⚙️ [細微調整] 字體
        fontSize: 24,    // ⚙️ [細微調整] 文字最大尺寸 (當情緒巔峰、scale為1時的絕對像素大小)
        fill: 0x111315,  // ⚙️ [細微調整] 文字顏色 (極深墨色)
        fontWeight: 'bold',
      });
      charTextures[char] = app.renderer.generateTexture(textGraphic);
      textGraphic.destroy();
    });

    // --- 背景水波紋理 ---
    const svgNoise = `
      <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#noise)" />
      </svg>
    `;
    const noiseUrl = `data:image/svg+xml;base64,${btoa(svgNoise)}`;
    const noiseTexture = window.PIXI.Texture.from(noiseUrl);
    
    const waterSprite = new window.PIXI.TilingSprite(noiseTexture, app.screen.width, app.screen.height);
    app.stage.addChild(waterSprite);

    const masterContainer = new window.PIXI.Container();
    const displacementFilter = new window.PIXI.DisplacementFilter(waterSprite);
    
    // ⚙️ [細微調整] 水波扭曲強度
    // 數值越大，文字被背景水流扭曲、撕裂的程度就越嚴重
    displacementFilter.scale.set(12);
    
    masterContainer.filters = [displacementFilter];
    app.stage.addChild(masterContainer);

    const trailContainer = new window.PIXI.Container();
    masterContainer.addChild(trailContainer);

    const textContainer = new window.PIXI.Container();
    masterContainer.addChild(textContainer);

    // 【實體縫隙遮罩】
    const bezelContainer = new window.PIXI.Container();
    app.stage.addChild(bezelContainer);

    const bezel = new window.PIXI.Graphics();
    bezel.beginFill(0x1A1C20); // ⚙️ [細微調整] 實體縫隙(黑框)的顏色
    bezel.drawRect(0, MONITOR_H, 400, GAP_H); 
    bezel.endFill();
    bezelContainer.addChild(bezel);

    const delayText = new window.PIXI.Text("網路傳輸延遲中 (2 秒)...", {
        fontFamily: 'sans-serif',
        fontSize: 12,
        fill: 0x666666,
        align: 'center',
        letterSpacing: 2
    });
    delayText.anchor.set(0.5);
    delayText.x = 200;
    delayText.y = MONITOR_H + (GAP_H / 2); 
    bezelContainer.addChild(delayText);

    const drops = [];
    const inkTrails = [];
    const dropQueue = [];
    const tabletQueue = []; 
    
    let frameCounter = 0; 
    let isCrying = false;
    let cryingTime = 0;
    
    // ⚙️ [細微調整] 情緒曲線總時長
    const cryingDuration = 10000; // 10000 毫秒 = 10秒
    
    let wordSpawnTimer = 0;

    const spawnWordFlow = (isInner = Math.random() > 0.5, sizeScale = 1.0) => {
      const word = words[Math.floor(Math.random() * words.length)];
      const chars = word.split('');
      const isLeftEye = Math.random() > 0.5;
      
      // ⚙️ [細微調整] 雙眼在螢幕上的 X 軸位置 (0.3=左邊30%, 0.7=右邊70%)
      const baseEyeX = isLeftEye ? app.screen.width * 0.3 : app.screen.width * 0.7;
      
      // ⚙️ [細微調整] 眼頭與眼尾的寬度距離 (越大，淚痕分佈越寬)
      const eyeOffset = 22; 
      
      let eyeX = baseEyeX;
      if (isLeftEye) {
        eyeX += isInner ? eyeOffset : -eyeOffset;
      } else {
        eyeX += isInner ? -eyeOffset : eyeOffset;
      }
      
      chars.forEach((char, index) => {
        dropQueue.push({
          char: char,
          // ⚙️ [細微調整] 8 * sizeScale：控制同一個詞的每一個字，左右錯開的隨機幅度
          x: eyeX + (Math.random() - 0.5) * (8 * sizeScale), 
          y: 40, // ⚙️ [細微調整] 淚水出生的 Y 軸高度 (40px)
          
          // ⚙️ [細微調整] 12：決定同一個詞裡面，字與字掉落的時間間隔。越大，字排得越長越稀疏。
          triggerFrame: frameCounter + (index * 12), 
          scale: sizeScale 
        });
      });
    };

    const spawnSingleChar = (char, startX, startY, scale, screen = 1, prevVx = null, prevVy = null) => {
      const drop = new window.PIXI.Sprite(charTextures[char]);
      drop.anchor.set(0.5);
      drop.x = startX; 
      drop.y = startY;
      drop.alpha = 1;
      
      drop.baseScale = scale;
      drop.scale.set(scale);
      
      const blurFilter = new window.PIXI.BlurFilter();
      blurFilter.blur = 0; // 剛出生絕對清晰
      drop.filters = [blurFilter];

      textContainer.addChild(drop);

      drops.push({
        sprite: drop,
        char: char,
        blur: blurFilter,
        baseScale: scale, 
        
        // ⚙️ [細微調整] 文字的掉落物理速度
        // vx: 橫向飄移速度。0.15 控制了S型軌跡的寬度。
        vx: prevVx !== null ? prevVx : (Math.random() - 0.5) * 0.15, 
        
        // vy: 垂直掉落速度。公式 = (隨機微調 + 基礎速度2.0) * (因應文字大小的速度乘數)
        // 改大會掉得更快，改小像蜂蜜一樣慢。
        vy: prevVy !== null ? prevVy : (Math.random() * 0.1 + 2.0) * (0.8 + scale * 0.2), 
        
        life: 0,
        lastTrailY: startY,
        screen: screen 
      });
    };

    window.spawnWord = () => spawnWordFlow(Math.random() > 0.5, 0.8);

    window.triggerCryingSequence = () => {
      if(isCrying) return;
      isCrying = true;
      cryingTime = 0;
      wordSpawnTimer = 0;
    };

    app.ticker.add((delta) => {
      frameCounter += delta;

      // 【情緒引擎時間軸】
      if (isCrying) {
        cryingTime += delta * 16.66; 
        const p = Math.min(cryingTime / cryingDuration, 1); // 0~1 的情緒進度

        // ⚙️ [細微調整] 生詞頻率
        // 1200是起點最慢的毫秒數，800是加速幅度 (最快時 = 1200-800 = 每400毫秒流一次)
        const currentInterval = 1200 - Math.sin(p * Math.PI) * 800; 
        const framesPerWord = currentInterval / 16.66;

        wordSpawnTimer += delta;
        if (wordSpawnTimer >= framesPerWord) {
          wordSpawnTimer = 0;
          
          // 眼位機率：前期高機率眼頭(內側)，後期高機率眼尾
          const isInner = Math.random() < (1 - p);
          
          // ⚙️ [細微調整] 眼淚尺寸的情緒變化
          // 0.4=最小尺寸，0.6是增長幅度 (巔峰尺寸 = 0.4+0.6 = 1.0)
          const sizeScale = 0.4 + Math.sin(p * Math.PI) * 0.6;
          
          spawnWordFlow(isInner, sizeScale);
        }

        if (p === 1) isCrying = false; 
      }

      for (let i = dropQueue.length - 1; i >= 0; i--) {
        if (frameCounter >= dropQueue[i].triggerFrame) {
          const item = dropQueue[i];
          spawnSingleChar(item.char, item.x, item.y, item.scale, 1);
          dropQueue.splice(i, 1); 
        }
      }

      for (let i = tabletQueue.length - 1; i >= 0; i--) {
        if (frameCounter >= tabletQueue[i].triggerFrame) {
          const item = tabletQueue[i];
          spawnSingleChar(item.char, item.x, TABLET_START_Y, item.scale, 2, item.vx, item.vy);
          tabletQueue.splice(i, 1);
        }
      }

      // ⚙️ [細微調整] 背景水波的流動速度 (1.5=往下，0.3=往左)
      waterSprite.tilePosition.y -= 1.5 * delta; 
      waterSprite.tilePosition.x -= 0.3 * delta;

      // 【更新主文字 (每一滴眼淚本身)】
      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        drop.life += delta;
        drop.sprite.y += drop.vy * delta;
        
        // ⚙️ [細微調整] 眼淚 S 型擺動幅度。 0.05控制擺動頻率，0.3控制左右擺動的最大像素。
        drop.sprite.x += drop.vx * delta + Math.sin(drop.life * 0.05) * 0.3; 

        // 深度演算：將座標轉換為 0.0 ~ 1.0 的深度比例
        const virtualY = drop.screen === 1 ? drop.sprite.y : drop.sprite.y - GAP_H;
        const depthRatio = virtualY / VIRTUAL_H; 
        
        // --- 模糊與透明度控制區 ---
        // ⚙️ [細微調整] 淡出範圍設定
        const fadeStart = 0.70; // 從畫面 70% 高度處開始變透明
        const fadeEnd = 1.0;    // 畫面 100% 處達到設定的最低透明度
        
        const blurDepth = Math.min(depthRatio, fadeEnd);
        
        // ⚙️ [細微調整] 主文字模糊時機與程度
        // 0.40 = 畫面 40% 處開始模糊。
        // 10 = 模糊增長的倍率。改大會糊得更快、字體崩解得更嚴重。
        drop.blur.blur = Math.max(0, (blurDepth - 0.40) * 10);

        let targetAlpha = 1;
        if (depthRatio > fadeStart) {
            const fadeProgress = Math.min((depthRatio - fadeStart) / (fadeEnd - fadeStart), 1);
            
            // ⚙️ [細微調整] 主文字的最低透明度 (0.1 = 下降一成，保留 0.9 不透明)
            targetAlpha = 1 - (0.1 * fadeProgress);
        }
        
        // ⚙️ [細微調整] 透明度過渡的平滑度。0.15 決定它靠近目標透明度的速度。
        drop.sprite.alpha += (targetAlpha - drop.sprite.alpha) * 0.15;

        // --- 殘影生成控制區 ---
        // ⚙️ [細微調整] 殘影生成間距 (triggerDist)
        // Math.max(3, 5 * scale)：字小的時候每 3px 蓋一個殘影，字大的時候每 5px 蓋一個。
        // 如果把 5 改小(如 2)，殘影會蓋得非常密，但也比較耗效能。
        const triggerDist = Math.max(3, 5 * drop.baseScale); 
        const distMoved = drop.sprite.y - drop.lastTrailY;
        
        // ⚙️ [細微調整] depthRatio > 0.2：代表文字掉落到畫布 20% 高度之後，才准開始排泄殘影。
        if (distMoved >= triggerDist && depthRatio > 0.2) {
          drop.lastTrailY = drop.sprite.y;
          
          const trail = new window.PIXI.Sprite(charTextures[drop.char]);
          trail.anchor.set(0.5);
          trail.x = drop.sprite.x;
          trail.y = drop.sprite.y;
          trail.rotation = Math.random() * 0.2 - 0.1; 
          
          // ⚙️ [細微調整] 殘影被生出來時的「初始形狀」
          trail.scale.y = 1.6 * drop.baseScale; // 1.6: 垂直拉長，填補殘影縫隙，讓水墨連貫
          trail.scale.x = (1.0 + (depthRatio * 0.5)) * drop.baseScale; // 越掉越下面，殘影會稍微越寬
          
          const trailBlur = new window.PIXI.BlurFilter();
          
          // ⚙️ [細微調整] 殘影被生出來時的「初始模糊度」
          // 這裡拿掉了起點常數 2.0，改為 depthRatio * 8，確保剛掉下來時邊緣比較乾淨。
          trailBlur.blur = depthRatio * 8; 
          trail.filters = [trailBlur];
          
          // ⚙️ [細微調整] 殘影被生出來時的「初始透明度(黑色濃度)」
          // 0.1=基礎灰度，depthRatio*0.4=越深的地方生出的殘影越黑(最黑0.5)。
          trail.alpha = 0.1 + (depthRatio * 0.4); 
          
          trailContainer.addChildAt(trail, 0);

          inkTrails.push({
            sprite: trail,
            blurFilter: trailBlur, 
            
            // ⚙️ [細微調整] 殘影在空中的擴散變化速度
            scaleSpeedX: 0.008 + (Math.random() * 0.005), // X軸橫向暈開的速度
            scaleSpeedY: 0.002,                           // Y軸垂直拉長的速度
            
            // ⚙️ [細微調整] 殘影的消散(淡出)速度。改大會很快消失，改小會在地圖上留很久。
            alphaSpeed: (0.015 + (Math.random() * 0.01)) / Math.max(0.6, drop.baseScale),  
            
            // ⚙️ [細微調整] 殘影自身的重力掉落速度。0.6代表它掉得比主文字慢，形成拖尾感。
            vy: drop.vy * 0.6,
            screen: drop.screen
          });
        }

        const screenBottom = drop.screen === 1 ? MONITOR_H : TOTAL_H;
        if (drop.sprite.y > screenBottom) {
            if (drop.screen === 1) {
                // 傳送進佇列
                tabletQueue.push({
                    char: drop.char,
                    x: drop.sprite.x,
                    scale: drop.baseScale, 
                    vx: drop.vx,
                    vy: drop.vy,
                    // ⚙️ [細微調整] 跨螢幕傳輸延遲時間
                    // 120 frames (預設 60FPS) 約為 2 秒。改 60 就是延遲 1 秒。
                    triggerFrame: frameCounter + 120 
                });
            }
            textContainer.removeChild(drop.sprite);
            drop.sprite.destroy();
            drops.splice(i, 1);
        }
      }

      // 【更新墨跡殘影】
      for (let i = inkTrails.length - 1; i >= 0; i--) {
        const trail = inkTrails[i];
        
        trail.sprite.scale.x += trail.scaleSpeedX * delta;
        trail.sprite.scale.y += trail.scaleSpeedY * delta;
        trail.sprite.alpha -= trail.alphaSpeed * delta;
        trail.sprite.y += trail.vy * delta;
        
        // ⚙️ [細微調整] 殘影生成後，每過一幀還會持續變模糊的速度 (0.2)
        if (trail.blurFilter) {
          trail.blurFilter.blur += 0.2 * delta;
        }

        const trailBottom = trail.screen === 1 ? MONITOR_H : TOTAL_H;
        
        // ⚙️ [細微調整] 殘影銷毀界線。當透明度低於 0.01 (肉眼看不見) 或掉出螢幕底端時清除。
        if (trail.sprite.alpha <= 0.01 || trail.sprite.y > trailBottom) {
          trailContainer.removeChild(trail.sprite);
          trail.sprite.destroy();
          inkTrails.splice(i, 1);
        }
      }
    });

    setIsReady(true);
  };

  return (
    <div className="flex flex-col items-center py-10 min-h-screen bg-[#2A2B2E] text-[#E8E4D9] font-sans">
      <div className="mb-6 text-center px-4">
        <h1 className="text-2xl font-bold mb-2 tracking-widest text-amber-100">完美水墨：細微參數註解版</h1>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          程式碼已加入大量齒輪 ⚙️ 註解標籤。你可以透過搜尋這些標籤，自由微調眼淚大小、殘影速度、模糊時機等視覺細節。
        </p>
      </div>

      <div 
        ref={pixiContainer} 
        className="rounded-sm shadow-2xl border-4 border-[#111315] relative overflow-hidden"
        style={{ width: '400px', height: `${MONITOR_H + GAP_H + TABLET_H}px` }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#E8E4D9] text-[#1A1C20]">
            研墨載入中...
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-4 fixed bottom-8 z-10 bg-[#2A2B2E]/80 backdrop-blur px-6 py-4 rounded-full border border-gray-700 shadow-2xl">
        <button 
          onClick={() => window.spawnWord && window.spawnWord()}
          className="px-6 py-2 bg-transparent hover:bg-white/10 rounded-full font-medium transition-colors border border-[#E8E4D9]"
        >
          流出詞彙
        </button>
        <button 
          onClick={() => window.triggerCryingSequence && window.triggerCryingSequence()}
          className="px-6 py-2 bg-amber-700 hover:bg-amber-600 rounded-full font-medium transition-colors shadow-lg"
        >
          情緒崩潰 (10秒)
        </button>
      </div>
    </div>
  );
}