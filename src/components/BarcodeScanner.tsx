import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Camera, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from './ui'

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onScan: (value: string) => void
}

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

const FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
]

const NATIVE_FORMATS = [
  'qr_code',
  'code_128',
  'code_39',
  'code_93',
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'itf',
  'codabar',
  'data_matrix',
]

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  return ((window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null)
}

async function applyBestFocus(track: MediaStreamTrack) {
  try {
    const caps = track.getCapabilities?.() as
      | (MediaTrackCapabilities & { focusMode?: string[]; zoom?: { min: number; max: number } })
      | undefined

    const advanced: Record<string, unknown>[] = []

    if (caps?.focusMode?.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' })
    } else if (caps?.focusMode?.includes('single-shot')) {
      advanced.push({ focusMode: 'single-shot' })
    }

    if (advanced.length) {
      await track.applyConstraints({ advanced: advanced as MediaTrackConstraints['advanced'] })
    }
  } catch {
    /* alguns browsers não suportam focusMode */
  }
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fallbackHostRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const html5Ref = useRef<Html5Qrcode | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)
  const handledRef = useRef(false)
  const rafRef = useRef(0)

  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [mode, setMode] = useState<'native' | 'fallback' | null>(null)
  const [zoom, setZoom] = useState(1)
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null)

  onScanRef.current = onScan
  onCloseRef.current = onClose

  const finish = (value: string) => {
    if (handledRef.current) return
    const trimmed = value.trim()
    if (!trimmed) return
    handledRef.current = true
    onScanRef.current(trimmed)
    onCloseRef.current()
  }

  const applyZoom = async (value: number) => {
    const track = trackRef.current
    if (!track || !zoomRange) return
    const next = Math.min(zoomRange.max, Math.max(zoomRange.min, value))
    setZoom(next)
    try {
      await track.applyConstraints({
        advanced: [{ zoom: next } as unknown as MediaTrackConstraintSet],
      })
    } catch {
      /* zoom não suportado */
    }
  }

  useEffect(() => {
    if (!open) return

    handledRef.current = false
    setError(null)
    setStarting(true)
    setMode(null)
    setZoom(1)
    setZoomRange(null)
    let cancelled = false

    const stopAll = async () => {
      cancelAnimationFrame(rafRef.current)
      if (html5Ref.current) {
        try {
          if (html5Ref.current.isScanning) await html5Ref.current.stop()
          html5Ref.current.clear()
        } catch {
          /* ignore */
        }
        html5Ref.current = null
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      trackRef.current = null
    }

    const startNative = async () => {
      const Detector = getBarcodeDetector()
      if (!Detector || !videoRef.current) return false

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return false
      }

      const track = stream.getVideoTracks()[0]
      trackRef.current = track
      streamRef.current = stream
      await applyBestFocus(track)

      const caps = track.getCapabilities?.() as
        | (MediaTrackCapabilities & { zoom?: { min: number; max: number; step?: number } })
        | undefined
      if (caps?.zoom) {
        setZoomRange({ min: caps.zoom.min, max: caps.zoom.max })
        // Zoom leve ajuda em códigos pequenos sem precisar colar a câmera
        const initial = Math.min(caps.zoom.max, Math.max(caps.zoom.min, caps.zoom.min + (caps.zoom.max - caps.zoom.min) * 0.25))
        setZoom(initial)
        try {
          await track.applyConstraints({
            advanced: [{ zoom: initial } as unknown as MediaTrackConstraintSet],
          })
        } catch {
          /* ignore */
        }
      }

      const video = videoRef.current
      video.srcObject = stream
      await video.play()

      const detector = new Detector({ formats: NATIVE_FORMATS })

      const tick = async () => {
        if (cancelled || handledRef.current) return
        try {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const codes = await detector.detect(video)
            const value = codes.find((c) => c.rawValue)?.rawValue
            if (value) {
              finish(value)
              return
            }
          }
        } catch {
          /* frame sem código */
        }
        rafRef.current = requestAnimationFrame(() => {
          void tick()
        })
      }

      rafRef.current = requestAnimationFrame(() => {
        void tick()
      })
      setMode('native')
      return true
    }

    const startFallback = async () => {
      // Aguarda o host existir no DOM
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      if (cancelled || !fallbackHostRef.current) return

      const hostId = `barcode-fallback-${Date.now()}`
      fallbackHostRef.current.id = hostId
      fallbackHostRef.current.innerHTML = ''

      const scanner = new Html5Qrcode(hostId, {
        formatsToSupport: FORMATS,
        verbose: false,
      })
      html5Ref.current = scanner

      await scanner.start(
        { facingMode: { ideal: 'environment' } },
        {
          fps: 24,
          // Quase tela cheia: melhor para códigos pequenos
          qrbox: (w, h) => ({
            width: Math.floor(w * 0.96),
            height: Math.floor(h * 0.72),
          }),
          aspectRatio: 1.333,
          disableFlip: false,
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
          },
        },
        (decoded) => finish(decoded),
        () => undefined,
      )

      // Tenta foco contínuo no track do html5-qrcode
      const video = fallbackHostRef.current.querySelector('video')
      const stream = video?.srcObject
      if (stream instanceof MediaStream) {
        const track = stream.getVideoTracks()[0]
        if (track) {
          trackRef.current = track
          await applyBestFocus(track)
          const caps = track.getCapabilities?.() as
            | (MediaTrackCapabilities & { zoom?: { min: number; max: number } })
            | undefined
          if (caps?.zoom) {
            setZoomRange({ min: caps.zoom.min, max: caps.zoom.max })
            const initial = Math.min(
              caps.zoom.max,
              Math.max(caps.zoom.min, caps.zoom.min + (caps.zoom.max - caps.zoom.min) * 0.25),
            )
            setZoom(initial)
            try {
              await track.applyConstraints({
                advanced: [{ zoom: initial } as unknown as MediaTrackConstraintSet],
              })
            } catch {
              /* ignore */
            }
          }
        }
      }

      setMode('fallback')
    }

    const start = async () => {
      try {
        const ok = await startNative()
        if (!ok && !cancelled) await startFallback()
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        if (/NotAllowedError|Permission/i.test(message)) {
          setError('Permissão da câmera negada. Libere o acesso nas configurações do navegador.')
        } else if (/NotFoundError|DevicesNotFound/i.test(message)) {
          setError('Nenhuma câmera encontrada neste dispositivo.')
        } else {
          try {
            await startFallback()
          } catch {
            setError('Não foi possível iniciar a câmera. Digite o serial manualmente.')
          }
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      void stopAll()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/85 p-0 sm:items-center sm:p-3">
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[94vh] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 text-slate-900">
            <Camera className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold">Ler código / QR</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4">
          <p className="shrink-0 text-sm text-slate-500">
            Não encoste a câmera no código — isso desfoca. Use o zoom e mantenha ~10–20 cm de distância, com boa luz.
          </p>

          <div className="relative min-h-[62vh] flex-1 overflow-hidden rounded-xl bg-slate-950 sm:min-h-[460px]">
            {/* Native BarcodeDetector path */}
            <video
              ref={videoRef}
              className={`absolute inset-0 h-full w-full object-cover ${mode === 'native' ? 'block' : 'hidden'}`}
              muted
              playsInline
              autoPlay
            />

            {/* html5-qrcode fallback */}
            <div
              ref={fallbackHostRef}
              className={`barcode-scanner-viewport absolute inset-0 h-full w-full ${mode === 'fallback' ? 'block' : 'hidden'}`}
            />

            {/* Guia visual */}
            {(mode === 'native' || mode === 'fallback') && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                <div className="h-[42%] w-[92%] rounded-xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]" />
              </div>
            )}

            {starting && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm text-white">
                Abrindo câmera…
              </div>
            )}
          </div>

          {zoomRange && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="px-3"
                onClick={() => void applyZoom(zoom - (zoomRange.max - zoomRange.min) * 0.1)}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <input
                type="range"
                min={zoomRange.min}
                max={zoomRange.max}
                step={(zoomRange.max - zoomRange.min) / 20 || 0.1}
                value={zoom}
                onChange={(e) => void applyZoom(Number(e.target.value))}
                className="flex-1 accent-emerald-600"
                aria-label="Zoom"
              />
              <Button
                type="button"
                variant="secondary"
                className="px-3"
                onClick={() => void applyZoom(zoom + (zoomRange.max - zoomRange.min) * 0.1)}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          )}

          {error && <p className="shrink-0 text-sm text-rose-600">{error}</p>}

          <Button type="button" variant="secondary" className="w-full shrink-0" onClick={onClose}>
            Cancelar / digitar manualmente
          </Button>
        </div>
      </div>
    </div>
  )
}
