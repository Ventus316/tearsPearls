// src/config/constants.js

export const WORDS = [
  '孤單', '想念', '失去', '委屈', '責任', 
  '焦慮', '壓力', '自責', '沒事', '還好', 
  '無力', '有點累', '說不出口', '後悔', '怎麼辦', 
  '捨不得', '面子', '期待', '別丟臉', '不能示弱'
];

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
export const TEXT_STROKE_WIDTH = 1; 

export const CRYING_DURATION = 10000; 
export const NETWORK_DELAY_FRAMES = 60; 

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

export const CONVERGE_SPEED_MOVE = 0.01;    
export const CONVERGE_SPEED_ALPHA = 0.92;   
export const CONVERGE_SPEED_SCALE = 0.97;   
export const CONVERGE_BOTTOM_OFFSET = 30;   
export const CONVERGE_FADE_HEIGHT = 150;    

// ==========================================
// ✨ 寶石與情緒對應字典 (心理測驗分類)
// ==========================================
export const GEM_MAPPING = {
  pearl: ['孤單', '想念', '失去', '委屈'],         // 珍珠：悲傷與失落
  diamond: ['責任', '焦慮', '壓力', '自責'],       // 鑽石：重擔與自我要求
  quartz: ['沒事', '還好', '無力', '有點累'],       // 白水晶：疲憊與壓抑
  opal: ['說不出口', '後悔', '怎麼辦', '捨不得'],  // 蛋白石：迷惘與糾結
  lapis: ['面子', '期待', '別丟臉', '不能示弱']    // 青金石：武裝與自尊
};