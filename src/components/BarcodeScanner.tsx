import { useEffect, useRef, useState } from 'react'
import {
  BinaryBitmap,
  DecodeHintType,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
} from '@zxing/library'
import { BarcodeFormat } from '@zxing/browser'
import { Camera, QrCode, ScanBarcode, X } from 'lucide-react'
import { normalizeScannedValue, type CodeKind } from '../lib/decodeLabelCode'
import { Button } from './ui'

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onScan: (value: string) => void
}

function hintsFor(kind: CodeKind, pure = false) {
  const hints = new Map<DecodeHintType, unknown>()
  hints.set(DecodeHintType.TRY_HARDER, true)
  if (pure) hints.set(DecodeHintType.PURE_BARCODE, true)
  hints.set(
    DecodeHintType.POSSIBLE_FORMATS,
    kind === 'qr'
      ? [BarcodeFormat.QR_CODE, BarcodeFormat.DATA_MATRIX]
      : [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ],
  )
  return hints
}

/** Recorta o centro e amplia — essencial para QR pequeno em etiqueta preta. */
function drawVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  options: {
    invert?: boolean
    /** fração da imagem usada (menor = mais zoom digital) */
    cropRatio?: number
    /** tamanho mínimo de saída para o decoder */
    minOut?: number
    contrast?: number
  } = {},
) {
  const { invert = false, cropRatio = 0.82, minOut = 720, contrast = 1.25 } = options
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return false

  const side = Math.min(vw, vh)
  const crop = Math.max(48, Math.floor(side * cropRatio))
  const sx = Math.floor((vw - crop) / 2)
  const sy = Math.floor((vh - crop) / 2)

  const out = Math.min(1200, Math.max(minOut, Math.floor(crop * Math.max(1.5, 1 / cropRatio))))
  canvas.width = out
  canvas.height = out

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(video, sx, sy, crop, crop, 0, 0, out, out)

  const img = ctx.getImageData(0, 0, out, out)
  const d = img.data
  const intercept = 128 * (1 - contrast)
  for (let i = 0; i < d.length; i += 4) {
    let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    g = g * contrast + intercept
    if (invert) g = 255 - g
    d[i] = g
    d[i + 1] = g
    d[i + 2] = g
  }
  ctx.putImageData(img, 0, 0)
  return true
}

function decodeCanvas(reader: MultiFormatReader, canvas: HTMLCanvasElement): string | null {
  try {
    reader.reset()
    const source = new HTMLCanvasElementLuminanceSource(canvas)
    const bitmap = new BinaryBitmap(new HybridBinarizer(source))
    return reader.decodeWithState(bitmap).getText()
  } catch (err) {
    if (!(err instanceof NotFoundException)) return null
    try {
      reader.reset()
      const source = new HTMLCanvasElementLuminanceSource(canvas, true)
      const bitmap = new BinaryBitmap(new HybridBinarizer(source))
      return reader.decodeWithState(bitmap).getText()
    } catch {
      return null
    }
  }
}

/** Estratégias leves, 1 por tick (não trava o iPhone). */
const QR_STRATEGIES = [
  { cropRatio: 0.42, invert: false, contrast: 1.35, pure: true, minOut: 900 },
  { cropRatio: 0.32, invert: false, contrast: 1.4, pure: true, minOut: 1000 },
  { cropRatio: 0.28, invert: false, contrast: 1.45, pure: true, minOut: 1100 },
  { cropRatio: 0.38, invert: true, contrast: 1.3, pure: true, minOut: 900 },
  { cropRatio: 0.5, invert: false, contrast: 1.25, pure: false, minOut: 800 },
  { cropRatio: 0.35, invert: true, contrast: 1.4, pure: false, minOut: 1000 },
]

