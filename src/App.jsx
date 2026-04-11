import React, { useEffect, useRef, useState } from 'react';

export default function App() {
  const pixiContainer = useRef(null);
  const appRef = useRef(null);
  const [isReady, setIsReady] = useState(false);

  // 測試情緒詞彙
  const words = ['焦慮', '壓力很大', '自責', '委屈', '孤單', '沒事', '不知道怎麼辦', '想念'];

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
        fontSize: 34, 
        fill: 0x1A1C20, 
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

    // 【架構升級：修復 WebGL 閃爍衝突】
    // 1. 主圖層 (Master Container)：統一掌管水流扭曲，解決濾鏡衝突
    const masterContainer = new window.PIXI.Container();
    const displacementFilter = new window.PIXI.DisplacementFilter(waterSprite);
    displacementFilter.scale.set(12);
    masterContainer.filters = [displacementFilter];
    app.stage.addChild(masterContainer);

    // 2. 墨跡殘影層：放在主圖層內，擁有獨立的全局模糊
    const trailContainer = new window.PIXI.Container();
    const globalTrailBlur = new window.PIXI.BlurFilter();
    globalTrailBlur.blur = 3.5;
    trailContainer.filters = [globalTrailBlur]; // 只有這層會全域模糊
    masterContainer.addChild(trailContainer);

    // 3. 主體文字層：放在主圖層內，不掛任何全域模糊，確保出生絕對清晰
    const textContainer = new window.PIXI.Container();
    // 這裡不加 filter，完全解決了後面出來的字自帶模糊的 Bug
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
          x: eyeX + (Math.random() - 0.5) * 15, 
          y: 40, 
          triggerFrame: frameCounter + (index * 25) 
        });
      });
    };

    const spawnSingleChar = (char, startX, startY) => {
      const drop = new window.PIXI.Sprite(charTextures[char]);
      drop.anchor.set(0.5);
      drop.x = startX; 
      drop.y = startY;
      drop.alpha = 1;
      
      // 給每個文字獨立的模糊控制器
      const blurFilter = new window.PIXI.BlurFilter();
      blurFilter.blur = 0; // 一開始絕對清晰
      drop.filters = [blurFilter];

      // 放入文字層
      textContainer.addChild(drop);

      drops.push({
        sprite: drop,
        char: char,
        blur: blurFilter,
        vx: (Math.random() - 0.5) * 0.15, 
        vy: Math.random() * 0.5 + 1.2,    
        life: 0,
        lastTrailTime: 0
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

      waterSprite.tilePosition.y -= 1.0 * delta; 
      waterSprite.tilePosition.x -= 0.3 * delta;

      // 更新主文字
      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        drop.life += delta;
        drop.sprite.y += drop.vy * delta;
        drop.sprite.x += drop.vx * delta + Math.sin(drop.life * 0.03) * 0.2; 

        const depthRatio = drop.sprite.y / app.screen.height; 
        
        // 【控制文字開始模糊的時機】
        // 在 25% 之前，(depthRatio - 0.25) 為負數，Math.max 會將其鎖在 0，保持絕對清晰
        drop.blur.blur = Math.max(0, (depthRatio - 0.25) * 6);

        // 【控制文字淡出消失的時機 (70% 開始消失)】
        const fadeStart = 0.70; 
        const fadeEnd = 0.90;   
        let targetAlpha = 1;
        
        if (depthRatio > fadeStart) {
            const fadeProgress = Math.min((depthRatio - fadeStart) / (fadeEnd - fadeStart), 1);
            targetAlpha = Math.cos(fadeProgress * (Math.PI / 2));
        }

        // 平滑淡出，消除跳變閃爍
        drop.sprite.alpha += (targetAlpha - drop.sprite.alpha) * 0.15;

        // 【隱形文字持續分泌墨跡】
        if (drop.life - drop.lastTrailTime > (15 - depthRatio * 10)) {
          drop.lastTrailTime = drop.life;
          
          const trail = new window.PIXI.Sprite(charTextures[drop.char]);
          trail.anchor.set(0.5);
          trail.x = drop.sprite.x;
          trail.y = drop.sprite.y;
          trail.rotation = Math.random() * 0.2 - 0.1; 
          
          // 注意：因為外面的 trailContainer 已經有全局模糊了，
          // 這裡不需要再 new BlurFilter，大幅節省效能與記憶體！
          trail.alpha = 0.6; 
          
          trailContainer.addChildAt(trail, 0);

          inkTrails.push({
            sprite: trail,
            scaleSpeed: 0.005 + (Math.random() * 0.008), 
            alphaSpeed: 0.01 + (Math.random() * 0.01),  
            vy: drop.vy * 0.3 
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
        trail.sprite.scale.x += trail.scaleSpeed * delta;
        trail.sprite.scale.y += trail.scaleSpeed * delta;
        trail.sprite.alpha -= trail.alphaSpeed * delta;
        trail.sprite.y += trail.vy * delta;

        if (trail.sprite.alpha <= 0 || trail.sprite.y > app.screen.height + 150) {
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
        <h1 className="text-2xl font-bold mb-2 tracking-widest text-amber-100">情緒萃取：頂部清晰無閃爍版</h1>
        <p className="text-sm text-gray-400 max-w-md">
          徹底修復閃爍。文字從頂部出現絕對清晰，25%開始變模糊，70%開始消失，最後只剩墨水流動。
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