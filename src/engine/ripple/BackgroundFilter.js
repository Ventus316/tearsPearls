// src/engine/ripple/BackgroundFilter.js
export const backgroundFragSource = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;   // PIXI 預設的畫布採樣
uniform sampler2D iChannel0;  // 我們匯入的背景紋理圖 (Rainier_mood.jpg)
uniform vec2 uResolution;
uniform float uTime;

#define S smoothstep

// 原版的 Palette 色彩演算法 [cite: 1, 2, 3, 4]
vec3 GetPaletteColor(float t) {
    vec3 a = vec3(0.95, 0.51, 0.00);
    vec3 b = vec3(1.00, 0.22, 0.00);
    vec3 c = vec3(3.00, 2.70, 0.00);
    vec3 d = vec3(0.63, 0.00, 1.00);
    return a + b * cos(6.28318 * (c * t + d));
}

void main() {
    vec2 uv = vTextureCoord;
    
    // 微弱的背景流動感 [cite: 27, 28]
    vec2 M = vec2(0.5, 0.5); 
    float addend = (sin(10.0 * length(uv - M) - uTime * 2.0) * 0.5 + 0.5) * 0.05 - 0.2;
    
    // 1. 採樣我們準備好的紋理圖片
    vec4 texColor = texture2D(iChannel0, uv);
    vec3 bg = texColor.rgb;
    
    // 2. 將圖片與原版的 Palette 色彩進行微弱混合，營造展品的光影漸層 [cite: 29]
    bg = mix(bg, GetPaletteColor(0.05), S(1.0, 0.4, uv.y + addend + 1.1));
    
    // 輸出顏色 (稍微調暗以符合展覽氛圍) [cite: 30]
    gl_FragColor = vec4(bg * 0.8, 1.0); 
}
`;  