const BARCODE_STRATEGIES = [
  { cropRatio: 0.88, invert: true, contrast: 1.2, pure: false, minOut: 800 },
  { cropRatio: 0.88, invert: false, contrast: 1.2, pure: false, minOut: 800 },
  { cropRatio: 0.75, invert: true, contrast: 1.3, pure: false, minOut: 900 },
]

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)
  const handledRef = useRef(false)
  const busyRef = useRef(false)
  const tickRef = useRef(0)

  const [kind, setKind] = useState<CodeKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  onScanRef.current = onScan
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) {
      setKind(null)
      setError(null)
      setStarting(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !kind) return

    handledRef.current = false
    busyRef.current = false
    setError(null)
    setStarting(true)

    let cancelled = false
    const reader = new MultiFormatReader()
    let strategyIndex = 0

    const finish = (raw: string) => {
      if (handledRef.current || cancelled) return
      const text = normalizeScannedValue(raw)
      if (!text) return
      handledRef.current = true
      window.clearTimeout(tickRef.current)
      onScanRef.current(text)
      onCloseRef.current()
    }

    const stopStream = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      if (videoRef.current) videoRef.current.srcObject = null
    }

    const schedule = (ms = 260) => {
      if (cancelled || handledRef.current) return
      tickRef.current = window.setTimeout(() => {
        void scanOnce()
      }, ms)
    }

    const scanOnce = () => {
      if (cancelled || handledRef.current || busyRef.current) {
        schedule()
        return
      }

      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        schedule(180)
        return
      }

      const strategies = kind === 'qr' ? QR_STRATEGIES : BARCODE_STRATEGIES
      const strategy = strategies[strategyIndex % strategies.length]
      strategyIndex += 1

      busyRef.current = true
      try {
        reader.setHints(hintsFor(kind, strategy.pure))
        if (
          drawVideoFrame(video, canvas, {
            invert: strategy.invert,
            cropRatio: strategy.cropRatio,
            minOut: strategy.minOut,
            contrast: strategy.contrast,
          })
        ) {
          const text = decodeCanvas(reader, canvas)
          if (text) {
            finish(text)
            return
          }
        }
      } finally {
        busyRef.current = false
      }

      schedule(kind === 'qr' ? 200 : 240)
    }

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Câmera indisponível neste navegador.')
          return
        }

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

        if (!cancelled) schedule(350)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        if (/NotAllowedError|Permission/i.test(message)) {
          setError('Permissão da câmera negada.')
        } else {
          setError('Não foi possível abrir a câmera.')
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      window.clearTimeout(tickRef.current)
      stopStream()
    }
  }, [open, kind])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-3 sm:p-4">
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{
          marginBottom: 'max(0px, calc(env(safe-area-inset-bottom, 0px) + 2.5rem))',
          maxHeight: 'min(90dvh, 720px)',
        }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 text-slate-900">
            <Camera className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold">
              {!kind ? 'Tipo de código' : kind === 'qr' ? 'Ler QR Code' : 'Ler código de barras'}
            </h3>
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

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {!kind ? (
            <>
              <p className="text-sm text-slate-600">Escolha o tipo de código da etiqueta.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setKind('qr')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
                >
                  <QrCode className="mb-2 h-7 w-7 text-emerald-600" />
                  <p className="font-semibold text-slate-900">QR Code</p>
                </button>
                <button
                  type="button"
                  onClick={() => setKind('barcode')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
                >
                  <ScanBarcode className="mb-2 h-7 w-7 text-emerald-600" />
                  <p className="font-semibold text-slate-900">Código de barras</p>
                </button>
              </div>
              <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
                Cancelar / digitar manualmente
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-slate-600">
                  {kind === 'qr'
                    ? 'Centralize o QR na moldura e aproxime um pouco.'
                    : 'Aponte a câmera para o código.'}
                </p>
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium text-emerald-700 underline"
                  onClick={() => {
                    setKind(null)
                    setError(null)
                  }}
                >
                  Trocar tipo
                </button>
              </div>

              <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-xl bg-slate-950">
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover object-center"
                  muted
                  playsInline
                  autoPlay
                />
                <canvas ref={canvasRef} className="hidden" aria-hidden />

                {!starting && !error && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                    <div
                      className={`rounded-xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)] ${
                        kind === 'qr' ? 'h-[38%] w-[38%]' : 'h-[30%] w-[88%]'
                      }`}
                    />
                  </div>
                )}

                {starting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 text-sm text-white">
                    Abrindo câmera…
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
                Cancelar / digitar manualmente
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
