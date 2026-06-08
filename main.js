import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

// ─── DOM refs ───
const loadBar = document.getElementById('loading-bar')
const loadPct = document.getElementById('loading-pct')
const loadEl = document.getElementById('loading')
const loadTip = document.getElementById('loading-tip')
const notif = document.getElementById('notif')
const plLabel = document.getElementById('planet-label')
const plName = plLabel.querySelector('.name')
const plDesc = plLabel.querySelector('.desc')
const plDist = document.getElementById('pl-dist')
const plDiam = document.getElementById('pl-diam')
const plYear = document.getElementById('pl-year')

const tips = [
  'Drag to orbit · Scroll to zoom',
  'Press 1-8 to focus a planet',
  'Press SPACE to toggle auto-rotate',
  'Press O for orbit lines',
  'Press L for planet labels',
  'Press R to reset camera view',
  'Hover over a planet for details',
]

// ─── Loading simulation ───
let loadProgress = 0
function advanceLoad() {
  loadProgress = Math.min(loadProgress + 2 + Math.random() * 6, 100)
  loadBar.style.width = loadProgress + '%'
  loadPct.textContent = Math.round(loadProgress) + '%'
  if (loadProgress > 30 && !loadTip.classList.contains('show')) {
    loadTip.textContent = tips[Math.floor(Math.random() * tips.length)]
    loadTip.classList.add('show')
  }
  if (loadProgress < 100) setTimeout(advanceLoad, 40 + Math.random() * 60)
}
advanceLoad()

// ─── Noise helpers for procedural textures ───
function hash(x, y) {
  let h = x * 374761393 + y * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  return (h ^ (h >> 16)) & 0x7fffffff
}

function lerp(a, b, t) { return a + (b - a) * t }

function smoothstep(t) { return t * t * (3 - 2 * t) }

function noise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const sx = smoothstep(fx), sy = smoothstep(fy)
  const n00 = hash(ix, iy) / 0x7fffffff
  const n10 = hash(ix + 1, iy) / 0x7fffffff
  const n01 = hash(ix, iy + 1) / 0x7fffffff
  const n11 = hash(ix + 1, iy + 1) / 0x7fffffff
  return lerp(lerp(n00, n10, sx), lerp(n01, n11, sx), sy)
}

function fbm(x, y, octaves = 5) {
  let val = 0, amp = 0.5, freq = 1
  for (let i = 0; i < octaves; i++) {
    val += amp * noise2D(x * freq, y * freq)
    amp *= 0.5; freq *= 2
  }
  return val
}

function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)) }

