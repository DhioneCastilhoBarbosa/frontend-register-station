import { Plus, Trash2 } from 'lucide-react'
import { Button, Field, Input } from './ui'

interface RfidCodesProps {
  codes: string[]
  onChange: (codes: string[]) => void
}

export function RfidCodes({ codes, onChange }: RfidCodesProps) {
  const update = (index: number, value: string) => {
    const next = [...codes]
    next[index] = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
    onChange(next)
  }

  const add = () => onChange([...codes, ''])

  const remove = (index: number) => {
    onChange(codes.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3">
      {codes.length === 0 && (
        <p className="text-sm text-slate-500">Adicione ao menos um código RFID.</p>
      )}

      {codes.map((code, index) => (
        <div key={index} className="flex items-end gap-2">
          <Field label={`Código RFID ${index + 1}`} className="flex-1">
            <Input
              value={code}
              placeholder="A1B2C3D4E5"
              onChange={(e) => update(index, e.target.value)}
              autoCapitalize="characters"
            />
          </Field>
          <Button type="button" variant="ghost" className="shrink-0 px-3" onClick={() => remove(index)}>
            <Trash2 className="h-4 w-4 text-rose-500" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={add}>
        <Plus className="h-4 w-4" />
        Adicionar código
      </Button>
    </div>
  )
}
