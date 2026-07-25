import { DEFAULT_RACK_DEPTH, DEFAULT_RACK_WIDTH, MIN_RACK_DEPTH, MIN_RACK_WIDTH } from '@/constants/dimensions'
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
  if (!form.width || Number.isNaN(w) || w <= 0) {
    errors.width = 'Width must be a positive number'
  } else if (w < MIN_RACK_WIDTH) {
    errors.width = `Width must be at least ${MIN_RACK_WIDTH} m`
  }
  const d = parseFloat(form.depth)
  if (!form.depth || Number.isNaN(d) || d <= 0) {
    errors.depth = 'Depth must be a positive number'
  } else if (d < MIN_RACK_DEPTH) {
    errors.depth = `Depth must be at least ${MIN_RACK_DEPTH} m`
  }
  if (form.fixtureType === 'GONDOLA') {
    if (!form.sided || (form.sided !== 'one' && form.sided !== 'two')) errors.sided = 'Sides is required'
    if (form.sided === 'two' && form.fixtureType !== 'GONDOLA') {
      errors.sided = 'Only gondolas support two-sided configuration'
    }
  }
  return errors
}

export const defaultRackForm = (): RackFormState => ({
  width: String(DEFAULT_RACK_WIDTH),
  depth: String(DEFAULT_RACK_DEPTH),
  rackCode: '',
  rackName: '',
  plankType: 'standard',
  sided: 'two',
  fixtureType: 'GONDOLA' as FixtureType,
})
