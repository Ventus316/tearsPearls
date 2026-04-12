// src/config/constants.js

// ==========================================
// 💧 核心內容設定
// ==========================================

// 測試情緒詞彙 (可以自由增減，建議字數一致)
export const WORDS = ['焦慮', '壓力', '自責', '委屈', '孤單', '沒事', '怎辦', '想念'];

// ==========================================
// 📏 設備與實體空間尺寸 (單位: px)
// ==========================================
export const MONITOR_H = 700; // 主顯示器高度
export const GAP_H = 50;      // 實體縫隙高度 (兩螢幕之間的黑條距離)
export const TABLET_H = 400;  // 平板區域高度

// --- 以下為自動計算的衍生常數 (請勿修改) ---
export const TOTAL_H = MONITOR_H + GAP_H + TABLET_H; // 畫布總高度
export const TABLET_START_Y = MONITOR_H + GAP_H;     // 平板區的起始 Y 座標
export const VIRTUAL_H = MONITOR_H + TABLET_H;       // 扣除縫隙的物理總深度 (用於計算透明度與模糊)

// ==========================================
// 🎨 視覺與色彩設定
// ==========================================
export const BG_COLOR = 0xE8E4D9;    // 背景顏色 (宣紙色)
export const TEXT_COLOR = 0x111315;  // 文字顏色 (極深墨色)
export const BEZEL_COLOR = 0x1A1C20; // 實體縫隙(黑框)的顏色

// 字體設定
export const FONT_FAMILY = '"PingFang TC", "STKaiti", "KaiTi", serif';
export const FONT_SIZE_BASE = 24;    // 文字最大絕對尺寸 (當 scale 為 1 時的 px)

// ==========================================
// ⏱️ 互動與時間設定
// ==========================================
export const CRYING_DURATION = 10000; // 點擊「情緒崩潰」後的動畫總時長 (毫秒)
export const NETWORK_DELAY_FRAMES = 120; // 跨螢幕傳輸延遲 (預設 60FPS 下，120 = 2 秒)

// ==========================================
// 🌊 物理與水墨特效參數 (進階微調)
// ==========================================

// --- 環境扭曲 ---
// 數值越大，文字被背景水流扭曲、撕裂的程度就越嚴重
export const DISPLACEMENT_STRENGTH = 12; 

// --- 水波流動速度 ---
export const WATER_SPEED_Y = 1.5; // 往下流動的速度
export const WATER_SPEED_X = 0.3; // 往左流動的速度

// --- 眼淚生成位置 ---
export const EYE_OFFSET = 22; // 眼頭與眼尾的寬度距離 (越大，淚痕分佈越寬)

// --- 文字掉落物理 ---
// 決定同一個詞裡面，字與字掉落的時間間隔。越大，字排得越長越稀疏。
export const WORD_SPAWN_INTERVAL = 12; 

// 橫向飄移基準速度 (控制 S 型軌跡的寬度)
export const BASE_VELOCITY_X = 0.15; 

// S 型擺動設定
export const SWAY_FREQUENCY = 0.05; // 擺動頻率
export const SWAY_AMPLITUDE = 0.3;  // 左右擺動的最大像素幅度

// --- 模糊與透明度 (深度演算) ---
export const FADE_START_RATIO = 0.70; // 從畫面 70% 深度處開始變透明
export const FADE_END_RATIO = 1.0;    // 畫面 100% 處達到設定的最低透明度
export const MIN_ALPHA = 0.9;         // 掉到底部時保留的最低透明度 (1 - 0.1 = 0.9)
export const ALPHA_EASE = 0.15;       // 透明度過渡的平滑度 (決定靠近目標透明度的速度)

// 主文字模糊設定
export const BLUR_START_RATIO = 0.40; // 畫面 40% 處開始模糊
export const BLUR_MULTIPLIER = 10;    // 模糊增長的倍率 (改大會糊得更快、字體崩解更嚴重)

// --- 水墨殘影 (Trails) ---
// 殘影生成間距乘數 (5 * scale)。數字越小，殘影蓋得越密，但也越耗效能。
export const TRAIL_SPAWN_DENSITY = 5; 

// 殘影開始分泌的深度閥值 (0.2 代表掉落超過 20% 高度後才開始產生殘影)
export const TRAIL_START_DEPTH = 0.2; 

// 殘影初始形狀比例
export const TRAIL_SCALE_Y = 1.6; // 垂直拉長，填補殘影縫隙，讓水墨連貫
export const TRAIL_SCALE_X_BASE = 1.0; 
export const TRAIL_SCALE_X_DEPTH_MULTIPLIER = 0.5; // 越掉越深，殘影稍微越寬

// 殘影初始狀態
export const TRAIL_INITIAL_BLUR_MULTIPLIER = 8; // 剛生出來時的模糊倍率 (隨深度增加)
export const TRAIL_BASE_ALPHA = 0.1;            // 基礎灰度
export const TRAIL_DEPTH_ALPHA_MULTIPLIER = 0.4;  // 越深的地方生出的殘影越黑

// 殘影在空中的變化速度
export const TRAIL_EXPAND_SPEED_Y = 0.002; // Y軸垂直拉長的速度
export const TRAIL_BLUR_INCREASE_RATE = 0.2; // 殘影每幀持續變模糊的速度

// 殘影自身的重力掉落速度乘數 (0.6 代表它掉得比主文字慢，形成拖尾感)
export const TRAIL_GRAVITY_MULTIPLIER = 0.6;