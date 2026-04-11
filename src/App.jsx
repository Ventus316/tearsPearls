import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js'
import './index.css'

export default function App() {
  const pixiContainer = useRef(null);
  const appRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // 測試情緒詞彙
  const words = ['焦慮', '壓力', '自責', '委屈', '孤單', '沒事', '怎辦', '想念'];

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
      height: 700,
      backgroundColor: 0xE8E4D9, // 宣紙色
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
        fontFamily: '"PingFang TC", "STKaiti", "KaiTi", serif',
        // 依照要求，設定最大值為 24
        fontSize: 24, 
        fill: 0x111315, 
        fontWeight: 'bold',
      });
      charTextures[char] = app.renderer.generateTexture(textGraphic);
      textGraphic.destroy();
    });

    // --- 背景水波 ---
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

    // 【主圖層】：統一掌管水流扭曲
    const masterContainer = new window.PIXI.Container();
    const displacementFilter = new window.PIXI.DisplacementFilter(waterSprite);
    displacementFilter.scale.set(12);
    masterContainer.filters = [displacementFilter];
    app.stage.addChild(masterContainer);

    // 【墨跡殘影層：元球魔法核心】
    const trailContainer = new window.PIXI.Container();
    const globalTrailBlur = new window.PIXI.BlurFilter();
    globalTrailBlur.blur = 6.0; 
    
    const thresholdFilter = new window.PIXI.ColorMatrixFilter();
    thresholdFilter.matrix = [
      1, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 18, -5 
    ];
    
    trailContainer.filters = [globalTrailBlur, thresholdFilter]; 
    masterContainer.addChild(trailContainer);

    // 【主體文字層】
    const textContainer = new window.PIXI.Container();
    masterContainer.addChild(textContainer);

    const drops = [];
    const inkTrails = [];
    const dropQueue = [];
    let frameCounter = 0; 

    // 【動態參數】：管理情緒崩潰的時間軸
    let isCrying = false;
    let cryingTime = 0;
    const cryingDuration = 10000; // 情緒曲線總時長 (10秒)
    let wordSpawnTimer = 0;

    // --- 定義：產生一個詞彙的排隊邏輯 (加入眼位與縮放比例) ---
    const spawnWordFlow = (isInner = Math.random() > 0.5, sizeScale = 1.0) => {
      const word = words[Math.floor(Math.random() * words.length)];
      const chars = word.split('');
      const isLeftEye = Math.random() > 0.5;
      
      // 計算虛擬眼頭/眼尾座標
      // 左眼中心 0.3，眼頭向右(鼻樑)，眼尾向左
      // 右眼中心 0.7，眼頭向左(鼻樑)，眼尾向右
      const baseEyeX = isLeftEye ? app.screen.width * 0.3 : app.screen.width * 0.7;
      const eyeOffset = 22; // 眼頭與眼尾的距離
      let eyeX = baseEyeX;
      
      if (isLeftEye) {
        eyeX += isInner ? eyeOffset : -eyeOffset;
      } else {
        eyeX += isInner ? -eyeOffset : eyeOffset;
      }
      
      chars.forEach((char, index) => {
        dropQueue.push({
          char: char,
          x: eyeX + (Math.random() - 0.5) * (8 * sizeScale), // 根據大小動態調整橫向微移
          y: 40, 
          triggerFrame: frameCounter + (index * 12), 
          scale: sizeScale // 傳遞動態大小
        });
      });
    };

    const spawnSingleChar = (char, startX, startY, scale) => {
      const drop = new window.PIXI.Sprite(charTextures[char]);
      drop.anchor.set(0.5);
      drop.x = startX; 
      drop.y = startY;
      drop.alpha = 1;
      
      // 套用傳遞過來的情緒動態縮放
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
        vx: (Math.random() - 0.5) * 0.15, 
        // 讓小眼淚流得稍微慢一點點，增加物理寫實感
        vy: (Math.random() * 0.1 + 2.0) * (0.8 + scale * 0.2), 
        life: 0,
        lastTrailY: startY 
      });
    };

    window.spawnWord = () => spawnWordFlow(Math.random() > 0.5, 0.8);

    window.triggerCryingSequence = () => {
      if(isCrying) return;
      isCrying = true;
      cryingTime = 0;
      wordSpawnTimer = 0;
    };

    // --- 動畫循環 ---
    app.ticker.add((delta) => {
      frameCounter += delta;

      // 【情緒崩潰時間軸引擎】
      if (isCrying) {
        cryingTime += delta * 16.66; // 轉換 delta 為近似毫秒
        const p = Math.min(cryingTime / cryingDuration, 1); // 0 到 1 的進度

        // 1. 生成頻率 (Rate)：開始慢(1200ms) -> 中間快(400ms) -> 結束慢(1200ms)
        const currentInterval = 1200 - Math.sin(p * Math.PI) * 800; 
        const framesPerWord = currentInterval / 16.66;

        wordSpawnTimer += delta;
        if (wordSpawnTimer >= framesPerWord) {
          wordSpawnTimer = 0;
          
          // 2. 眼位機率 (Inner/Outer)：進度越近1，越不可能是眼頭 (眼頭先乾涸)
          const isInner = Math.random() < (1 - p);
          
          // 3. 淚滴大小 (Scale)：開始小(0.4) -> 巔峰最大(1.0，即 24px) -> 結束小(0.4)
          const sizeScale = 0.4 + Math.sin(p * Math.PI) * 0.6;
          
          spawnWordFlow(isInner, sizeScale);
        }

        if (p === 1) {
          isCrying = false; // 10 秒後完全停止分泌眼淚
        }
      }

      // 排隊掉落系統
      for (let i = dropQueue.length - 1; i >= 0; i--) {
        if (frameCounter >= dropQueue[i].triggerFrame) {
          const item = dropQueue[i];
          spawnSingleChar(item.char, item.x, item.y, item.scale);
          dropQueue.splice(i, 1); 
        }
      }

      waterSprite.tilePosition.y -= 1.5 * delta; 
      waterSprite.tilePosition.x -= 0.3 * delta;

      // 更新主文字
      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        drop.life += delta;
        drop.sprite.y += drop.vy * delta;
        drop.sprite.x += drop.vx * delta + Math.sin(drop.life * 0.05) * 0.3; 

        const depthRatio = drop.sprite.y / app.screen.height; 
        
        // 40% 開始模糊，並在 fadeEnd 停止增加模糊度
        const fadeStart = 0.70; 
        const fadeEnd = 0.90;   
        const blurDepth = Math.min(depthRatio, fadeEnd);
        drop.blur.blur = Math.max(0, (blurDepth - 0.40) * 10);

        let targetAlpha = 1;
        if (depthRatio > fadeStart) {
            const fadeProgress = Math.min((depthRatio - fadeStart) / (fadeEnd - fadeStart), 1);
            targetAlpha = Math.cos(fadeProgress * (Math.PI / 2));
        }

        drop.sprite.alpha += (targetAlpha - drop.sprite.alpha) * 0.15;
        drop.sprite.visible = drop.sprite.alpha > 0.01;

        // 【產生沾黏殘影】
        // 因應小眼淚，動態調整觸發間距，確保小眼淚的殘影也能連貫
        const triggerDist = Math.max(3, 5 * drop.baseScale); 
        const distMoved = drop.sprite.y - drop.lastTrailY;
        
        if (distMoved >= triggerDist) {
          drop.lastTrailY = drop.sprite.y;
          
          const trail = new window.PIXI.Sprite(charTextures[drop.char]);
          trail.anchor.set(0.5);
          trail.x = drop.sprite.x;
          trail.y = drop.sprite.y;
          trail.rotation = Math.random() * 0.2 - 0.1; 
          
          // 殘影依據文字本身的大小按比例延伸
          trail.scale.y = 1.6 * drop.baseScale;
          trail.scale.x = (1.0 + (depthRatio * 0.5)) * drop.baseScale; 
          
          trailContainer.addChildAt(trail, 0);

          inkTrails.push({
            sprite: trail,
            scaleSpeedX: 0.008 + (Math.random() * 0.005), 
            scaleSpeedY: 0.002,
            // 小眼淚消散稍微快一點
            alphaSpeed: (0.015 + (Math.random() * 0.01)) / Math.max(0.6, drop.baseScale),  
            vy: drop.vy * 0.6 
          });
        }

        if (drop.sprite.alpha < 0.01 && drop.sprite.y > app.screen.height + 80) {
          textContainer.removeChild(drop.sprite);
          drop.sprite.destroy();
          drops.splice(i, 1);
        }
      }

      // 更新墨跡殘影
      for (let i = inkTrails.length - 1; i >= 0; i--) {
        const trail = inkTrails[i];
        
        trail.sprite.scale.x += trail.scaleSpeedX * delta;
        trail.sprite.scale.y += trail.scaleSpeedY * delta;
        trail.sprite.alpha -= trail.alphaSpeed * delta;
        trail.sprite.y += trail.vy * delta;

        if (trail.sprite.alpha <= 0.2 || trail.sprite.y > app.screen.height + 150) {
          trailContainer.removeChild(trail.sprite);
          trail.sprite.destroy();
          inkTrails.splice(i, 1);
        }
      }
    });

    setIsReady(true);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#2A2B2E] text-[#E8E4D9] font-sans p-4">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold mb-2 tracking-widest text-amber-100">情緒萃取：眼位起伏與情緒弧線版</h1>
        <p className="text-sm text-gray-400 max-w-md">
          按下模擬崩潰。眼淚將從小顆的眼頭蓄積，達到全尺寸的雙眼崩潰，最後以眼尾的微弱殘滴結束。
        </p>
      </div>

      <div 
        ref={pixiContainer} 
        className="rounded-sm shadow-2xl border border-[#1A1C20] relative overflow-hidden"
        style={{ width: '400px', height: '700px' }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#E8E4D9] text-[#1A1C20]">
            研墨中...
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-4">
        <button 
          onClick={() => window.spawnWord && window.spawnWord()}
          className="px-6 py-3 bg-transparent hover:bg-white/10 rounded-full font-medium transition-colors border border-[#E8E4D9]"
        >
          流出一個詞彙
        </button>
        <button 
          onClick={() => window.triggerCryingSequence && window.triggerCryingSequence()}
          className="px-6 py-3 bg-amber-700 hover:bg-amber-600 rounded-full font-medium transition-colors shadow-lg"
        >
          模擬情緒崩潰 (10秒)
        </button>
      </div>
    </div>
  );
}