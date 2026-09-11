import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const MODEL_URL = '/models/car-podio.glb'
// Único material de la carrocería en el modelo (ver materiales del glb):
// vidrios, ruedas, franja y faros usan otros materiales y no se tocan.
const BODY_MATERIAL_NAME = 'base.045'

let gltfPromise = null
function loadCarGLTF() {
  if (!gltfPromise) gltfPromise = new GLTFLoader().loadAsync(MODEL_URL)
  return gltfPromise
}

// object.clone(true) clona la jerarquía de nodos pero comparte los
// materiales por referencia — sin esto, recolorear un auto recolorearía los
// tres (mismo material compartido entre las 3 instancias clonadas).
function cloneWithOwnMaterials(object) {
  const clone = object.clone(true)
  clone.traverse(node => {
    if (node.isMesh) {
      node.material = Array.isArray(node.material)
        ? node.material.map(m => m.clone())
        : node.material.clone()
    }
  })
  return clone
}

export default function Car3D({ color, height = 160 }) {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    let frameId = null
    let car = null
    let rig = null

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
    // Ángulo de la cámara (dirección unitaria desde el auto hacia la cámara);
    // la distancia real se recalcula en fitCamera() según el tamaño del auto.
    const camDir = new THREE.Vector3(1.1, 0.62, 1.25).normalize()

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    scene.add(new THREE.HemisphereLight(0xffffff, 0x141a1e, 1.2))
    const key = new THREE.DirectionalLight(0xffffff, 2.4)
    key.position.set(4, 6, 5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x00ffd6, 0.7)
    rim.position.set(-5, 2.5, -4)
    scene.add(rim)

    let sphereRadius = 1
    let lookAtY = 0
    // Coloca la cámara a la distancia justa para que la esfera envolvente
    // del auto llene el encuadre, tomando en cuenta tanto el FOV vertical
    // como el horizontal (según el aspect del contenedor) — así el auto no
    // se ve "chiquito" en canvases anchos y cortos como los de este podio.
    function fitCamera() {
      const w = container.clientWidth || 1
      const h = container.clientHeight || 1
      renderer.setSize(w, h, false)
      const aspect = w / h
      camera.aspect = aspect

      const vFov = (camera.fov * Math.PI) / 180
      const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
      const distV = sphereRadius / Math.sin(vFov / 2)
      const distH = sphereRadius / Math.sin(hFov / 2)
      const distance = Math.max(distV, distH) * 0.6

      camera.position.set(camDir.x * distance, camDir.y * distance + lookAtY, camDir.z * distance)
      camera.lookAt(0, lookAtY, 0)
      camera.updateProjectionMatrix()
    }
    fitCamera()
    const ro = new ResizeObserver(fitCamera)
    ro.observe(container)

    loadCarGLTF().then(gltf => {
      if (disposed) return
      car = cloneWithOwnMaterials(gltf.scene)

      car.traverse(node => {
        if (node.isMesh && node.material?.name === BODY_MATERIAL_NAME) {
          node.material.color.set(color)
        }
      })

      // Centra el auto por el centro de su caja (no de su esfera envolvente:
      // la esfera se desvía hacia el alerón trasero — alto y angosto — y eso
      // hacía que el auto "flotara" fuera de eje al recolocar la cámara).
      // En vertical, en vez de centrar por altura, apoya las llantas en
      // y=0 para que se vea parado sobre una base en lugar de flotando.
      const box = new THREE.Box3().setFromObject(car)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      car.position.x -= center.x
      car.position.z -= center.z
      car.position.y -= box.min.y

      const sphere = box.getBoundingSphere(new THREE.Sphere())
      const scale = 1 / (sphere.radius || 1)

      // El ángulo inicial (y el giro continuo, en tick()) se aplican en
      // "rig", nunca en "car": si se rota "car" directamente, se rota
      // ANTES del centrado de arriba, así que el centro calculado ya no
      // coincide con el centroide real una vez rotado — el auto termina
      // girando alrededor de un punto desviado en vez de su propio eje.
      rig = new THREE.Group()
      rig.add(car)
      rig.scale.setScalar(scale)
      rig.rotation.y = Math.PI * 0.22
      // Nudge horizontal: con este ángulo de cámara el auto se ve un poco
      // recargado a la izquierda dentro de su recuadro; este offset lo
      // recorre un poco a la derecha (no afecta el eje de giro, que sigue
      // siendo el propio centro del auto).
      rig.position.x = 0.08
      scene.add(rig)

      sphereRadius = 1
      lookAtY = size.y * scale * 0.52
      fitCamera()
    })

    // Gira sobre su propio eje Y (centrado ahora por el centro real de su
    // caja, no por la esfera envolvente desviada hacia el alerón — por eso
    // ya no "flota" fuera de eje al girar) + el mismo vaivén sutil del kart
    // 2D original.
    const clock = new THREE.Clock()
    function tick() {
      if (disposed) return
      const t = clock.getElapsedTime()
      if (rig) {
        rig.rotation.y += 0.006
        rig.position.y = Math.sin(t * 1.8) * 0.025
      }
      renderer.render(scene, camera)
      frameId = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      disposed = true
      if (frameId) cancelAnimationFrame(frameId)
      ro.disconnect()
      scene.traverse(node => {
        if (node.isMesh) {
          node.geometry?.dispose()
          const mats = Array.isArray(node.material) ? node.material : [node.material]
          mats.forEach(m => m?.dispose())
        }
      })
      renderer.dispose()
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [color])

  return <div ref={containerRef} style={{ width: '100%', height, position: 'relative' }} />
}
