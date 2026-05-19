#define asp iResolution.x/iResolution.y

mat2 rotate2d(float _angle){
    return mat2(cos(_angle),-sin(_angle),
                sin(_angle),cos(_angle));
}

float circle(vec2 uv,float radius,float blur){
    float d = length(uv);
    return smoothstep(radius,radius-blur,d);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // 1. 初始化畫布：完全透明（或黑色）
    fragColor = vec4(0.0);
    
    vec2 uv = fragCoord/iResolution.xy;
    
    // 為了讓粒子從上方掉落，保留原本的座標位移基準點
    vec2 particleUV = uv;
    particleUV -= vec2(0.5, 1.1); 
    
    // 2. 粒子系統參數
    float s = 0.0035; // 粒子密度，專案中若卡頓可改為 0.01
    vec3 coll = vec3(0.0);
    float t = iTime/4.0;
    float vl = 0.0;
    
    // 3. 粒子渲染迴圈
    for(float f = 0.0; f < 1.0; f += s){
        vec2 st = particleUV;
        
        // 隨機水平位置與掉落動畫
        st.x += fract((sin(f * 1245.0)) * 114.0) - 0.5;
        st.y += fract(t * sin(f + 0.1) + f * 2.0) * 1.2;
        
        // 粒子縮放與寬高比修正
        st *= mix(f, 0.9, 2.0);
        st.x *= asp; 
        
        // 旋轉
        float si = sign(sin(f * 175.0));
        st = rotate2d(si * iTime + sin(f * 175.0) * 1854.0) * st; 
        
        // 形狀扭曲：將圓形壓扁並做成尖底（橢圓/花瓣感）
        st.y *= 1.82;
        float r = 0.05;
        st.y -= abs(st.x / 3.0 + sin(iTime + fract(f)) * 0.01);
        
        // 繪製圓形並疊加亮度
        vl = max(circle(st, r, 0.027) + (circle(st, 0.12, 0.127) * 0.4), vl);
    }
    
    // 4. 設定粒子顏色 (粉紅色)
    coll = vl * vec3(1.0, 0.5, 0.7);
    
    // 最終輸出
    fragColor = vec4(coll, 1.0);
}