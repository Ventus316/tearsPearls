// src/views/TabletView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { WORDS, SETTLEMENT_DESCRIPTIONS, GEM_MAPPING, SERVER_IP } from '../config/constants';
import { createTabletEngine } from '../engine/TabletEngine'; 
import { io } from 'socket.io-client';
import waitVideo from '../assets/wait_1080p.mp4';

const GEM_NAMES = {
  pearl: '珍珠',
  diamond: '鑽石',
  crystal: '白水晶',
  opal: '蛋白石',
  lapis: '青金石'
};

const PRECALCULATED_WORD_ROWS = [];
for (let i = 0; i < WORDS.length; i += 5) {
  PRECALCULATED_WORD_ROWS.push(WORDS.slice(i, i + 5));
}

/**
 * 平板互動視圖 (Tablet View)
 * 負責：互動選詞 UI、與顯示器的 Socket 連動、以及 60 秒螢幕閒置保護機制。
 */
export default function TabletView() {
  const pixiContainer = useRef(null); 
  const engineRef = useRef(null); 
  const socketRef = useRef(null);
  
  const [interactionState, setInteractionState] = useState('standby'); 
  const [selectedWords, setSelectedWords] = useState([]); 
  const [finalGemType, setFinalGemType] = useState('diamond');
  const idleTimerRef = useRef(null);

  const isReady = interactionState === 'ready';
  const canCry = isReady && selectedWords.length === 5;

  /**
   * ⏱️ 60 秒閒置自動休眠機制
   */
  const startIdleTimer = () => {
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setInteractionState('standby');
      setSelectedWords([]); 
      if (socketRef.current) socketRef.current.emit('tablet-sleep'); 
    }, 60000); 
  };

  /**
   * 👆 全域觸控監聽
   */
  const handleGlobalInteraction = () => {
    if (interactionState === 'playing') return;

    if (interactionState === 'standby') {
      setInteractionState('ready');
    }
    
    if (socketRef.current) {
      socketRef.current.emit('tablet-wake-up');
    }
    
    startIdleTimer();
  };

  useEffect(() => {
    socketRef.current = io(SERVER_IP);

    if (pixiContainer.current && !engineRef.current) {
      engineRef.current = createTabletEngine(pixiContainer.current, () => {
        setInteractionState('finished');
        if (socketRef.current) socketRef.current.emit('tablet-settlement');
        startIdleTimer(); 
      },
        (soundType) => {
          if (socketRef.current) {
            socketRef.current.emit('tablet-play-sound', soundType);
          }
        }
      );
    }

    socketRef.current.on('tablet-receive-tear', (data) => {
      if (engineRef.current) engineRef.current.receiveTear(data.nx, data.z, data.char, data.word);
    });
    
    socketRef.current.on('tablet-show-finished', () => {
      if (engineRef.current) engineRef.current.monitorFinished();
    });

    startIdleTimer();

    return () => { 
      clearTimeout(idleTimerRef.current);
      if (socketRef.current) socketRef.current.disconnect(); 
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);

  const toggleWord = (word) => {
    if (interactionState !== 'ready') return;
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter(w => w !== word));
    } else if (selectedWords.length < 5) {
      setSelectedWords([...selectedWords, word]);
    }
  };

  const determineGemType = (userWords) => {
    if (!userWords || userWords.length === 0) return 'diamond'; 
    
    const counts = { pearl: 0, diamond: 0, crystal: 0, opal: 0, lapis: 0 };
    
    userWords.forEach(word => { 
      for (const [gem, wordsList] of Object.entries(GEM_MAPPING)) { 
        if (wordsList.includes(word)) counts[gem]++; 
      } 
    });
    
    let maxCount = -1; 
    let selectedGem = 'diamond';
    
    for (const [gem, count] of Object.entries(counts)) { 
      if (count > maxCount) { 
        maxCount = count; 
        selectedGem = gem; 
      } 
    }
    return selectedGem;
  };

  const handleCrying = () => { 
    if (selectedWords.length !== 5) return;
    setInteractionState('playing'); 
    clearTimeout(idleTimerRef.current); 
    
    if (socketRef.current && engineRef.current) {
      socketRef.current.emit('tablet-trigger-crying', selectedWords);

      const calculatedGem = determineGemType(selectedWords);
      setFinalGemType(calculatedGem);
      engineRef.current.revealGem(determineGemType(selectedWords));
    }
  };

  const handleTryAgain = () => { 
    setInteractionState('ready'); 
    setSelectedWords([]); 
    if (socketRef.current) socketRef.current.emit('tablet-wake-up'); 
    startIdleTimer();
  };

  const getSettlementText = () => {
    const gemName = GEM_NAMES[finalGemType] || '結晶';
    const fallbackText = '沉重的落淚，已淬鍊成不碎的結晶。';
    
    const description = (selectedWords.length === 0) 
      ? fallbackText 
      : (SETTLEMENT_DESCRIPTIONS?.[selectedWords[selectedWords.length - 1]] || fallbackText);

    return `【 ${gemName} 】\n\n${description}`;
  };

  // 🌟 新增：動態計算按鈕上的感性文字
  const getButtonText = () => {
    if (selectedWords.length === 0) return '傾聽心聲，挑選 5 個無法言說的真實狀態';
    if (selectedWords.length < 5) return `已拼湊 ${selectedWords.length} 份靈魂碎片...`;
    return '盡情哭吧';
  };

  const renderWordButton = (word) => {
    const selected = selectedWords.includes(word);
    return (
      <button
        key={word}
        onClick={() => toggleWord(word)}
        className={`flex w-full h-[40px] md:h-[48px] lg:h-[52px] items-center justify-center rounded-full border-[2px] md:border-[3px] text-[18px] font-medium tracking-[0.18em] transition-all duration-200 ${
          selected
            ? 'border-[#e6ffff] bg-[#b8d8f0] text-[#173133] shadow-[0_0_15px_rgba(255,255,255,0.7)] scale-[1.03]'
            : 'border-[#b8e8ea] bg-[#a8cfea] text-[#173133] shadow-[0_0_8px_rgba(255,255,255,0.3)] hover:-translate-y-1 hover:brightness-105'
        }`}
      >
        {word}
      </button>
    );
  };

  return (
    /* 待機畫面 */
    <div 
      className="w-screen h-screen overflow-hidden bg-[#050507] text-[#E8E4D9] select-none relative"
      onPointerDown={handleGlobalInteraction}
    >
      {/* 待機影片層 */}
      <video
        src={waitVideo}
        autoPlay
        loop
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover z-50 transition-opacity duration-1000 ${
          interactionState === 'standby' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* 🌟 新增：透明提示文字圖層 */}
      <div 
        className={`absolute inset-0 z-[51] flex items-center justify-center pointer-events-none transition-opacity duration-1000 ${
          interactionState === 'standby' ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <p className="text-black/50 text-[25px] font-light tracking-[0.4em] animate-pulse drop-shadow-md">
          輕觸畫面開始互動
        </p>
      </div>

      <div ref={pixiContainer} className="absolute inset-0 z-0" />

      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
        <div className={`pointer-events-auto relative flex w-full h-full flex-col overflow-hidden rounded-[64px] border-[6px] md:border-[8px] border-[#a1d7d8]/60 bg-[rgba(146,162,166,0.92)] shadow-[0_0_80px_rgba(0,0,0,0.38)] transition-all duration-1000 ${interactionState === 'playing' || interactionState === 'standby' ? 'opacity-0 scale-[0.985]' : 'opacity-100 scale-100'}`}>
          
          {interactionState === 'ready' && (
            <div className="flex h-full w-full flex-col">
              
              {/* ❌ 已經將上方突兀的白色數字半圓形與佔位區塊刪除 */}

              <div className="flex flex-1 flex-col w-full items-center justify-center px-4 md:px-12 lg:px-16 mt-20 ">
                <div className="w-full max-w-[800px] h-[3px] bg-[#e0f8fa]/40 rounded-full mb-3 md:mb-5 shadow-[0_0_8px_rgba(224,248,250,0.3)]"></div>

                <div className="flex flex-col w-full max-w-[800px] gap-y-2 md:gap-y-3 my-1">
                  {PRECALCULATED_WORD_ROWS.map((row, rowIndex) => (
                    <React.Fragment key={rowIndex}>
                      <div className="grid grid-cols-5 gap-10 mx-10 md:mx-20">
                        {row.map(renderWordButton)}
                      </div>
                      {rowIndex < PRECALCULATED_WORD_ROWS.length - 1 && (
                        <div className="w-full h-[1px] md:h-[1.5px] bg-[#e0f8fa]/20 rounded-full my-1"></div>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <div className="w-full max-w-[800px] h-[3px] bg-[#e0f8fa]/40 rounded-full mt-3 md:mt-5 shadow-[0_0_8px_rgba(224,248,250,0.3)]"></div>
              </div>

              {/* 🌟 修改：將按鈕寬度改為動態延展，以容納感性文字 */}
              <div className="shrink-0 flex w-full items-center justify-center pt-2 pb-13">
                <button
                  onClick={handleCrying}
                  disabled={!canCry}
                  className={`flex h-[50px] md:h-[60px] lg:h-[64px] min-w-[320px] w-fit items-center justify-center rounded-full border-[3px] px-10 font-semibold tracking-[0.2em] transition-all duration-500 md:text-[22px] ${
                    canCry
                      ? 'border-[#d9f7f7] bg-[#585b6e] text-[#94eaec] shadow-[0_0_24px_rgba(148,234,236,0.35)] hover:brightness-110 active:scale-[0.98] cursor-pointer text-[20px]'
                      : 'cursor-not-allowed border-[#d9f7f7]/40 bg-[#4d5061]/50 text-[#94eaec]/70 opacity-90 text-[16px] md:text-[18px] font-light'
                  }`}
                >
                  {getButtonText()}
                </button>
              </div>
              
            </div>
          )}

          {/* 結算畫面層 */}
          {interactionState === 'finished' && (
            <div className="flex h-full w-full items-center justify-center px-4 z-20 animate-in fade-in duration-1000">
              <div className="flex w-[min(100%,600px)] flex-col items-center rounded-[32px] border border-white/10 bg-[#1c1c1e]/80 px-8 py-10 shadow-2xl backdrop-blur-2xl">
                <p className="w-full text-center text-[20px] font-light tracking-[0.2em] text-white/40">情緒已結晶</p>
                <div className="mb-4 mt-3 h-[2px] w-full bg-white/20" />
                
                <p className="px-4 py-2 text-center text-[18px] font-light leading-relaxed tracking-[0.15em] text-amber-50/90 whitespace-pre-line">
                  {getSettlementText()}
                </p>
                
                <div className="mb-4 mt-4 h-[2px] w-full bg-white/20" />
                <button onClick={handleTryAgain} className="w-full rounded-[18px] bg-[#2c2c2e] py-4 text-[14px] font-light tracking-widest text-gray-200 transition-transform active:scale-95 hover:bg-[#3a3a3c]">
                  與另一個自己對話
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}