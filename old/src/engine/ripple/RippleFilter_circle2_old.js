// src/engine/ripple/RippleFilter.js
export const rippleFragSource = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D iChannel0;  
uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uRipples[200];    

#define S smoothstep

vec3 GetPaletteColor(float t) {
    vec3 a = vec3(0.95, 0.51, 0.00);
    vec3 b = vec3(1.00, 0.22, 0.00);
    vec3 c = vec3(3.00, 2.70, 0.00);
    vec3 d = vec3(0.63, 0.00, 1.00);
    return a + b * cos(6.28318 * (c * t + d));
}

void main() {
    vec2 uv = vTextureCoord;
    float aspect = uResolution.x / uResolution.y;
    
    vec2 circles = vec2(0.0);
    
    // ----- 波形計算：完全保留 Ripple1.js 的原始算法（多圈、細緻） -----
    for (int i = 0; i < 200; i++) {
        float life = uRipples[i].z;
        if (life > 0.0 && life < 1.0) {
            vec2 center = uRipples[i].xy;
            
            vec2 v = (center - uv);
            v.x *= aspect; 
            
            v *= 35.0; 
            
            float t = life;
            float d = length(v) - 6.0 * t; 
            
            float h = 1e-3;
            float d1 = d - h;
            float d2 = d + h;
            
            float p1 = sin(40. * d1) * S(-0.6, -0.3, d1) * S(0., -0.3, d1);
            float p2 = sin(40. * d2) * S(-0.6, -0.3, d2) * S(0., -0.3, d2);
            
            circles += 0.5 * normalize(v) * ((p2 - p1) / (2. * h) * (1. - t) * (1. - t));
        }
    }
    
    vec3 n = vec3(circles, sqrt(max(0.0, 1. - dot(circles, circles))));
    
    float intensity = 0.03; 
    
    // ========== 修正點 1：對折射偏移進行長寬比補償 ==========
    vec2 offsetUV = uv;
    offsetUV.x -= (intensity * n.x) / aspect;   // X 方向除以 aspect
    offsetUV.y -= intensity * n.y;              // Y 方向不變
    offsetUV = clamp(offsetUV, 0.0, 1.0);
    
    vec3 bg = texture2D(iChannel0, offsetUV).rgb;
    
    // ========== 修正點 2：背景光影距離計算也加入長寬比校正，保持光暈正圓 ==========
    vec2 M = vec2(0.5, 0.5); 
    vec2 mDist = offsetUV - M;
    mDist.x *= aspect;   // 還原為等比例距離
    float addend = (sin(10.0 * length(mDist) - uTime * 2.0) * 0.5 + 0.5) * 0.05 - 0.2;
    
    bg = mix(bg, GetPaletteColor(0.05), S(1.0, 0.4, offsetUV.y + addend + 1.1));
    
    float spec = 5.0 * pow(clamp(dot(n, normalize(vec3(1., 0.7, 0.5))), 0., 1.), 6.0);
    
    gl_FragColor = vec4(bg * 0.8 + spec * 0.3, 1.0);
}
`;