// ─── Procedural planet texture generator ───
function createPlanetTexture(config) {
  const w = 1024, h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(w, h)
  const data = img.data

  const seed = config.seed || 0.5

  for (let y = 0; y < h; y++) {
    const lat = (y / h - 0.5) * Math.PI
    const polar = Math.abs(lat) > 1.1
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h
      const n = fbm(u * config.scale + seed, v * config.scale + seed * 1.3, config.octaves || 5)
      const polarFactor = 1 - Math.abs(y / h - 0.5) * 2

      let r, g, b

      if (config.type === 'terrestrial') {
        const adjusted = n * 0.7 + polarFactor * 0.3
        if (adjusted < 0.35) {
          const t = adjusted / 0.35
          r = lerp(0.1, 0.15, t); g = lerp(0.15, 0.35, t); b = lerp(0.35, 0.55, t)
        } else if (adjusted < 0.55) {
          const t = (adjusted - 0.35) / 0.2
          r = lerp(0.15, 0.5, t); g = lerp(0.35, 0.55, t); b = lerp(0.55, 0.2, t)
        } else if (adjusted < 0.7) {
          const t = (adjusted - 0.55) / 0.15
          r = lerp(0.5, 0.3, t); g = lerp(0.55, 0.4, t); b = lerp(0.2, 0.1, t)
        } else {
          const t = (adjusted - 0.7) / 0.3
          r = lerp(0.3, 0.5, t); g = lerp(0.4, 0.45, t); b = lerp(0.1, 0.15, t)
        }
        if (polar && polarFactor > 0.7) {
          const snow = (polarFactor - 0.7) / 0.3
          r = lerp(r, 0.85, snow); g = lerp(g, 0.85, snow); b = lerp(b, 0.9, snow)
        }
      } else if (config.type === 'gas') {
        const band = Math.sin(y * config.bands * 0.15 + n * 2) * 0.5 + 0.5
        const colors = config.colors || [[0.8,0.6,0.3], [0.6,0.4,0.2], [0.5,0.35,0.15]]
        const ci = Math.floor(band * (colors.length - 1))
        const cf = band * (colors.length - 1) - ci
        const c1 = colors[Math.min(ci, colors.length - 1)]
        const c2 = colors[Math.min(ci + 1, colors.length - 1)]
        r = lerp(c1[0], c2[0], cf) * (0.85 + n * 0.15)
        g = lerp(c1[1], c2[1], cf) * (0.85 + n * 0.15)
        b = lerp(c1[2], c2[2], cf) * (0.85 + n * 0.15)
      } else if (config.type === 'ice') {
        const perturb = n * 0.15
        r = 0.6 + perturb; g = 0.7 + perturb; b = 0.9 + perturb
      } else if (config.type === 'volcanic') {
        const t = n * 0.5 + 0.25
        r = lerp(0.4, 0.8, t); g = lerp(0.2, 0.4, t); b = lerp(0.05, 0.1, t)
        const spot = fbm(u * 6 + 2, v * 6 + 3, 3)
        if (spot > 0.6) { r = 1; g = 0.3 + spot * 0.2; b = 0.05 }
      } else {
        r = g = b = n * 0.5 + 0.3
      }

      const idx = (y * w + x) * 4
      data[idx] = clamp(r * 255, 0, 255)
      data[idx + 1] = clamp(g * 255, 0, 255)
      data[idx + 2] = clamp(b * 255, 0, 255)
      data[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1, 1)
  return tex
}

// ─── Planet configs with procedural texture params ───
const PLANET_DATA = [
  { name:'Mercury', desc:'Smallest planet, closest to the Sun. Surface: 600°C swing.',
    size:0.85, dist:13, speed:0.82, tilt:0.03,
    tex:{ type:'volcanic', scale:4, octaves:4, seed:0.1 },
    info:{ dist:'57.9M km', diam:'4,879 km', year:'88 days' } },
  { name:'Venus', desc:'Hottest planet at 465°C. Dense CO₂ atmosphere with sulfuric acid clouds.',
    size:1.25, dist:20, speed:0.52, tilt:2.64,
    tex:{ type:'gas', scale:2, bands:8, seed:0.3,
          colors:[[0.9,0.7,0.3],[0.7,0.5,0.2],[0.6,0.4,0.15]] },
    info:{ dist:'108M km', diam:'12,104 km', year:'225 days' } },
  { name:'Earth', desc:'The only known harbour of life in the cosmos. 71% water, one moon.',
    size:1.35, dist:28, speed:0.41, tilt:0.41,
    tex:{ type:'terrestrial', scale:3, octaves:6, seed:0.7 },
    info:{ dist:'149.6M km', diam:'12,756 km', year:'365.25 days' } },
  { name:'Mars', desc:'The Red Planet. Olympus Mons — tallest volcano in the solar system.',
    size:1.05, dist:36, speed:0.31, tilt:0.44,
    tex:{ type:'terrestrial', scale:3.5, octaves:5, seed:0.2 },
    info:{ dist:'227.9M km', diam:'6,792 km', year:'687 days' } },
  { name:'Jupiter', desc:'Largest planet — more mass than all others combined. 95 known moons.',
    size:3.2, dist:52, speed:0.16, tilt:0.05,
    tex:{ type:'gas', scale:1.5, bands:14, seed:0.5,
          colors:[[0.9,0.7,0.4],[0.8,0.5,0.25],[0.6,0.4,0.2],[0.7,0.5,0.3]] },
    info:{ dist:'778.5M km', diam:'142,984 km', year:'11.86 years' } },
  { name:'Saturn', desc:'Lord of the rings. Ring system spans 282,000 km — visible with binoculars.',
    size:2.7, dist:68, speed:0.11, tilt:0.47,
    tex:{ type:'gas', scale:1.3, bands:12, seed:0.8,
          colors:[[0.9,0.8,0.5],[0.8,0.7,0.4],[0.7,0.6,0.35]] },
    info:{ dist:'1.43B km', diam:'120,536 km', year:'29.46 years' },
    rings: true },
  { name:'Uranus', desc:'Ice giant rotating on its side. Tilted 98° from its orbital plane.',
    size:2.0, dist:84, speed:0.075, tilt:1.71,
    tex:{ type:'ice', scale:2, octaves:3, seed:0.4 },
    info:{ dist:'2.87B km', diam:'51,118 km', year:'84 years' } },
  { name:'Neptune', desc:'Windiest world — supersonic storms at 2,000 km/h in eternal darkness.',
    size:1.9, dist:100, speed:0.05, tilt:0.49,
    tex:{ type:'ice', scale:2.5, octaves:4, seed:0.9 },
    info:{ dist:'4.50B km', diam:'49,528 km', year:'165 years' } },
]

// ─── Custom cursor ───
const cursor = document.getElementById('cursor')
const cursorRing = document.getElementById('cursor-ring')
let mx = -200, my = -200, rx = -200, ry = -200
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY })
;(function animCursor() {
  requestAnimationFrame(animCursor)
  rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12
  cursor.style.left = mx + 'px'; cursor.style.top = my + 'px'
  cursorRing.style.left = rx + 'px'; cursorRing.style.top = ry + 'px'
})()

