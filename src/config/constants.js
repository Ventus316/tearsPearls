// src/config/constants.js

export const WORDS = ['焦慮', '壓力', '自責', '委屈', '孤單', '沒事', '怎辦', '想念'];
export const MONITOR_H = 700; 
export const GAP_H = 50;      
export const TABLET_H = 400;  

export const TOTAL_H = MONITOR_H + GAP_H + TABLET_H; 
export const TABLET_START_Y = MONITOR_H + GAP_H;     
export const VIRTUAL_H = MONITOR_H + TABLET_H;       

export const BG_COLOR = 0xE8E4D9;    
export const TEXT_COLOR = 0x111315;  
export const BEZEL_COLOR = 0x1A1C20; 

export const FONT_FAMILY = '"PingFang TC", "STKaiti", "KaiTi", serif';
export const FONT_SIZE_BASE = 24;    
export const TEXT_STROKE_WIDTH = 1; // 白邊粗細 (px)

export const CRYING_DURATION = 10000; 
export const NETWORK_DELAY_FRAMES = 120; 

export const DISPLACEMENT_STRENGTH = 12; 
export const WATER_SPEED_Y = 1.5; 
export const WATER_SPEED_X = 0.3; 

export const EYE_OFFSET = 22; 
export const WORD_SPAWN_INTERVAL = 12; 
export const BASE_VELOCITY_X = 0.15; 
export const SWAY_FREQUENCY = 0.05; 
export const SWAY_AMPLITUDE = 0.3;  

export const FADE_START_RATIO = 0.70; 
export const FADE_END_RATIO = 1.0;    
export const MIN_ALPHA = 0.9;         
export const ALPHA_EASE = 0.15;       

export const BLUR_START_RATIO = 0.40; 
export const BLUR_MULTIPLIER = 10;    

export const TRAIL_SPAWN_DENSITY = 5; 
export const TRAIL_START_DEPTH = 0.2; 
export const TRAIL_SCALE_Y = 1.6; 
export const TRAIL_SCALE_X_BASE = 1.0; 
export const TRAIL_SCALE_X_DEPTH_MULTIPLIER = 0.5; 
export const TRAIL_INITIAL_BLUR_MULTIPLIER = 8; 
export const TRAIL_BASE_ALPHA = 0.1;            
export const TRAIL_DEPTH_ALPHA_MULTIPLIER = 0.4;  
export const TRAIL_EXPAND_SPEED_Y = 0.002; 
export const TRAIL_BLUR_INCREASE_RATE = 0.2; 
export const TRAIL_GRAVITY_MULTIPLIER = 0.6;

// ==========================================
// ✨ 寶石匯聚動畫參數 (已解耦)
// ==========================================
export const CONVERGE_SPEED_MOVE = 0.01;  // 飛向寶石中心的速度 (數字越小，吸過去的軌跡越滑順)
export const CONVERGE_FADE_DISTANCE = -100; // 距離寶石多近(px)時才開始透明化 (解決半空消失的問題)
export const CONVERGE_SPEED_ALPHA = 0.96; // 透明化的速度
export const CONVERGE_SPEED_SCALE = 0.99; // 縮小的速度