'use client'

import { Modal } from '@/components/ui/Modal'
import { Alert, Btn, FormField, FormGrid, Input, PillGroup, Select } from '@/components/ui/form'
import { FIXTURE_LIBRARY, FIXTURE_TYPES, type FixtureType } from '@/components/fixtures/types'
import { Spinner } from '@/components/Spinner'

export interface RackFormState {
  width: string
  depth: string
  rackCode: string
  plankType: string
  sided: 'one' | 'two'
  fixtureType: FixtureType
}

interface AddRackModalProps {
  open: boolean
  onClose: () => void
  areaWidth: number
  areaDepth: number
  form: RackFormState
  onChange: (form: RackFormState) => void
  locations: { id: string; locationCode: string }[]
  locationsLoading?: boolean
  locationsError?: string | null
  selectedLocationId: string
  onLocationChange: (id: string) => void
  errors: Record<string, string | null>
  globalError?: string | null
  isSubmitting?: boolean
  onSubmit: () => void
  onPlaceOnFloor?: () => void
  submitLabel?: string
}

export function AddRackModal({
  open,
  onClose,
  areaWidth,
  areaDepth,
  form,
  onChange,
  locations,
  locationsLoading,
  locationsError,
  selectedLocationId,
  onLocationChange,
  errors,
  globalError,
  isSubmitting,
  onSubmit,
  onPlaceOnFloor,
  submitLabel = 'Add Rack',
}: AddRackModalProps) {
  const set = (patch: Partial<RackFormState>) => onChange({ ...form, ...patch })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Rack"
      subtitle={`Configure a new fixture on the ${areaWidth} m × ${areaDepth} m floor.`}
      maxWidth="2xl"
      footer={
        <>
          <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Btn>
          {onPlaceOnFloor && (
            <Btn variant="secondary" onClick={onPlaceOnFloor} disabled={isSubmitting}>
              Place on floor
            </Btn>
          )}
          <Btn variant="primary" onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting && <Spinner />}
            {isSubmitting ? 'Adding…' : submitLabel}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        {globalError && <Alert>{globalError}</Alert>}

        <FormGrid>
          <FormField label="Location" required error={errors.location}>
            <Select
              value={selectedLocationId}
              disabled={locationsLoading}
              error={!!errors.location}
              onChange={(e) => onLocationChange(e.target.value)}
            >
              <option value="">{locationsLoading ? 'Loading locations…' : 'Select location'}</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.locationCode}
                </option>
              ))}
            </Select>
            {locationsError && <p className="text-xs text-amber-600 mt-1">{locationsError}</p>}
          </FormField>

          <FormField label="Rack Code" required error={errors.rackCode}>
            <Input
              placeholder="Enter rack code"
              value={form.rackCode}
              error={!!errors.rackCode}
              onChange={(e) => set({ rackCode: e.target.value })}
            />
          </FormField>

          <FormField
            label="Fixture Type"
            required
            hint={FIXTURE_LIBRARY[form.fixtureType].description}
            className="sm:col-span-2"
          >
            <Select
              value={form.fixtureType}
              onChange={(e) => {
                const fixtureType = e.target.value as FixtureType
                const def = FIXTURE_LIBRARY[fixtureType]
                set({
                  fixtureType,
                  width: String(def.defaultWidth),
                  depth: String(def.defaultDepth),
                  sided: def.defaultSided,
                })
              }}
            >
              {FIXTURE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIXTURE_LIBRARY[t].label}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Width (m)" required error={errors.width}>
            <Input
              inputMode="decimal"
              value={form.width}
              placeholder="2.5"
              error={!!errors.width}
              onChange={(e) => set({ width: e.target.value })}
            />
          </FormField>

          <FormField label="Depth (m)" required error={errors.height}>
            <Input
              inputMode="decimal"
              value={form.depth}
              placeholder="1.2"
              error={!!errors.height}
              onChange={(e) => set({ depth: e.target.value })}
            />
          </FormField>

          {form.fixtureType === 'GONDOLA' && (
            <FormField label="Sides" required error={errors.sided} className="sm:col-span-2">
              <PillGroup
                value={form.sided}
                onChange={(sided) => set({ sided })}
                options={[
                  { value: 'one', label: 'One sided' },
                  { value: 'two', label: 'Two sided' },
                ]}
              />
            </FormField>
          )}
        </FormGrid>
      </div>
    </Modal>
  )
}
