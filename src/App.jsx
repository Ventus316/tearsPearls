import React, { useEffect, useRef, useState } from 'react';

export default function App() {
  const pixiContainer = useRef(null);
  const appRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  const words = ['焦慮', '壓力', '自責', '委屈', '孤單', '沒事', '怎辦', '想念'];

  // ==========================================
  // 💡 【顯示器與設備尺寸設定區】 💡
  // 你可以在這裡自由調整這三個數值
  // ==========================================
  const MONITOR_H = 450; // 主顯示器高度
  const GAP_H = 50;      // 實體縫隙高度 (黑條)
  const TABLET_H = 350;  // 平板區域高度

  // --- 自動計算的衍生常數 (請勿修改) ---
  const TOTAL_H = MONITOR_H + GAP_H + TABLET_H; // 畫布總高度
  const TABLET_START_Y = MONITOR_H + GAP_H;     // 平板區的起始 Y 座標
  const VIRTUAL_H = MONITOR_H + TABLET_H;       // 扣除縫隙的物理總深度 (用於計算透明度與模糊)
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

    // 將畫布高度設為常數 TOTAL_H
    const app = new window.PIXI.Application({
      width: 400,
      height: TOTAL_H, 
      backgroundColor: 0xE8E4D9, 
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
    
    pixiContainer.current.appendChild(app.view);
    appRef.current = app;

    const uniqueChars = new Set(words.join('').split(''));
    const charTextures = {};
    
    uniqueChars.forEach(char => {
      const textGraphic = new window.PIXI.Text(char, {
        fontFamily: '"PingFang TC", "STKaiti", "KaiTi", serif',
        fontSize: 24, 
        fill: 0x111315, 
        fontWeight: 'bold',
      });
      charTextures[char] = app.renderer.generateTexture(textGraphic);
      textGraphic.destroy();
    });

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
    displacementFilter.scale.set(12);
    masterContainer.filters = [displacementFilter];
    app.stage.addChild(masterContainer);

    const trailContainer = new window.PIXI.Container();
    masterContainer.addChild(trailContainer);

    const textContainer = new window.PIXI.Container();
    masterContainer.addChild(textContainer);

    // 【實體縫隙遮罩】：使用常數設定位置與高度
    const bezelContainer = new window.PIXI.Container();
    app.stage.addChild(bezelContainer);

    const bezel = new window.PIXI.Graphics();
    bezel.beginFill(0x1A1C20); 
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
    delayText.y = MONITOR_H + (GAP_H / 2); // 置中於縫隙
    bezelContainer.addChild(delayText);

    const drops = [];
    const inkTrails = [];
    const dropQueue = [];
    const tabletQueue = []; 
    
    let frameCounter = 0; 
    let isCrying = false;
    let cryingTime = 0;
    const cryingDuration = 10000; 
    let wordSpawnTimer = 0;

    const spawnWordFlow = (isInner = Math.random() > 0.5, sizeScale = 1.0) => {
      const word = words[Math.floor(Math.random() * words.length)];
      const chars = word.split('');
      const isLeftEye = Math.random() > 0.5;
      
      const baseEyeX = isLeftEye ? app.screen.width * 0.3 : app.screen.width * 0.7;
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
          x: eyeX + (Math.random() - 0.5) * (8 * sizeScale), 
          y: 40, 
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
      blurFilter.blur = 0; 
      drop.filters = [blurFilter];

      textContainer.addChild(drop);

      drops.push({
        sprite: drop,
        char: char,
        blur: blurFilter,
        baseScale: scale, 
        vx: prevVx !== null ? prevVx : (Math.random() - 0.5) * 0.15, 
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

      if (isCrying) {
        cryingTime += delta * 16.66; 
        const p = Math.min(cryingTime / cryingDuration, 1); 

        const currentInterval = 1200 - Math.sin(p * Math.PI) * 800; 
        const framesPerWord = currentInterval / 16.66;

        wordSpawnTimer += delta;
        if (wordSpawnTimer >= framesPerWord) {
          wordSpawnTimer = 0;
          const isInner = Math.random() < (1 - p);
          const sizeScale = 0.4 + Math.sin(p * Math.PI) * 0.6;
          spawnWordFlow(isInner, sizeScale);
        }

        if (p === 1) {
          isCrying = false; 
        }
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
          // 【使用常數】：在平板區域起點重生
          spawnSingleChar(item.char, item.x, TABLET_START_Y, item.scale, 2, item.vx, item.vy);
          tabletQueue.splice(i, 1);
        }
      }

      waterSprite.tilePosition.y -= 1.5 * delta; 
      waterSprite.tilePosition.x -= 0.3 * delta;

      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        drop.life += delta;
        drop.sprite.y += drop.vy * delta;
        drop.sprite.x += drop.vx * delta + Math.sin(drop.life * 0.05) * 0.3; 

        // 【使用常數】：跨螢幕深度演算
        const virtualY = drop.screen === 1 ? drop.sprite.y : drop.sprite.y - GAP_H;
        const depthRatio = virtualY / VIRTUAL_H; 
        
        const fadeStart = 0.70; 
        const fadeEnd = 1.0;   
        const blurDepth = Math.min(depthRatio, fadeEnd);
        drop.blur.blur = Math.max(0, (blurDepth - 0.40) * 10);

        let targetAlpha = 1;
        if (depthRatio > fadeStart) {
            const fadeProgress = Math.min((depthRatio - fadeStart) / (fadeEnd - fadeStart), 1);
            targetAlpha = 1 - (0.1 * fadeProgress);
        }

        drop.sprite.alpha += (targetAlpha - drop.sprite.alpha) * 0.15;

        const triggerDist = Math.max(3, 5 * drop.baseScale); 
        const distMoved = drop.sprite.y - drop.lastTrailY;
        
        if (distMoved >= triggerDist && depthRatio > 0.2) {
          drop.lastTrailY = drop.sprite.y;
          
          const trail = new window.PIXI.Sprite(charTextures[drop.char]);
          trail.anchor.set(0.5);
          trail.x = drop.sprite.x;
          trail.y = drop.sprite.y;
          trail.rotation = Math.random() * 0.2 - 0.1; 
          
          trail.scale.y = 1.6 * drop.baseScale;
          trail.scale.x = (1.0 + (depthRatio * 0.5)) * drop.baseScale; 
          
          const trailBlur = new window.PIXI.BlurFilter();
          trailBlur.blur = depthRatio * 8; 
          trail.filters = [trailBlur];
          
          trail.alpha = 0.1 + (depthRatio * 0.4); 
          
          trailContainer.addChildAt(trail, 0);

          inkTrails.push({
            sprite: trail,
            blurFilter: trailBlur, 
            scaleSpeedX: 0.008 + (Math.random() * 0.005), 
            scaleSpeedY: 0.002,
            alphaSpeed: (0.015 + (Math.random() * 0.01)) / Math.max(0.6, drop.baseScale),  
            vy: drop.vy * 0.6,
            screen: drop.screen
          });
        }

        // 【使用常數】：銷毀與傳送判定
        const screenBottom = drop.screen === 1 ? MONITOR_H : TOTAL_H;
        if (drop.sprite.y > screenBottom) {
            if (drop.screen === 1) {
                tabletQueue.push({
                    char: drop.char,
                    x: drop.sprite.x,
                    scale: drop.baseScale, 
                    vx: drop.vx,
                    vy: drop.vy,
                    triggerFrame: frameCounter + 120 
                });
            }
            textContainer.removeChild(drop.sprite);
            drop.sprite.destroy();
            drops.splice(i, 1);
        }
      }

      for (let i = inkTrails.length - 1; i >= 0; i--) {
        const trail = inkTrails[i];
        
        trail.sprite.scale.x += trail.scaleSpeedX * delta;
        trail.sprite.scale.y += trail.scaleSpeedY * delta;
        trail.sprite.alpha -= trail.alphaSpeed * delta;
        trail.sprite.y += trail.vy * delta;
        
        if (trail.blurFilter) {
          trail.blurFilter.blur += 0.2 * delta;
        }

        // 【使用常數】：殘影銷毀判定
        const trailBottom = trail.screen === 1 ? MONITOR_H : TOTAL_H;
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
        <h1 className="text-2xl font-bold mb-2 tracking-widest text-amber-100">完美水墨：可調式跨螢幕版</h1>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          程式碼最上方已加入常數設定區。你可以自由修改顯示器、縫隙與平板的高度，所有物理運算將自動適應。
        </p>
      </div>

      <div 
        ref={pixiContainer} 
        className="rounded-sm shadow-2xl border-4 border-[#111315] relative overflow-hidden"
        // 【使用常數動態綁定外框高度】
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