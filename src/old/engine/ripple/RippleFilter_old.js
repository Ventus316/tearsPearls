// src/engine/ripple/RippleFilter.js
export const rippleFragSource = `
precision mediump float;
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform sampler2D iChannel0;  
uniform vec2 uResolution;
uniform float uTime;
// 【修改點 1】：將陣列上限提升到 200
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
    
    // 【修改點 2】：迴圈上限提升到 30
    for (int i = 0; i < 200; i++) {
        float life = uRipples[i].z;
        if (life > 0.0 && life < 1.0) {
            vec2 center = uRipples[i].xy;
            
            vec2 v = (center - uv);
            v.x *= aspect; 
            
            // 【修改點 3】：空間切分更細 (從 20 變 35)，讓波紋物理上變小、變精緻
            v *= 35.0; 
            
            float t = life;
            // 【修改點 4】：對應細化的空間，調整擴散速度
            float d = length(v) - 6.0 * t; 
            
            float h = 1e-3;
            float d1 = d - h;
            float d2 = d + h;
            
            // 【修改點 5】：提升頻率 (從 31 變 40)，讓波浪圈數變多且更細
            float p1 = sin(40. * d1) * S(-0.6, -0.3, d1) * S(0., -0.3, d1);
            float p2 = sin(40. * d2) * S(-0.6, -0.3, d2) * S(0., -0.3, d2);
            
            circles += 0.5 * normalize(v) * ((p2 - p1) / (2. * h) * (1. - t) * (1. - t));
        }
    }
    
    vec3 n = vec3(circles, sqrt(max(0.0, 1. - dot(circles, circles))));
    
    // 折射強度稍微調低，配合細緻的波紋
    float intensity = 0.03; 
    vec2 offsetUV = clamp(uv - intensity * n.xy, 0.0, 1.0);
    
    vec3 bg = texture2D(iChannel0, offsetUV).rgb;
    
    vec2 M = vec2(0.5, 0.5); 
    float addend = (sin(10.0 * length(offsetUV - M) - uTime * 2.0) * 0.5 + 0.5) * 0.05 - 0.2;
    bg = mix(bg, GetPaletteColor(0.05), S(1.0, 0.4, offsetUV.y + addend + 1.1));
    
    float spec = 5.0 * pow(clamp(dot(n, normalize(vec3(1., 0.7, 0.5))), 0., 1.), 6.0);
    
    gl_FragColor = vec4(bg * 0.8 + spec * 0.3, 1.0);
}
`;