import React, { useEffect, useRef, useState } from 'react';

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
        fontSize: 27, 
        fill: 0x111315, // 使用極深墨色，確保高對比度
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
    
    // 1. 全域模糊 (產生暈染的灰階邊緣)
    const globalTrailBlur = new window.PIXI.BlurFilter();
    globalTrailBlur.blur = 6.0; 
    
    // 2. 顏色矩陣濾鏡 (將灰階邊緣二值化，形成黏稠的水滴邊界)
    const thresholdFilter = new window.PIXI.ColorMatrixFilter();
    thresholdFilter.matrix = [
      1, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 18, -5 // 關鍵：將 Alpha 通道放大 18 倍並減去 5
    ];
    
    trailContainer.filters = [globalTrailBlur, thresholdFilter]; 
    masterContainer.addChild(trailContainer);

    // 【主體文字層】：不掛任何全域模糊與閾值，確保出生絕對清晰
    const textContainer = new window.PIXI.Container();
    masterContainer.addChild(textContainer);

    const drops = [];
    const inkTrails = [];
    const dropQueue = [];
    let frameCounter = 0; 

    const spawnWordFlow = () => {
      const word = words[Math.floor(Math.random() * words.length)];
      const chars = word.split('');
      
      const isLeftEye = Math.random() > 0.5;
      const eyeX = isLeftEye ? app.screen.width * 0.3 : app.screen.width * 0.7;
      
      chars.forEach((char, index) => {
        dropQueue.push({
          char: char,
          x: eyeX + (Math.random() - 0.5) * 8, 
          y: 40, 
          triggerFrame: frameCounter + (index * 12) // 較緊密的發射間隔
        });
      });
    };

    const spawnSingleChar = (char, startX, startY) => {
      const drop = new window.PIXI.Sprite(charTextures[char]);
      drop.anchor.set(0.5);
      drop.x = startX; 
      drop.y = startY;
      drop.alpha = 1;
      
      const blurFilter = new window.PIXI.BlurFilter();
      blurFilter.blur = 0; 
      drop.filters = [blurFilter];

      textContainer.addChild(drop);

      drops.push({
        sprite: drop,
        char: char,
        blur: blurFilter,
        vx: (Math.random() - 0.5) * 0.15, 
        vy: Math.random() * 0.1 + 2.0, // 調整至恰當的速度
        life: 0,
        lastTrailY: startY // 改用距離追蹤
      });
    };

    window.spawnWord = spawnWordFlow;

    // --- 動畫循環 ---
    app.ticker.add((delta) => {
      frameCounter += delta;

      for (let i = dropQueue.length - 1; i >= 0; i--) {
        if (frameCounter >= dropQueue[i].triggerFrame) {
          spawnSingleChar(dropQueue[i].char, dropQueue[i].x, dropQueue[i].y);
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
        
        // 文字淡出消失 (70% 開始)
        const fadeStart = 0.70; 
        const fadeEnd = 0.90;   

        // 40% 開始模糊，並在文字完全消失的界線 (fadeEnd) 停止增加模糊度
        const blurDepth = Math.min(depthRatio, fadeEnd);
        drop.blur.blur = Math.max(0, (blurDepth - 0.40) * 10);

        let targetAlpha = 1;
        if (depthRatio > fadeStart) {
            const fadeProgress = Math.min((depthRatio - fadeStart) / (fadeEnd - fadeStart), 1);
            targetAlpha = Math.cos(fadeProgress * (Math.PI / 2));
        }

        drop.sprite.alpha += (targetAlpha - drop.sprite.alpha) * 0.15;
        drop.sprite.visible = drop.sprite.alpha > 0.01;

        // 【確保殘影互相沾黏：採用距離生成】
        const distMoved = drop.sprite.y - drop.lastTrailY;
        if (distMoved >= 5) {
          drop.lastTrailY = drop.sprite.y;
          
          const trail = new window.PIXI.Sprite(charTextures[drop.char]);
          trail.anchor.set(0.5);
          trail.x = drop.sprite.x;
          trail.y = drop.sprite.y;
          trail.rotation = Math.random() * 0.2 - 0.1; 
          
          // 將殘影垂直拉長，增加重疊面積，觸發更好的 Metaball 沾黏
          trail.scale.y = 1.5;
          trail.scale.x = 1.0 + (depthRatio * 0.5); // 越深越寬
          
          trailContainer.addChildAt(trail, 0);

          inkTrails.push({
            sprite: trail,
            scaleSpeedX: 0.008 + (Math.random() * 0.005), 
            scaleSpeedY: 0.002,
            alphaSpeed: 0.015 + (Math.random() * 0.01),  
            vy: drop.vy * 0.6 // 墨跡流動得比較慢，製造拖曳感
          });
        }

        // 銷毀機制
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
        
        // 【核心視覺】：這裡降低 Alpha 並不是讓畫面變灰，
        // 因為有 thresholdFilter 擋著，降低 Alpha 只會讓墨滴的面積「縮小」，直到斷裂！
        trail.sprite.alpha -= trail.alphaSpeed * delta;
        
        trail.sprite.y += trail.vy * delta;

        // 當墨滴收縮到極限 (Alpha 被濾鏡過濾掉) 時銷毀
        if (trail.sprite.alpha <= 0.2 || trail.sprite.y > app.screen.height + 150) {
          trailContainer.removeChild(trail.sprite);
          trail.sprite.destroy();
          inkTrails.splice(i, 1);
        }
      }
    });

    setIsReady(true);
  };

  const startCrying = () => {
    if (!window.spawnWord) return;
    let count = 0;
    const interval = setInterval(() => {
      window.spawnWord();
      count++;
      if (count > 15) clearInterval(interval); 
    }, 800); 
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#2A2B2E] text-[#E8E4D9] font-sans p-4">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold mb-2 tracking-widest text-amber-100">情緒萃取：元球流體墨跡版</h1>
        <p className="text-sm text-gray-400 max-w-md">
          採用 Metaball 演算法！下方拖曳出的墨水現在是銳利的實心黑塊，並且會像真實液體一樣互相沾黏、融化、斷裂。
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
          onClick={startCrying}
          className="px-6 py-3 bg-amber-700 hover:bg-amber-600 rounded-full font-medium transition-colors shadow-lg"
        >
          模擬情緒崩潰 (10秒)
        </button>
      </div>
    </div>
  );
}