// ─── Notification helper ───
let notifTimeout
function showNotif(msg) {
  notif.textContent = msg
  notif.classList.add('show')
  clearTimeout(notifTimeout)
  notifTimeout = setTimeout(() => notif.classList.remove('show'), 2200)
}

// ─── Scene ───
const scene = new THREE.Scene()
scene.fog = new THREE.FogExp2(0x04040a, 0.0001)

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 8000)
camera.position.set(90, 55, 130)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
document.body.prepend(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.05
controls.minDistance = 3
controls.maxDistance = 500
controls.autoRotate = true
controls.autoRotateSpeed = 0.2

// ─── Camera transition target ───
let cameraTarget = null
let cameraLerpSpeed = 0.04

// ─── Post-processing ───
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight), 0.6, 0.2, 0.05
)
composer.addPass(bloom)
composer.addPass(new OutputPass())

// ─── Stars with custom shader ───
function createStarField(count, rMin, rMax) {
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const phases = new Float32Array(count)
  const speeds = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const r = rMin + Math.random() * (rMax - rMin)
    const t = Math.random() * Math.PI * 2
    const p = Math.acos(2 * Math.random() - 1)
    pos[i*3]   = r * Math.sin(p) * Math.cos(t)
    pos[i*3+1] = r * Math.sin(p) * Math.sin(t)
    pos[i*3+2] = r * Math.cos(p)

    const h = Math.random()
    const c = new THREE.Color()
    if (h < 0.06)      c.setHSL(0.62, 0.9, 0.85)
    else if (h < 0.12) c.setHSL(0.08, 0.9, 0.9)
    else if (h < 0.18) c.setHSL(0.0, 0.0, 1.0)
    else               c.setHSL(0, 0, 0.6 + Math.random() * 0.4)
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b
    sizes[i] = 0.4 + Math.random() * 2.5
    phases[i] = Math.random() * Math.PI * 2
    speeds[i] = 0.3 + Math.random() * 0.7
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
      attribute float aSize;
      attribute vec3 aColor;
      attribute float aPhase;
      attribute float aSpeed;
      varying vec3 vColor;
      uniform float uTime;

      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (180.0 / -mvPos.z);
        gl_PointSize *= 0.85 + 0.15 * sin(uTime * aSpeed + aPhase);
        gl_Position = projectionMatrix * mvPos;
        vColor = aColor;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        float alpha = 1.0 - smoothstep(0.0, 0.5, d);
        alpha *= alpha;
        gl_FragColor = vec4(vColor, alpha * 0.92);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })

  return { points: new THREE.Points(geo, mat), mat }
}
const starField = createStarField(16000, 200, 3000)
scene.add(starField.points)

