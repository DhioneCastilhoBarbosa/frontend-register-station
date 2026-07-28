import { useEffect, useRef, useState } from 'react'
import { Camera, ImagePlus, QrCode, ScanBarcode, X } from 'lucide-react'
import { decodeLabelImage, type CodeKind } from '../lib/decodeLabelCode'
import { Button } from './ui'

interface BarcodeScannerProps {
  open: boolean
  onClose: () => void
  onScan: (value: string) => void
}

/**
 * 1) Escolhe QR ou código de barras
 * 2) Fotografa com câmera nativa (melhor no iPhone)
 * 3) Decode multi-pass (recorte + invertido para etiqueta branca no preto)
 */
export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<CodeKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decoding, setDecoding] = useState(false)

  useEffect(() => {
    if (!open) {
      setKind(null)
      setError(null)
      setDecoding(false)
    }
  }, [open])

  if (!open) return null

  const finish = (value: string) => {
    const text = value.trim()
    if (!text) return
    onScan(text)
    onClose()
  }

  const decodeFile = async (file: File | null) => {
    if (!file || !kind) return
    setDecoding(true)
    setError(null)
    try {
      const value = await decodeLabelImage(file, kind)
      finish(value)
    } catch {
      setError(
        kind === 'qr'
          ? 'Não li o QR. Enquadre só o QR (bem de perto), com boa luz, e tire outra foto.'
          : 'Não li o código de barras. Enquadre só as barras (elas são brancas no fundo preto) e tire outra foto.',
      )
    } finally {
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
          paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 4.5rem))',
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
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
            disabled={decoding}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 pt-4">
          {!kind ? (
            <>
              <p className="text-sm text-slate-600">
                Escolha o tipo na etiqueta do carregador. Isso melhora a leitura (QR pequeno ou barras
                brancas no fundo preto).
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setKind('qr')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
                >
                  <QrCode className="mb-2 h-7 w-7 text-emerald-600" />
                  <p className="font-semibold text-slate-900">QR Code</p>
                  <p className="mt-1 text-xs text-slate-500">Quadrado pequeno (ex.: City Pro)</p>
                </button>
                <button
                  type="button"
                  onClick={() => setKind('barcode')}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-left transition hover:border-emerald-400 hover:bg-emerald-50"
                >
                  <ScanBarcode className="mb-2 h-7 w-7 text-emerald-600" />
                  <p className="font-semibold text-slate-900">Código de barras</p>
                  <p className="mt-1 text-xs text-slate-500">Linhas brancas no fundo preto</p>
                </button>
              </div>
              <Button type="button" variant="ghost" className="w-full" onClick={onClose}>
                Cancelar / digitar manualmente
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                {kind === 'qr'
                  ? 'Aproxime só do QR (quadrado). Evite reflexo e tire a foto com foco.'
                  : 'Enquadre só as barras da parte de baixo da etiqueta. O fundo é preto e as barras são brancas.'}
              </p>

              <button
                type="button"
                className="text-xs font-medium text-emerald-700 underline"
                onClick={() => {
                  setKind(null)
                  setError(null)
                }}
                disabled={decoding}
              >
                ← Trocar tipo de código
              </button>

              {error && <p className="text-sm text-rose-600">{error}</p>}
              {decoding && <p className="text-sm text-slate-500">Analisando imagem…</p>}

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
                  Fotografar
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full py-3.5"
                  disabled={decoding}
                  onClick={() => galleryInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Galeria
                </Button>
                <Button type="button" variant="ghost" className="w-full" disabled={decoding} onClick={onClose}>
                  Cancelar / digitar manualmente
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
