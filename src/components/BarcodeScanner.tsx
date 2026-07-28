import { useRef, useState } from 'react'
import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType } from '@zxing/library'
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

/**
 * No iPhone (Safari/Chrome) a leitura ao vivo trava e códigos pequenos falham.
 * Fluxo principal: foto com a câmera nativa (melhor foco) + decode da imagem.
 */
export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [decoding, setDecoding] = useState(false)

  if (!open) return null

  const finish = (value: string) => {
    const text = value.trim()
    if (!text) return
    onScan(text)
    onClose()
  }

  const decodeFile = async (file: File | null) => {
    if (!file) return
    setDecoding(true)
    setError(null)

    const url = URL.createObjectURL(file)
    try {
      const reader = new BrowserMultiFormatReader(buildHints())
      try {
        const result = await reader.decodeFromImageUrl(url)
        finish(result.getText())
        return
      } catch {
        /* tenta via elemento */
      }

      const img = new Image()
      img.decoding = 'async'
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('image'))
        img.src = url
      })

      const result = await reader.decodeFromImageElement(img)
      finish(result.getText())
    } catch {
      setError(
        'Não foi possível ler o código nesta imagem. Tire outra foto mais perto (com foco) ou digite o serial.',
      )
    } finally {
      URL.revokeObjectURL(url)
      setDecoding(false)
      if (cameraInputRef.current) cameraInputRef.current.value = ''
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 sm:items-center sm:p-4">
      <div
        className="flex w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        style={{
          // Espaço extra para a barra inferior do Chrome no iPhone
          paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))',
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2 text-slate-900">
            <Camera className="h-5 w-5 text-emerald-600" />
            <h3 className="font-semibold">Ler código / QR</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
            disabled={decoding}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 pt-4">
          <p className="text-sm text-slate-600">
            No iPhone, a melhor forma é <strong>fotografar</strong> o código com a câmera do sistema (foca
            melhor em QR/barras pequenos). Funciona no Safari e no Chrome.
          </p>

          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <Camera className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
            <p className="text-sm font-medium text-slate-800">Sem preview ao vivo</p>
            <p className="mt-1 text-xs text-slate-500">
              Assim o app não trava. A câmera nativa cuida do foco.
            </p>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {decoding && <p className="text-sm text-slate-500">Lendo código na imagem…</p>}

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void decodeFile(e.target.files?.[0] ?? null)}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void decodeFile(e.target.files?.[0] ?? null)}
          />

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              className="w-full py-3.5"
              disabled={decoding}
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Abrir câmera e fotografar
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="w-full py-3.5"
              disabled={decoding}
              onClick={() => galleryInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              Escolher da galeria
            </Button>

            <Button type="button" variant="ghost" className="w-full" disabled={decoding} onClick={onClose}>
              Cancelar / digitar manualmente
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
