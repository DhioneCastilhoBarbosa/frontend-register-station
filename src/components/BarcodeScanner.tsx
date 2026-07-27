import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, X } from 'lucide-react'
import { Button } from './ui'

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onScan: (value: string) => void
}

const SCANNER_ID = 'serial-barcode-scanner'

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const handledRef = useRef(false)

  useEffect(() => {
    if (!open) return

    handledRef.current = false
    setError(null)
    let cancelled = false

    const start = async () => {
      try {
        const scanner = new Html5Qrcode(SCANNER_ID)
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 260, height: 120 },
            aspectRatio: 1.777,
          },
          (decoded) => {
            if (handledRef.current) return
            handledRef.current = true
            const value = decoded.trim()
            void scanner
              .stop()
              .catch(() => undefined)
              .finally(() => {
                onScan(value)
                onClose()
              })
          },
          () => undefined,
        )
      } catch {
        if (!cancelled) {
          setError('Não foi possível acessar a câmera. Verifique a permissão ou digite o serial.')
        }
      }
    }

    void start()

    return () => {
      cancelled = true
      const scanner = scannerRef.current
      scannerRef.current = null
      if (scanner?.isScanning) {
        void scanner.stop().catch(() => undefined)
      }
    }
  }, [open, onClose, onScan])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-3 sm:items-center">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 text-slate-900">
            <Camera className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold">Ler código de barras</h3>
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

        <div className="space-y-3 p-4">
          <p className="text-sm text-slate-500">
            Aponte a câmera para o código de barras ou QR do número de série.
          </p>
          <div id={SCANNER_ID} className="overflow-hidden rounded-xl bg-slate-900" />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="button" variant="secondary" className="w-full" onClick={onClose}>
            Cancelar / digitar manualmente
          </Button>
        </div>
      </div>
    </div>
  )
}
