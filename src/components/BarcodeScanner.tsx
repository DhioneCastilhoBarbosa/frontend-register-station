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

function hintsFor(kind: CodeKind) {
  const hints = new Map<DecodeHintType, unknown>()
  hints.set(DecodeHintType.TRY_HARDER, true)
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

function drawVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  invert: boolean,
  cropRatio = 0.82,
) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return false

  const cw = Math.floor(vw * cropRatio)
  const ch = Math.floor(vh * cropRatio)
  const sx = Math.floor((vw - cw) / 2)
  const sy = Math.floor((vh - ch) / 2)

  const outW = Math.min(960, cw)
  const outH = Math.floor(outW * (ch / cw))
  canvas.width = outW
  canvas.height = outH

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  ctx.drawImage(video, sx, sy, cw, ch, 0, 0, outW, outH)

  if (invert) {
    const img = ctx.getImageData(0, 0, outW, outH)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i]
      d[i + 1] = 255 - d[i + 1]
      d[i + 2] = 255 - d[i + 2]
    }
    ctx.putImageData(img, 0, 0)
  }

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
    reader.setHints(hintsFor(kind))
    let invertToggle = false

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

    const schedule = (ms = 280) => {
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
        schedule(200)
        return
      }

      busyRef.current = true
      try {
        // Barras: alterna invertido (etiqueta branca no preto). QR: sem invert padrão.
        const invert = kind === 'barcode' ? invertToggle : false
        invertToggle = !invertToggle

        if (drawVideoFrame(video, canvas, invert, kind === 'qr' ? 0.7 : 0.88)) {
          const text = decodeCanvas(reader, canvas)
          if (text) {
            finish(text)
            return
          }
        }
      } finally {
        busyRef.current = false
      }

      schedule(kind === 'barcode' ? 220 : 300)
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
            width: { ideal: 1280 },
            height: { ideal: 720 },
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
                <p className="text-sm text-slate-600">Aponte a câmera para o código.</p>
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
                        kind === 'qr' ? 'h-[46%] w-[46%]' : 'h-[30%] w-[88%]'
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