// ─── Nebula haze ───
{
  const geo = new THREE.BufferGeometry()
  const n = 8000
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const r = 30 + Math.random() * 200
    const a = Math.random() * Math.PI * 2
    const sp = (Math.random() - 0.5) * 8 * (r / 60)
    pos[i*3]   = Math.cos(a) * r + sp * Math.sin(a)
    pos[i*3+1] = (Math.random() - 0.5) * 6
    pos[i*3+2] = Math.sin(a) * r - sp * Math.cos(a)
    const h = 0.68 + Math.random() * 0.15
    const c = new THREE.Color().setHSL(h, 0.4, 0.06 + Math.random() * 0.1)
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const mat = new THREE.PointsMaterial({
    size: 6, vertexColors: true, transparent: true, opacity: 0.18,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
  })
  scene.add(new THREE.Points(geo, mat))
}

// ─── Sun with glow ───
const sunGroup = new THREE.Group()
scene.add(sunGroup)

const sunGeo = new THREE.SphereGeometry(6.5, 64, 64)
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd060 })
const sun = new THREE.Mesh(sunGeo, sunMat)
sunGroup.add(sun)

// Corona layers (animated)
const coronaLayers = []
const coronaConfig = [
  { r: 8.5, c: 0xff9933, o: 0.18, phase: 0 },
  { r: 12, c: 0xff6611, o: 0.08, phase: 1.2 },
  { r: 18, c: 0xff3300, o: 0.03, phase: 2.5 },
  { r: 25, c: 0xcc2200, o: 0.01, phase: 4.1 },
]
coronaConfig.forEach(({ r, c, o, phase }) => {
  const geo = new THREE.SphereGeometry(r, 32, 32)
  const mat = new THREE.MeshBasicMaterial({
    color: c, transparent: true, opacity: o,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.userData = { baseOpacity: o, phase, speed: 0.3 + Math.random() * 0.4 }
  sunGroup.add(mesh)
  coronaLayers.push(mesh)
})

// Sun glow sprite
function makeGlowTexture() {
  const c = document.createElement('canvas')
  c.width = 256; c.height = 256
  const ctx = c.getContext('2d')
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
  grad.addColorStop(0, 'rgba(255,200,80,1)')
  grad.addColorStop(0.1, 'rgba(255,160,40,0.8)')
  grad.addColorStop(0.3, 'rgba(255,100,20,0.3)')
  grad.addColorStop(0.6, 'rgba(200,50,0,0.08)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 256, 256)
  return new THREE.CanvasTexture(c)
}
const glowSprite = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: makeGlowTexture(),
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.8,
  })
)
glowSprite.scale.set(60, 60, 1)
sunGroup.add(glowSprite)

const sunLight = new THREE.PointLight(0xffd060, 2.5, 800)
sunGroup.add(sunLight)
scene.add(new THREE.AmbientLight(0x1a1a2e, 0.5))

// ─── Asteroid belt ───
function createAsteroidBelt() {
  const n = 4000
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(n * 3)
  const sizes = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const r = 40 + Math.random() * 12
    const a = Math.random() * Math.PI * 2
    const yOff = (Math.random() - 0.5) * 2.5
    pos[i*3]   = Math.cos(a) * r
    pos[i*3+1] = yOff
    pos[i*3+2] = Math.sin(a) * r
    sizes[i] = 0.3 + Math.random() * 0.8
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  const mat = new THREE.PointsMaterial({
    color: 0x887766,
    size: 0.6,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  })
  return new THREE.Points(geo, mat)
}
scene.add(createAsteroidBelt())

// ─── Floating dust particles ───
function createDust() {
  const n = 3000
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const r = 5 + Math.random() * 120
    const a = Math.random() * Math.PI * 2
    pos[i*3]   = Math.cos(a) * r * (0.5 + Math.random() * 0.5)
    pos[i*3+1] = (Math.random() - 0.5) * 20
    pos[i*3+2] = Math.sin(a) * r * (0.5 + Math.random() * 0.5)
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x8899aa,
    size: 0.15,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  }))
}
scene.add(createDust())

// ─── Planets ───
const planets = []
const orbitMeshes = []
const labelSprites = []
let orbitsVisible = false
let labelsVisible = false
const planetMeshes = []

