import { BarcodeFormat, BrowserMultiFormatReader } from '@zxing/browser'
import {
  BinaryBitmap,
  DecodeHintType,
  HTMLCanvasElementLuminanceSource,
  HybridBinarizer,
  MultiFormatReader,
} from '@zxing/library'

export type CodeKind = 'qr' | 'barcode'

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

function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = 'async'
  return new Promise((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Falha ao carregar imagem'))
    }
    img.src = url
  })
}

function drawImageToCanvas(
  img: HTMLImageElement,
  options: {
    invert?: boolean
    /** recorte relativo 0–1 */
    crop?: { x: number; y: number; w: number; h: number }
    /** escala do recorte (amplia) */
    scale?: number
  } = {},
): HTMLCanvasElement {
  const { invert = false, crop, scale = 1 } = options
  const sx = crop ? Math.floor(img.naturalWidth * crop.x) : 0
  const sy = crop ? Math.floor(img.naturalHeight * crop.y) : 0
  const sw = crop ? Math.floor(img.naturalWidth * crop.w) : img.naturalWidth
  const sh = crop ? Math.floor(img.naturalHeight * crop.h) : img.naturalHeight

  const outW = Math.min(1600, Math.max(640, Math.floor(sw * Math.max(1, scale))))
  const outH = Math.floor(outW * (sh / sw))

  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)

  const data = ctx.getImageData(0, 0, outW, outH)
  const d = data.data
  for (let i = 0; i < d.length; i += 4) {
    let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    // contraste
    g = (g - 128) * 1.35 + 128
    if (invert) g = 255 - g
    d[i] = g
    d[i + 1] = g
    d[i + 2] = g
  }
  ctx.putImageData(data, 0, 0)
  return canvas
}

function tryDecodeCanvas(reader: MultiFormatReader, canvas: HTMLCanvasElement): string | null {
  try {
    reader.reset()
    const source = new HTMLCanvasElementLuminanceSource(canvas)
    const bitmap = new BinaryBitmap(new HybridBinarizer(source))
    return reader.decodeWithState(bitmap).getText()
  } catch {
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

/** Limpa texto lido (QR às vezes traz URL ou “NS: …”). */
export function normalizeScannedValue(raw: string): string {
  let text = raw.trim()

  const ns = text.match(/NS\s*[:\-]?\s*([A-Z0-9\-]+)/i)
  if (ns?.[1]) return ns[1]

  // se for URL, pega último segmento útil
  try {
    if (/^https?:\/\//i.test(text)) {
      const u = new URL(text)
      const last = u.pathname.split('/').filter(Boolean).pop()
      if (last && /[A-Z0-9]/i.test(last)) return decodeURIComponent(last)
      const q = u.searchParams.get('sn') || u.searchParams.get('serial') || u.searchParams.get('ns')
      if (q) return q
    }
  } catch {
    /* ignore */
  }

  // remove prefixos comuns
  text = text.replace(/^(SN|NS|S\/N|SERIAL)\s*[:\-]?\s*/i, '').trim()
  return text
}

function cropPresets(kind: CodeKind): Array<{ x: number; y: number; w: number; h: number; scale: number }> {
  if (kind === 'qr') {
    // QR costuma ficar no canto inferior (etiqueta Intelbras)
    return [
      { x: 0, y: 0, w: 1, h: 1, scale: 1.2 },
      { x: 0.55, y: 0.55, w: 0.42, h: 0.42, scale: 2.5 },
      { x: 0.6, y: 0.6, w: 0.38, h: 0.38, scale: 3 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5, scale: 2.2 },
      { x: 0.65, y: 0.65, w: 0.32, h: 0.32, scale: 3.5 },
      { x: 0.2, y: 0.55, w: 0.6, h: 0.4, scale: 2 },
    ]
  }
  // Barras: faixa inferior da etiqueta (branco no preto)
  return [
    { x: 0, y: 0, w: 1, h: 1, scale: 1.2 },
    { x: 0.05, y: 0.7, w: 0.9, h: 0.28, scale: 2.2 },
    { x: 0.05, y: 0.75, w: 0.9, h: 0.22, scale: 2.8 },
    { x: 0.1, y: 0.78, w: 0.8, h: 0.18, scale: 3.2 },
    { x: 0.05, y: 0.65, w: 0.9, h: 0.3, scale: 2 },
  ]
}

export async function decodeLabelImage(file: File, kind: CodeKind): Promise<string> {
  const img = await loadImage(file)
  const reader = new MultiFormatReader()
  reader.setHints(hintsFor(kind))

  const invertPass = kind === 'barcode' ? [true, false] : [false, true]
  const crops = cropPresets(kind)

  for (const invert of invertPass) {
    for (const crop of crops) {
      const canvas = drawImageToCanvas(img, {
        invert,
        crop: { x: crop.x, y: crop.y, w: crop.w, h: crop.h },
        scale: crop.scale,
      })
      const text = tryDecodeCanvas(reader, canvas)
      if (text) return normalizeScannedValue(text)
    }
  }

  // Fallback BrowserMultiFormatReader (às vezes pega o que o MultiFormatReader não pega)
  const browserReader = new BrowserMultiFormatReader(hintsFor(kind))
  try {
    const result = await browserReader.decodeFromImageElement(img)
    return normalizeScannedValue(result.getText())
  } catch {
    /* continue */
  }

  // Última tentativa: imagem inteira invertida via canvas + browser reader
  for (const invert of [false, true]) {
    const canvas = drawImageToCanvas(img, { invert, scale: 1.5 })
    try {
      const result = browserReader.decodeFromCanvas(canvas)
      return normalizeScannedValue(result.getText())
    } catch {
      /* ignore */
    }
  }

  throw new Error('Código não encontrado na imagem')
}
