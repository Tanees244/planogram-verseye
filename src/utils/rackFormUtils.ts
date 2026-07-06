import type { FixtureType } from '@/components/fixtures/types'
import type { RackFormState } from '@/components/forms/AddRackModal'

export function validateRackForm(
  locId: string,
  form: RackFormState,
): Record<string, string | null> {
  const errors: Record<string, string | null> = {}
  if (!locId?.trim()) errors.location = 'Location is required'
  if (!form.rackCode?.trim()) errors.rackCode = 'Rack code is required'
  const w = parseFloat(form.width)
  if (!form.width || Number.isNaN(w) || w <= 0) errors.width = 'Width must be a positive number'
  const d = parseFloat(form.depth)
  if (!form.depth || Number.isNaN(d) || d <= 0) errors.height = 'Depth must be a positive number'
  if (form.fixtureType === 'GONDOLA') {
    if (!form.sided || (form.sided !== 'one' && form.sided !== 'two')) errors.sided = 'Sides is required'
    if (form.sided === 'two' && form.fixtureType !== 'GONDOLA') {
      errors.sided = 'Only gondolas support two-sided configuration'
    }
  }
  return errors
}

export const defaultRackForm = (): RackFormState => ({
  width: '2.5',
  depth: '1.2',
  rackCode: '',
  plankType: 'standard',
  sided: 'two',
  fixtureType: 'GONDOLA' as FixtureType,
})
