import { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import './index.css'

export default function App() {
  const pixiContainer = useRef(null)
  const appRef = useRef(null)
  const spawnWordRef = useRef(null)
  const [isReady, setIsReady] = useState(false)

  const words = ['焦慮', '壓力很大', '自責', '委屈', '孤單', '沒事', '不知道怎麼辦', '想念']

  useEffect(() => {
    let disposed = false
    let initialized = false

    const initPixi = async () => {
      if (!pixiContainer.current || appRef.current) return

      const app = new PIXI.Application()
      appRef.current = app

      await app.init({
        width: 400,
        height: 700,
        backgroundColor: 0xe8e4d9,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        antialias: true,
      })
      initialized = true

      if (disposed) {
        app.destroy(true, { children: true, texture: true, textureSource: true })
        appRef.current = null
        return
      }

      pixiContainer.current.appendChild(app.canvas)

      const uniqueChars = new Set(words.join('').split(''))
      const charTextures = {}

      uniqueChars.forEach((char) => {
        const textGraphic = new PIXI.Text({
          text: char,
          style: {
            fontFamily: '"PingFang TC", "STKaiti", "KaiTi", serif',
            fontSize: 34,
            fill: 0x1a1c20,
            fontWeight: 'bold',
          },
        })
        charTextures[char] = app.renderer.generateTexture(textGraphic)
        textGraphic.destroy()
      })

      const noiseGraphic = new PIXI.Graphics()
      noiseGraphic.rect(0, 0, 192, 192)
      noiseGraphic.fill({ color: 0x7a7a7a, alpha: 1 })

      for (let i = 0; i < 1100; i += 1) {
        const x = Math.random() * 192
        const y = Math.random() * 192
        const r = 0.6 + Math.random() * 1.7
        const a = 0.05 + Math.random() * 0.16
        noiseGraphic.circle(x, y, r)
        noiseGraphic.fill({ color: 0xffffff, alpha: a })
      }

      const noiseTexture = app.renderer.generateTexture(noiseGraphic)
      noiseGraphic.destroy()

      const waterSprite = new PIXI.TilingSprite({
        texture: noiseTexture,
        width: app.screen.width,
        height: app.screen.height,
      })
      app.stage.addChild(waterSprite)

      const displacementFilter = new PIXI.DisplacementFilter({ sprite: waterSprite })
      displacementFilter.scale.set(12)

      const inkContainer = new PIXI.Container()
      inkContainer.filters = [displacementFilter]
      app.stage.addChild(inkContainer)

      const drops = []
      const inkTrails = []
      const dropQueue = []
      let frameCounter = 0

      const spawnWordFlow = () => {
        const word = words[Math.floor(Math.random() * words.length)]
        const chars = word.split('')
        const isLeftEye = Math.random() > 0.5
        const eyeX = isLeftEye ? app.screen.width * 0.3 : app.screen.width * 0.7

        chars.forEach((char, index) => {
          dropQueue.push({
            char,
            x: eyeX + (Math.random() - 0.5) * 15,
            y: 40,
            triggerFrame: frameCounter + index * 25,
          })
        })
      }

      const spawnSingleChar = (char, startX, startY) => {
        const drop = new PIXI.Sprite(charTextures[char])
        drop.anchor.set(0.5)
        drop.x = startX
        drop.y = startY

        const blurFilter = new PIXI.BlurFilter({ strength: 0.5 })
        drop.filters = [blurFilter]
        inkContainer.addChild(drop)

        drops.push({
          sprite: drop,
          char,
          blur: blurFilter,
          vx: (Math.random() - 0.5) * 0.15,
          vy: Math.random() * 0.5 + 1.2,
          life: 0,
          lastTrailTime: 0,
        })
      }

      spawnWordRef.current = spawnWordFlow

      app.ticker.add((ticker) => {
        const delta = ticker.deltaTime
        frameCounter += delta

        for (let i = dropQueue.length - 1; i >= 0; i -= 1) {
          if (frameCounter >= dropQueue[i].triggerFrame) {
            const item = dropQueue[i]
            spawnSingleChar(item.char, item.x, item.y)
            dropQueue.splice(i, 1)
          }
        }

        waterSprite.tilePosition.y -= 1.0 * delta
        waterSprite.tilePosition.x -= 0.3 * delta

        for (let i = drops.length - 1; i >= 0; i -= 1) {
          const drop = drops[i]
          drop.life += delta
          drop.sprite.y += drop.vy * delta
          drop.sprite.x += drop.vx * delta + Math.sin(drop.life * 0.03) * 0.2

          const depthRatio = drop.sprite.y / app.screen.height
          drop.blur.strength = 0.5 + depthRatio * 2.5

          if (drop.life - drop.lastTrailTime > 15 - depthRatio * 10) {
            drop.lastTrailTime = drop.life

            const trail = new PIXI.Sprite(charTextures[drop.char])
            trail.anchor.set(0.5)
            trail.x = drop.sprite.x
            trail.y = drop.sprite.y
            trail.rotation = Math.random() * 0.2 - 0.1

            const trailBlur = new PIXI.BlurFilter({ strength: 1.5 + depthRatio * 4 })
            trail.filters = [trailBlur]
            inkContainer.addChildAt(trail, 0)

            inkTrails.push({
              sprite: trail,
              blurFilter: trailBlur,
              scaleSpeed: 0.005 + Math.random() * 0.008,
              alphaSpeed: 0.01 + Math.random() * 0.01,
              vy: drop.vy * 0.3,
            })
          }

          if (drop.sprite.y > app.screen.height + 80) {
            inkContainer.removeChild(drop.sprite)
            drop.sprite.destroy()
            drops.splice(i, 1)
          }
        }

        for (let i = inkTrails.length - 1; i >= 0; i -= 1) {
          const trail = inkTrails[i]
          trail.sprite.scale.x += trail.scaleSpeed * delta
          trail.sprite.scale.y += trail.scaleSpeed * delta
          trail.sprite.alpha -= trail.alphaSpeed * delta
          trail.blurFilter.strength += 0.15 * delta
          trail.sprite.y += trail.vy * delta

          if (trail.sprite.alpha <= 0) {
            inkContainer.removeChild(trail.sprite)
            trail.sprite.destroy()
            inkTrails.splice(i, 1)
          }
        }
      })

      setIsReady(true)
    }

    initPixi()

    return () => {
      disposed = true
      spawnWordRef.current = null
      if (appRef.current && initialized) {
        appRef.current.destroy(true, { children: true, texture: true, textureSource: true })
      }
      appRef.current = null
    }
  }, [])

  const startCrying = () => {
    if (!spawnWordRef.current) return
    let count = 0
    const interval = setInterval(() => {
      if (!spawnWordRef.current) {
        clearInterval(interval)
        return
      }
      spawnWordRef.current()
      count += 1
      if (count > 15) clearInterval(interval)
    }, 800)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#2A2B2E] p-4 font-sans text-[#E8E4D9]">
      <div className="mb-6 text-center">
        <h1 className="mb-2 text-2xl font-bold tracking-widest text-amber-100">情緒萃取：雙眼逐字落淚</h1>
        <p className="max-w-md text-sm text-gray-400">
          詞彙被拆解為單字，從虛擬的左眼或右眼接連滑落，形成兩道淚痕。
        </p>
      </div>

      <div
        ref={pixiContainer}
        className="relative overflow-hidden rounded-sm border border-[#1A1C20] shadow-2xl"
        style={{ width: '400px', height: '700px' }}
      >
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#E8E4D9] text-[#1A1C20]">
            研墨中...
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-4">
        <button
          onClick={() => spawnWordRef.current && spawnWordRef.current()}
          className="rounded-full border border-[#E8E4D9] bg-transparent px-6 py-3 font-medium transition-colors hover:bg-white/10"
        >
          流出一個詞彙
        </button>
        <button
          onClick={startCrying}
          className="rounded-full bg-amber-700 px-6 py-3 font-medium shadow-lg transition-colors hover:bg-amber-600"
        >
          模擬情緒崩潰 (10秒)
        </button>
      </div>
    </div>
  )
}

// 原版