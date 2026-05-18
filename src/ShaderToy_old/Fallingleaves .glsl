#define S smoothstep

vec3 GetPaletteColor(float t)
{
    vec3 a = vec3(0.95, 0.51, 0.00);
    vec3 b = vec3(1.00, 0.22, 0.00);
    vec3 c = vec3(3.00, 2.70, 0.00);
    vec3 d = vec3(0.63, 0.00, 1.00);

    return a + b * cos(radians(360.0) * (c * t + d));
}

mat2 Rot(float a)
{
    float s=sin(a), c=cos(a);
    return mat2(c,-s,s,c);
}

vec3 Transform(vec3 p, float angle) {
    p.xz *= Rot(angle );
    p.xy *= Rot(angle * 1.7);

    return p;
}

float Leaf(vec2 p)
{
    float w = fwidth(p.y);

    float d = length(p - vec2(0.0, clamp(p.y, -0.3, 0.3)));

    float r = mix(0.07, .001, S(0.0, 0.3, abs(p.y - 0.03)));

    float m = S(w, -w, d-r);
    
    float side = sign(p.x);

    float x = 0.9 * abs(p.x) / r;
    
    float wave = (1.-x)*sqrt(x) + x*(1.-sqrt(1.-x));

    float y = (p.y - wave * 0.2) * 20.0 + side * 243.75;

    float id = floor(y + 20.0);

    float n = fract(sin(id*564.32)*763.);
    
    float shade = mix(0.4, 0.9, n);
    
    d = length(p - vec2(0.0, clamp(p.y, -0.3, 0.2)));
    
    float strand = S(.0, .1, abs( fract(y) - 0.5 ) - 0.4);

    strand *= S(w, -w, x - 0.9);
    strand *= S(-w, w, x - 0.02);
    strand *= S(w, -w, abs(p.y) - 0.3);

    float stem = S(w, -w, d + (p.y-0.3) * 0.01);
    
    return max(m * shade, max(stem, strand));
}

float ScrewLeaf(vec2 p, float angle)
{
    p -= vec2(0,-.45);
    float d = length(p);
    p *= Rot(sin(angle) * 0.5 * d);

    p += vec2(0,-.45);

    return Leaf(p);
}

vec4 LeafBall(vec3 ro, vec3 rd, vec3 pos, vec3 color, float angle)
{   
    vec4 col = vec4(0);
    
    float t = dot(pos-ro, rd);
    vec3 p = ro + rd * t;
    float y = length(pos-p);
    
    if (y < 1.0)
    {
        float x = sqrt(1.-y*y);
        vec3 pF = ro + rd * (t-x) - pos;
        float n = pF.y*.5+.5;
        
        pF = Transform(pF, angle);
        vec2 uvF = vec2(atan(pF.x, pF.z), pF.y); // -pi<>pi, -1<>1
        uvF *= vec2(.25,.5);
        float f = Leaf(uvF);
        
        vec4 front = vec4(f * color, S(0., .6, f));
        
        vec3 pB = ro + rd * (t+x) - pos;
        n = pB.y*.5+.5;
        pB = Transform(pB, angle);
        vec2 uvB = vec2(atan(pB.x, pB.z), pB.y); // -pi<>pi, -1<>1
        uvB *= vec2(.25, .5);
        float b = Leaf(uvB);
        vec4 back = vec4(b * color * 0.7, S(0., .6, b));
        
        col = mix(back, front, front.a);
    }
    
    return col;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    vec2 M  = (iMouse.xy - 0.5 * iResolution.xy) / iResolution.y;

    float addend = (sin(10.0 * length(uv - M) - iTime * 2.0) * 0.5 + 0.5) * 0.05 - 0.2;

    vec3 bg = vec3(0.7, 0.8, 0.87);
    bg      = mix(bg, GetPaletteColor(0.05), S(1.0, 0.4, uv.y + addend + 1.1));
    
    vec4 col = vec4(bg * 0.8, 0.0);
    
    vec3 ro = vec3(0.0, 0.0, -3.0);
    vec3 rd = normalize(vec3(uv, 1.0));

    for (float i = 0.0; i < 1.0; i += 1.0 / 60.0)
    {
        vec3 color = GetPaletteColor(1.0 -i);

        float n = fract(sin(i*564.3)*4570.3);
        float z = mix(10., 0., i);
        float x = mix(-12., 12., n) + M.x;
        float y = mix(10.0, -10.0, fract(fract(n * 10.) + iTime * 0.20 * log(1.0 + z) )) + M.y;
        
        
        float a = iTime * z * 0.5  + i * 53.34;
        
        vec4 leaf = LeafBall(ro, rd, vec3(x, y, z), color, a);
        
        leaf.rgb = mix(bg, leaf.rgb, mix(.3, 1., i));
        //leaf.rgb = sqrt(leaf.rgb);
        
        col = mix(col, leaf, leaf.a);
    }
    
    fragColor = col;
}