PLANET_DATA.forEach((data, idx) => {
  // Orbit ring
  const pts = []
  for (let i = 0; i <= 192; i++) {
    const a = (i / 192) * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * data.dist, 0, Math.sin(a) * data.dist))
  }
  const orbitLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({
      color: 0xc9a84c, transparent: true, opacity: 0.15
    })
  )
  scene.add(orbitLine)
  orbitMeshes.push(orbitLine)

  // Planet
  const tex = createPlanetTexture(data.tex)
  const geo = new THREE.SphereGeometry(data.size, 48, 48)
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.6,
    metalness: 0.1,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.z = data.tilt
  mesh.userData.planetIndex = idx
  scene.add(mesh)
  planetMeshes.push(mesh)

  // Saturn rings
  if (data.rings) {
    const rInner = data.size * 1.35
    const rOuter = data.size * 2.6
    const rGeo = new THREE.RingGeometry(rInner, rOuter, 80)
    const rMat = new THREE.MeshBasicMaterial({
      color: 0xd4bc88, side: THREE.DoubleSide,
      transparent: true, opacity: 0.5
    })
    const ring = new THREE.Mesh(rGeo, rMat)
    ring.rotation.x = Math.PI / 2.6

    const rGeo2 = new THREE.RingGeometry(rInner * 1.5, rInner * 1.7, 80)
    const rMat2 = new THREE.MeshBasicMaterial({
      color: 0x332211, side: THREE.DoubleSide,
      transparent: true, opacity: 0.5
    })
    const gap = new THREE.Mesh(rGeo2, rMat2)
    gap.rotation.x = Math.PI / 2.6

    const ringGroup = new THREE.Group()
    ringGroup.add(ring)
    ringGroup.add(gap)
    mesh.add(ringGroup)
  }

  // 3D Label sprite
  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 256; labelCanvas.height = 64
  const lctx = labelCanvas.getContext('2d')
  lctx.fillStyle = 'rgba(0,0,0,0)'
  lctx.fillRect(0, 0, 256, 64)
  lctx.font = '28px Cinzel, serif'
  lctx.textAlign = 'center'
  lctx.textBaseline = 'middle'
  lctx.fillStyle = 'rgba(201,168,76,0.8)'
  lctx.fillText(data.name.toUpperCase(), 128, 34)

  const labelTex = new THREE.CanvasTexture(labelCanvas)
  const labelMat = new THREE.SpriteMaterial({
    map: labelTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const label = new THREE.Sprite(labelMat)
  label.scale.set(data.dist * 0.15, data.dist * 0.04, 1)
  label.position.y = data.size + 2
  mesh.add(label)
  labelSprites.push(label)

  planets.push({
    mesh, dist: data.dist, speed: data.speed,
    angle: Math.random() * Math.PI * 2,
    name: data.name, desc: data.desc,
    info: data.info,
    index: idx,
  })
})

// ─── Raycaster ───
const raycaster = new THREE.Raycaster()
const mouse2d = new THREE.Vector2()
let hoveredPlanet = null

document.addEventListener('mousemove', e => {
  mouse2d.x = (e.clientX / innerWidth) * 2 - 1
  mouse2d.y = -(e.clientY / innerHeight) * 2 + 1
})

// ─── Camera focus on planet ───
let cameraFocusTarget = null
let cameraFocusMesh = null

function focusPlanet(index) {
  const p = planets[index]
  if (!p) return
  cameraFocusTarget = p.mesh.position.clone()
  cameraFocusTarget.y += p.mesh.geometry.parameters.radius * 1.5
  cameraFocusMesh = p.mesh
  const d = p.dist * 1.8
  camera.position.set(
    cameraFocusTarget.x + d * 0.6,
    cameraFocusTarget.y + d * 0.4,
    cameraFocusTarget.z + d * 0.7
  )
  controls.target.copy(cameraFocusTarget)
  controls.autoRotate = false
  document.getElementById('btn-rotate').classList.remove('active')
  showNotif(`Focused on ${p.name}`)
}

// ─── Controls ───
document.getElementById('btn-orbits').addEventListener('click', toggleOrbits)
document.getElementById('btn-rotate').addEventListener('click', toggleAutoRotate)
document.getElementById('btn-labels').addEventListener('click', toggleLabels)
document.getElementById('btn-reset').addEventListener('click', resetView)

function toggleOrbits() {
  orbitsVisible = !orbitsVisible
  document.getElementById('btn-orbits').classList.toggle('active', orbitsVisible)
  orbitMeshes.forEach(l => {
    l.material.opacity = orbitsVisible ? 0.35 : 0.15
  })
  showNotif(orbitsVisible ? 'Orbit lines ON' : 'Orbit lines OFF')
}

