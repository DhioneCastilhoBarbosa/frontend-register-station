import { useEffect, useRef, useState } from 'react'
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  Result,
} from '@zxing/library'
import { Camera, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from './ui'

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onScan: (value: string) => void
}

/**
 * Chrome iOS e Safari usam WebKit (sem BarcodeDetector).
 * Estratégia: câmera + zoom digital no canvas + ZXing TRY_HARDER.
 */
function createHints() {
  const hints = new Map<DecodeHintType, unknown>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.CODE_93,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.ITF,
    BarcodeFormat.CODABAR,
    BarcodeFormat.RSS_14,
    BarcodeFormat.RSS_EXPANDED,
  ])
  hints.set(DecodeHintType.TRY_HARDER, true)
  hints.set(DecodeHintType.CHARACTER_SET, 'UTF-8')
  return hints
}

function decodeCanvas(reader: MultiFormatReader, canvas: HTMLCanvasElement): Result | null {
  try {
    const source = new HTMLCanvasElementLuminanceSource(canvas)
    const bitmap = new BinaryBitmap(new HybridBinarizer(source))
    return reader.decodeWithState(bitmap)
  } catch (err) {
    if (!(err instanceof NotFoundException)) {
      /* ignore outros e tenta invertido */
    }
  }

  try {
    const source = new HTMLCanvasElementLuminanceSource(canvas, true)
    const bitmap = new BinaryBitmap(new HybridBinarizer(source))
    return reader.decodeWithState(bitmap)
  } catch {
    return null
  }
}

function drawZoomedCrop(video: HTMLVideoElement, canvas: HTMLCanvasElement, zoom: number) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return false

  const z = Math.max(1, zoom)
  const cropW = Math.max(32, Math.floor(vw / z))
  const cropH = Math.max(32, Math.floor(vh / z))
  const sx = Math.floor((vw - cropW) / 2)
  const sy = Math.floor((vh - cropH) / 2)

  const outW = Math.min(1400, Math.max(720, Math.floor(cropW * Math.min(z, 3.5))))
  const outH = Math.floor(outW * (cropH / cropW))

  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, outW, outH)

  try {
    const img = ctx.getImageData(0, 0, outW, outH)
    const d = img.data
    const contrast = 1.3
    const intercept = 128 * (1 - contrast)
    for (let i = 0; i < d.length; i += 4) {
      // grayscale + contraste (ajuda barras/QR pequenos)
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const v = g * contrast + intercept
      d[i] = v
      d[i + 1] = v
      d[i + 2] = v
    }
    ctx.putImageData(img, 0, 0)
  } catch {
    /* ignore */
  }

  return true
}

async function getBestStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    })
  } catch {
    return navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: 'environment' } },
    })
  }
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const readerRef = useRef<MultiFormatReader | null>(null)
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)
  const handledRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const zoomRef = useRef(2.4)

  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(2.4)

  onScanRef.current = onScan
  onCloseRef.current = onClose
  zoomRef.current = zoom

  useEffect(() => {
    if (!open) return

    handledRef.current = false
    setError(null)
    setStarting(true)
    setReady(false)
    setZoom(2.4)
    zoomRef.current = 2.4

    let cancelled = false
    const reader = new MultiFormatReader()
    reader.setHints(createHints())
    readerRef.current = reader

    const finish = (value: string) => {
      if (handledRef.current || cancelled) return
      const trimmed = value.trim()
      if (!trimmed) return
      handledRef.current = true
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      onScanRef.current(trimmed)
      onCloseRef.current()
    }

    const schedule = () => {
      if (cancelled || handledRef.current) return
      timerRef.current = window.setTimeout(tryDecode, 100)
    }

    const tryDecode = () => {
      if (cancelled || handledRef.current) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        schedule()
        return
      }

      const baseZoom = zoomRef.current
      const levels = Array.from(
        new Set([
          baseZoom,
          Math.min(5, baseZoom + 0.6),
          Math.min(5, baseZoom + 1.2),
          Math.max(1.4, baseZoom - 0.4),
        ]),
      )

      for (const level of levels) {
        if (!drawZoomedCrop(video, canvas, level)) continue
        reader.reset()
        const result = decodeCanvas(reader, canvas)
        if (result) {
          finish(result.getText())
          return
        }
      }

      schedule()
    }

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Este navegador não permite câmera. Digite o serial manualmente.')
          return
        }

        const stream = await getBestStream()
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (!video) return

        video.setAttribute('playsinline', 'true')
        video.setAttribute('webkit-playsinline', 'true')
        video.muted = true
        video.playsInline = true
        video.srcObject = stream

        await video.play()
        if (cancelled) return

        setReady(true)
        schedule()
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        if (/NotAllowedError|Permission/i.test(message)) {
          setError('Permissão da câmera negada. No iPhone: Ajustes → Safari/Chrome → Câmera.')
        } else if (/NotFoundError|DevicesNotFound/i.test(message)) {
          setError('Nenhuma câmera encontrada.')
        } else {
          setError('Não foi possível abrir a câmera. Digite o serial manualmente.')
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      try {
        reader.reset()
      } catch {
        /* ignore */
      }
      readerRef.current = null
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
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
            Compatível com <strong>Safari</strong> e <strong>Chrome</strong> no iPhone. Use o zoom (não encoste o
            celular no código — isso desfoca). Centralize na moldura.
          </p>

          <div className="relative min-h-[62vh] flex-1 overflow-hidden rounded-xl bg-slate-950 sm:min-h-[460px]">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
              autoPlay
            />
            <canvas ref={canvasRef} className="hidden" aria-hidden />

            {ready && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                <div className="relative h-[36%] w-[92%] max-w-md rounded-xl border-2 border-emerald-400/95 shadow-[0_0_0_9999px_rgba(2,6,23,0.4)]">
                  <span className="absolute -bottom-7 left-1/2 w-max -translate-x-1/2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
                    Centralize o código aqui · zoom {zoom.toFixed(1)}x
                  </span>
                </div>
              </div>
            )}

            {starting && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm text-white">
                Abrindo câmera…
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="px-3"
              onClick={() => setZoom((z) => Math.max(1.2, Number((z - 0.2).toFixed(2))))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <input
              type="range"
              min={1.2}
              max={5}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-emerald-600"
              aria-label="Zoom digital"
            />
            <Button
              type="button"
              variant="secondary"
              className="px-3"
              onClick={() => setZoom((z) => Math.min(5, Number((z + 0.2).toFixed(2))))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <span className="w-10 text-right text-xs font-medium text-slate-600">{zoom.toFixed(1)}x</span>
          </div>

          {error && <p className="shrink-0 text-sm text-rose-600">{error}</p>}

          <Button type="button" variant="secondary" className="w-full shrink-0" onClick={onClose}>
            Cancelar / digitar manualmente
          </Button>
        </div>
      </div>
    </div>
  )
}
