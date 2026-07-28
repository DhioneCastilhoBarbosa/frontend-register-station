import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

type MapStyle = 'street' | 'satellite'

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string; maxZoom: number }> = {
  street: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 19,
  },
}

interface LocationMapProps {
  latitude: number | null
  longitude: number | null
  onChange: (coords: { latitude: number; longitude: number }) => void
}

export function LocationMap({ latitude, longitude, onChange }: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const onChangeRef = useRef(onChange)
  const draggingRef = useRef(false)
  const [mapStyle, setMapStyle] = useState<MapStyle>('street')
  const [ready, setReady] = useState(false)

  onChangeRef.current = onChange

  const hasCoords =
    latitude != null && longitude != null && !Number.isNaN(latitude) && !Number.isNaN(longitude)

  // Mantém o container no DOM sempre — evita panes órfãos do Leaflet cobrindo o formulário
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    if (!hasCoords) {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
        tileLayerRef.current = null
        setReady(false)
      }
      return
    }

    if (mapRef.current) return

    const map = L.map(el, {
      zoomControl: true,
      attributionControl: true,
    }).setView([latitude!, longitude!], 16)

    const marker = L.marker([latitude!, longitude!], {
      draggable: true,
      icon: markerIcon,
    }).addTo(map)

    marker.on('dragstart', () => {
      draggingRef.current = true
    })
    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      onChangeRef.current({ latitude: pos.lat, longitude: pos.lng })
      queueMicrotask(() => {
        draggingRef.current = false
      })
    })

    mapRef.current = map
    markerRef.current = marker
    setReady(true)

    const timers = [0, 150, 400].map((ms) => window.setTimeout(() => map.invalidateSize(), ms))

    return () => {
      timers.forEach((id) => window.clearTimeout(id))
      map.remove()
      mapRef.current = null
      markerRef.current = null
      tileLayerRef.current = null
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCoords])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker || !hasCoords || draggingRef.current) return

    const current = marker.getLatLng()
    if (
      Math.abs(current.lat - latitude!) < 0.00005 &&
      Math.abs(current.lng - longitude!) < 0.00005
    ) {
      return
    }

    marker.setLatLng([latitude!, longitude!])
    map.setView([latitude!, longitude!], Math.max(map.getZoom(), 16))
  }, [latitude, longitude, hasCoords])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    const next = TILE_LAYERS[mapStyle]
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current)
    }
    const tiles = L.tileLayer(next.url, {
      attribution: next.attribution,
      maxZoom: next.maxZoom,
    }).addTo(map)
    tileLayerRef.current = tiles
  }, [mapStyle, ready])

  return (
    <div className="space-y-2">
      <div className="relative">
        {!hasCoords && (
          <div className="flex h-52 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500">
            Busque o CEP para ver o mapa e ajustar o pin do carregador.
          </div>
        )}

        <div
          ref={containerRef}
          style={{ height: hasCoords ? 280 : 0, width: '100%' }}
          className={
            hasCoords
              ? 'overflow-hidden rounded-xl border border-slate-200 bg-slate-200'
              : 'pointer-events-none absolute h-0 w-full overflow-hidden opacity-0'
          }
          aria-hidden={!hasCoords}
        />

        {hasCoords && (
          <div className="absolute right-3 top-3 z-10 flex overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
            <button
              type="button"
              onClick={() => setMapStyle('street')}
              className={`px-3 py-1.5 text-xs font-semibold transition ${
                mapStyle === 'street' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Mapa
            </button>
            <button
              type="button"
              onClick={() => setMapStyle('satellite')}
              className={`px-3 py-1.5 text-xs font-semibold transition ${
                mapStyle === 'satellite' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Satélite
            </button>
          </div>
        )}
      </div>
      {hasCoords && (
        <p className="text-xs text-slate-500">Arraste o pin até a localização exata do carregador.</p>
      )}
    </div>
  )
}