function toggleAutoRotate() {
  controls.autoRotate = !controls.autoRotate
  document.getElementById('btn-rotate').classList.toggle('active', controls.autoRotate)
  showNotif(controls.autoRotate ? 'Auto-rotate ON' : 'Auto-rotate OFF')
}

function toggleLabels() {
  labelsVisible = !labelsVisible
  document.getElementById('btn-labels').classList.toggle('active', labelsVisible)
  labelSprites.forEach(s => { s.material.opacity = labelsVisible ? 1 : 0 })
  showNotif(labelsVisible ? 'Labels ON' : 'Labels OFF')
}

function resetView() {
  cameraFocusTarget = null
  cameraFocusMesh = null
  camera.position.set(90, 55, 130)
  controls.target.set(0, 0, 0)
  controls.autoRotate = true
  document.getElementById('btn-rotate').classList.add('active')
  showNotif('View reset')
}

// ─── Keyboard shortcuts ───
document.addEventListener('keydown', e => {
  if (e.key === ' ') {
    e.preventDefault()
    toggleAutoRotate()
  } else if (e.key === 'o' || e.key === 'O') {
    toggleOrbits()
  } else if (e.key === 'l' || e.key === 'L') {
    toggleLabels()
  } else if (e.key === 'r' || e.key === 'R') {
    resetView()
  } else {
    const num = parseInt(e.key)
    if (num >= 1 && num <= 8) {
      focusPlanet(num - 1)
    }
  }
})

// ─── Loading complete ───
function finishLoading() {
  loadProgress = 100
  loadBar.style.width = '100%'
  loadPct.textContent = '100%'
  setTimeout(() => loadEl.classList.add('hidden'), 400)
  setTimeout(() => loadEl.style.display = 'none', 1200)
  showNotif('COSMOS loaded — drag to explore')
}
setTimeout(finishLoading, 2000 + Math.random() * 1000)

// ─── Animation ───
const clock = new THREE.Clock()
let animTime = 0

function animate() {
  requestAnimationFrame(animate)
  const dt = clock.getDelta()
  animTime += dt

  // Update star shader
  starField.mat.uniforms.uTime.value = animTime

  // Sun rotation + corona animation
  sun.rotation.y += 0.0015
  glowSprite.material.rotation += 0.0005
  coronaLayers.forEach((layer, i) => {
    const d = layer.userData
    const pulse = 1 + 0.06 * Math.sin(animTime * d.speed + d.phase)
    layer.scale.setScalar(pulse)
    const flicker = d.baseOpacity * (0.85 + 0.15 * Math.sin(animTime * d.speed * 1.3 + d.phase))
    layer.material.opacity = flicker
  })

  // Planets orbit
  planets.forEach(p => {
    p.angle += dt * 0.15 * p.speed
    p.mesh.position.set(
      Math.cos(p.angle) * p.dist,
      0,
      Math.sin(p.angle) * p.dist
    )
    p.mesh.rotation.y += dt * 0.3
  })

  // Hover detection
  raycaster.setFromCamera(mouse2d, camera)
  const hits = raycaster.intersectObjects(planetMeshes)
  if (hits.length > 0) {
    const hitIdx = hits[0].object.userData.planetIndex
    const hit = planets[hitIdx]
    if (hit && hit !== hoveredPlanet) {
      hoveredPlanet = hit
      plName.textContent = hit.name.toUpperCase()
      plDesc.textContent = hit.desc
      plDist.textContent = hit.info.dist
      plDiam.textContent = hit.info.diam
      plYear.textContent = hit.info.year
      plLabel.classList.add('visible')
      cursor.style.width = '14px'
      cursor.style.height = '14px'
      cursorRing.style.width = '50px'
      cursorRing.style.height = '50px'
    }
  } else {
    if (hoveredPlanet) {
      hoveredPlanet = null
      plLabel.classList.remove('visible')
      cursor.style.width = '8px'
      cursor.style.height = '8px'
      cursorRing.style.width = '32px'
      cursorRing.style.height = '32px'
    }
  }

  controls.update()
  composer.render()
}
animate()

// ─── Resize ───
window.addEventListener('resize', () => {
  const w = innerWidth, h = innerHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  composer.setSize(w, h)
})
