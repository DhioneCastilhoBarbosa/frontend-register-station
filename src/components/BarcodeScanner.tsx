import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Camera, X } from 'lucide-react'
import { Button } from './ui'

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onScan: (value: string) => void
}

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

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const reactId = useId().replace(/:/g, '')
  const scannerId = `serial-barcode-scanner-${reactId}`
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onScanRef = useRef(onScan)
  const onCloseRef = useRef(onClose)
  const handledRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  onScanRef.current = onScan
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    handledRef.current = false
    setError(null)
    setStarting(true)
    let cancelled = false

    const start = async () => {
      // Garante que o container já está no DOM
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      if (cancelled) return

      const el = document.getElementById(scannerId)
      if (!el) {
        setError('Área da câmera indisponível. Feche e tente novamente.')
        setStarting(false)
        return
      }

      try {
        const scanner = new Html5Qrcode(scannerId, {
          formatsToSupport: FORMATS,
          verbose: false,
        })
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: { ideal: 'environment' } },
          {
            fps: 20,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const width = Math.floor(Math.min(viewfinderWidth * 0.92, viewfinderWidth - 16))
              // Área alta o suficiente para QR e larga para código de barras
              const height = Math.floor(Math.min(viewfinderHeight * 0.55, width * 0.7, 320))
              return {
                width: Math.max(220, width),
                height: Math.max(160, height),
              }
            },
            aspectRatio: 1.333,
            disableFlip: false,
            videoConstraints: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          (decoded) => {
            if (handledRef.current || cancelled) return
            handledRef.current = true
            const value = decoded.trim()
            if (!value) {
              handledRef.current = false
              return
            }

            void scanner
              .stop()
              .catch(() => undefined)
              .then(() => {
                try {
                  scanner.clear()
                } catch {
                  /* ignore */
                }
                scannerRef.current = null
                onScanRef.current(value)
                onCloseRef.current()
              })
          },
          () => undefined,
        )
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : ''
          if (/NotAllowedError|Permission/i.test(message)) {
            setError('Permissão da câmera negada. Libere o acesso nas configurações do navegador.')
          } else if (/NotFoundError|DevicesNotFound/i.test(message)) {
            setError('Nenhuma câmera encontrada neste dispositivo.')
          } else {
            setError('Não foi possível iniciar a câmera. Tente novamente ou digite o serial.')
          }
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    }

    void start()

    return () => {
      cancelled = true
      const scanner = scannerRef.current
      scannerRef.current = null
      if (scanner) {
        void scanner
          .stop()
          .catch(() => undefined)
          .then(() => {
            try {
              scanner.clear()
            } catch {
              /* ignore */
            }
          })
      }
    }
  }, [open, scannerId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/80 p-0 sm:items-center sm:p-4">
      <div className="flex h-full w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-2xl">
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
            Enquadre o código de barras ou QR na área destacada. Mantenha firme e com boa iluminação.
          </p>

          <div className="relative min-h-[58vh] flex-1 overflow-hidden rounded-xl bg-slate-900 sm:min-h-[420px]">
            <div id={scannerId} className="barcode-scanner-viewport h-full w-full" />
            {starting && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-sm text-white">
                Abrindo câmera…
              </div>
            )}
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
