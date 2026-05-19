// src/engine/ripple/RippleFilter.js
export const rippleFragSource = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D iChannel0;  
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uRipples[200];    

void main() {
    vec2 normUV = vTextureCoord; // 0.0 ~ 1.0
    float aspect = uResolution.x / uResolution.y;
    
    // 【原版還原 1】：建立原版的 10.0 空間尺度，並校正長寬比避免橢圓
    vec2 scaledUV = normUV * vec2(aspect, 1.0) * 10.0;
    
    vec2 circles = vec2(0.0);
    
    // 遍歷所有掉落的字元
    for (int i = 0; i < 200; i++) {
        float t = uRipples[i].z; // t 為生命週期 0.0 ~ 1.0
        
        if (t > 0.0 && t < 1.0) {
            // 將水波中心點也轉換至相同的 10.0 空間
            vec2 center = uRipples[i].xy * vec2(aspect, 1.0) * 10.0;
            vec2 v = center - scaledUV;
            
            // 【原版還原 2】：原版的擴散半徑公式 (MAX_RADIUS = 2，所以是 3.0 * t)
            float d = length(v) - 3.0 * t; 
            
            float h = 1e-3;
            float d1 = d - h;
            float d2 = d + h;
            
            // 【原版還原 3】：原汁原味的頻率 (31) 與波浪封包 (smoothstep)
            float p1 = sin(31.0 * d1) * smoothstep(-0.6, -0.3, d1) * smoothstep(0.0, -0.3, d1);
            float p2 = sin(31.0 * d2) * smoothstep(-0.6, -0.3, d2) * smoothstep(0.0, -0.3, d2);
            
            // 【原版還原 4】：原版的二次方淡出 (1. - t) * (1. - t)
            circles += 0.5 * normalize(v) * ((p2 - p1) / (2.0 * h) * (1.0 - t) * (1.0 - t));
        }
    }
    
    // 計算 3D 法線
    vec3 n = vec3(circles, sqrt(max(0.0, 1.0 - dot(circles, circles))));
    
    // 【原版還原 5】：原版的折射偏移強度，這裡設定為 0.05 呈現通透感
    float intensity = 0.05; 
    vec2 offsetUV = normUV - intensity * n.xy;
    
    // 保持底圖比例，避免圖片被拉伸造成視覺錯覺
    vec2 bgUV = offsetUV;
    bgUV.y = (bgUV.y - 0.5) * (uResolution.y / uResolution.x) + 0.5;
    bgUV = clamp(bgUV, 0.0, 1.0);
    
    // 【原版還原 6】：移除多餘的漸層混色，只保留純粹的底圖採樣與高光
    vec3 color = texture2D(iChannel0, bgUV).rgb;
    
    // 原版高光公式
    color += 5.0 * pow(clamp(dot(n, normalize(vec3(1.0, 0.7, 0.5))), 0.0, 1.0), 6.0);
    
    gl_FragColor = vec4(color, 1.0);
}
`;