// src/views/TabletView.jsx
import React, { useState, useEffect, useRef } from 'react';
import { WORDS, SETTLEMENT_DESCRIPTIONS, GEM_MAPPING, SERVER_IP } from '../config/constants';
import { createTabletEngine } from '../engine/TabletEngine'; 
import { io } from 'socket.io-client';
import waitVideo from '../assets/wait_1080p.mp4';

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
  const idleTimerRef = useRef(null);

  const isReady = interactionState === 'ready';
  const canCry = isReady && selectedWords.length === 5;

  /**
   * ⏱️ 60 秒閒置自動休眠機制
   * 若 60 秒無任何觸控，強制進入待機模式，並同步通知顯示器。
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
   * 任何觸控都會重置閒置計時器，並向大螢幕發送喚醒同步訊號。
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
      });
    }

    // 📥 監聽大螢幕發送的眼淚座標與字元
    socketRef.current.on('tablet-receive-tear', (data) => {
      if (engineRef.current) engineRef.current.receiveTear(data.nx, data.z, data.char);
    });
    
    // 📥 監聽大螢幕動畫結束訊號
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

  /**
   * 🔘 切換詞彙選擇狀態
   */
  const toggleWord = (word) => {
    if (interactionState !== 'ready') return;
    if (selectedWords.includes(word)) {
      setSelectedWords(selectedWords.filter(w => w !== word));
    } else if (selectedWords.length < 5) {
      setSelectedWords([...selectedWords, word]);
    }
  };

  /**
   * 💎 根據選擇的詞彙計算對應的寶石類型
   */
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
    if (selectedWords.length === 0) return '沉重的落淚，已淬鍊成不碎的結晶。';
    return SETTLEMENT_DESCRIPTIONS?.[selectedWords[selectedWords.length - 1]] || '沉重的落淚，已淬鍊成不碎的結晶。';
  };

  const renderWordButton = (word) => {
    const selected = selectedWords.includes(word);
    return (
      <button
        key={word}
        onClick={() => toggleWord(word)}
        className={`flex w-full h-[40px] md:h-[48px] lg:h-[52px] items-center justify-center rounded-full border-[2px] md:border-[3px] text-[13px] md:text-[15px] lg:text-[16px] font-medium tracking-[0.18em] transition-all duration-200 ${
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

      <div ref={pixiContainer} className="absolute inset-0 z-0" />

      {/* 互動介面層 */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
        <div className={`pointer-events-auto relative flex w-full h-full flex-col overflow-hidden rounded-[64px] border-[6px] md:border-[8px] border-[#a1d7d8]/60 bg-[rgba(146,162,166,0.92)] shadow-[0_0_80px_rgba(0,0,0,0.38)] transition-all duration-1000 ${interactionState === 'playing' || interactionState === 'standby' ? 'opacity-0 scale-[0.985]' : 'opacity-100 scale-100'}`}>
          
          {interactionState === 'ready' && (
            <div className="flex h-full w-full flex-col">
              
              <div 
                className="absolute left-1/2 top-0 flex items-end justify-center z-10"
                style={{ transform: 'translate(-50%, calc(-50% - 190px))' }} 
              >
                <div className="flex h-[505px] w-[600px] rounded-[50%] items-end justify-center border-[8px] border-[#e0f8fa] bg-[#fdffff] shadow-[0_0_60px_rgba(214,255,255,0.85)]">
                  <span 
                    className="text-[40px] font-normal tracking-[0.05em] text-[#868999]"
                    style={{ transform: 'translateY(-0px)' }} 
                  >
                    {selectedWords.length}/5
                  </span>
                </div>
              </div>

              <div className="shrink-0 h-[70px] md:h-[90px]"></div>

              <div className="flex flex-1 flex-col w-full items-center justify-center px-4 md:px-12 lg:px-16">
                <div className="w-full max-w-[800px] h-[3px] bg-[#e0f8fa]/40 rounded-full mb-3 md:mb-5 shadow-[0_0_8px_rgba(224,248,250,0.3)]"></div>

                <div className="flex flex-col w-full max-w-[800px] gap-y-2 md:gap-y-3 my-1">
                  {/* 👇 改成 PRECALCULATED_WORD_ROWS 👇 */}
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

              <div className="shrink-0 flex w-full items-center justify-center pt-2 pb-8 md:pt-3 md:pb-12">
                <button
                  onClick={handleCrying}
                  disabled={!canCry}
                  className={`flex h-[50px] md:h-[60px] lg:h-[64px] w-[min(60vw,320px)] items-center justify-center rounded-full border-[3px] px-6 text-[20px] font-semibold tracking-[0.2em] transition-all duration-300 md:text-[24px] ${
                    canCry
                      ? 'border-[#d9f7f7] bg-[#585b6e] text-[#94eaec] shadow-[0_0_24px_rgba(148,234,236,0.35)] hover:brightness-110 active:scale-[0.98] cursor-pointer'
                      : 'cursor-not-allowed border-[#d9f7f7]/60 bg-[#4d5061] text-[#94eaec]/50 opacity-80'
                  }`}
                >
                  盡情哭吧
                </button>
              </div>
              
            </div>
          )}

          {/* 結算畫面層 */}
          {interactionState === 'finished' && (
            <div className="flex h-full w-full items-center justify-center px-6 z-20 animate-in fade-in duration-1000">
              <div className="flex w-[min(100%,520px)] flex-col items-center rounded-[32px] border border-white/10 bg-[#1c1c1e]/80 px-8 py-8 shadow-2xl backdrop-blur-2xl">
                <p className="w-full text-center text-xs font-light tracking-[0.2em] text-white/40">情緒已結晶</p>
                <div className="mb-4 mt-3 h-[2px] w-full bg-white/20" />
                
                <p className="px-4 py-2 text-center text-[15px] font-light leading-relaxed tracking-[0.15em] text-amber-50/90 whitespace-pre-line">
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