import { useEffect, useRef, useState } from 'react'
import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, NotFoundException } from '@zxing/library'
import { Camera, ImagePlus, X } from 'lucide-react'
import { Button } from './ui'

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onScan: (value: string) => void
}

function buildHints() {
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
  ])
  hints.set(DecodeHintType.TRY_HARDER, true)
  return hints
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)
  const handledRef = useRef(false)

  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [decodingPhoto, setDecodingPhoto] = useState(false)

  onScanRef.current = onScan
  onCloseRef.current = onClose

  const finish = (value: string) => {
    if (handledRef.current) return
    const text = value.trim()
    if (!text) return
    handledRef.current = true
    try {
      controlsRef.current?.stop()
    } catch {
      /* ignore */
    }
    controlsRef.current = null
    onScanRef.current(text)
    onCloseRef.current()
  }

  useEffect(() => {
    if (!open) return

    handledRef.current = false
    setError(null)
    setStarting(true)
    setDecodingPhoto(false)

    let cancelled = false
    const reader = new BrowserMultiFormatReader(buildHints(), {
      delayBetweenScanAttempts: 250,
      delayBetweenScanSuccess: 1000,
      tryPlayVideoTimeout: 8000,
    })
    readerRef.current = reader

    const start = async () => {
      try {
        // Espera o <video> montar
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        if (cancelled || !videoRef.current) return

        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          videoRef.current,
          (result, err) => {
            if (cancelled || handledRef.current) return
            if (result) {
              finish(result.getText())
              return
            }
            // NotFoundException é normal a cada frame sem código
            if (err && !(err instanceof NotFoundException)) {
              /* ignora ruído de decode */
            }
          },
        )

        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : ''
        if (/NotAllowedError|Permission/i.test(message)) {
          setError('Permissão da câmera negada. Libere em Ajustes do iPhone.')
        } else if (/NotFoundError|DevicesNotFound/i.test(message)) {
          setError('Nenhuma câmera encontrada.')
        } else {
          setError('Não foi possível abrir a câmera contínua. Use “Fotografar código” abaixo.')
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      try {
        controlsRef.current?.stop()
      } catch {
        /* ignore */
      }
      controlsRef.current = null
      readerRef.current = null
    }
  }, [open])

  const onPhotoSelected = async (file: File | null) => {
    if (!file) return
    setDecodingPhoto(true)
    setError(null)

    try {
      const reader = readerRef.current ?? new BrowserMultiFormatReader(buildHints())
      const url = URL.createObjectURL(file)
      try {
        const result = await reader.decodeFromImageUrl(url)
        finish(result.getText())
      } finally {
        URL.revokeObjectURL(url)
      }
    } catch {
      // Tenta com imagem HTML + TRY_HARDER já nas hints
      try {
        const reader = new BrowserMultiFormatReader(buildHints())
        const img = new Image()
        const url = URL.createObjectURL(file)
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('image'))
          img.src = url
        })
        const result = await reader.decodeFromImageElement(img)
        URL.revokeObjectURL(url)
        finish(result.getText())
      } catch {
        setError(
          'Não deu para ler nesta foto. Aproxime um pouco, mantenha firme/foco e tire outra — ou digite o serial.',
        )
      }
    } finally {
      setDecodingPhoto(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

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
            Safari e Chrome no iPhone. Apontar a câmera para o código. Se for <strong>muito pequeno</strong>, use{' '}
            <strong>Fotografar código</strong> — a câmera do iPhone foca melhor na foto.
          </p>

          <div className="relative min-h-[55vh] flex-1 overflow-hidden rounded-xl bg-slate-950 sm:min-h-[400px]">
            <video
              ref={videoRef}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              playsInline
              autoPlay
            />

            {!starting && !error && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5">
                <div className="h-[40%] w-[88%] rounded-xl border-2 border-emerald-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]" />
              </div>
            )}

            {(starting || decodingPhoto) && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 text-sm text-white">
                {decodingPhoto ? 'Lendo foto…' : 'Abrindo câmera…'}
              </div>
            )}
          </div>

          {error && <p className="shrink-0 text-sm text-rose-600">{error}</p>}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onPhotoSelected(e.target.files?.[0] ?? null)}
          />

          <Button
            type="button"
            className="w-full shrink-0"
            disabled={decodingPhoto}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            Fotografar código (recomendado no iPhone)
          </Button>

          <Button type="button" variant="secondary" className="w-full shrink-0" onClick={onClose}>
            Cancelar / digitar manualmente
          </Button>
        </div>
      </div>
    </div>
  )
}
