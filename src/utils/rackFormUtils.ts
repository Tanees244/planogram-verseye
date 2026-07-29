import { DEFAULT_RACK_DEPTH, DEFAULT_RACK_WIDTH, MIN_RACK_DEPTH, MIN_RACK_WIDTH } from '@/constants/dimensions'
import type { FixtureType } from '@/components/fixtures/types'
import type { RackFormState } from '@/components/forms/AddRackModal'
import { cmInputFromM, cmToM, mToCmDisplay } from '@/utils/lengthUnits'

/** Form width/depth strings are centimeters. */
export function validateRackForm(
  locId: string,
  form: RackFormState,
): Record<string, string | null> {
  const errors: Record<string, string | null> = {}
  if (!locId?.trim()) errors.location = 'Location is required'
  if (!form.rackName?.trim()) errors.rackName = 'Rack name is required'
  const wCm = parseFloat(form.width)
  const wM = cmToM(wCm)
  if (!form.width || Number.isNaN(wCm) || wCm <= 0) {
    errors.width = 'Width must be a positive number'
  } else if (wM < MIN_RACK_WIDTH) {
    errors.width = `Width must be at least ${mToCmDisplay(MIN_RACK_WIDTH, 0)} cm`
  }
  const dCm = parseFloat(form.depth)
  const dM = cmToM(dCm)
  if (!form.depth || Number.isNaN(dCm) || dCm <= 0) {
    errors.depth = 'Depth must be a positive number'
  } else if (dM < MIN_RACK_DEPTH) {
    errors.depth = `Depth must be at least ${mToCmDisplay(MIN_RACK_DEPTH, 0)} cm`
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
  width: cmInputFromM(DEFAULT_RACK_WIDTH, 0),
  depth: cmInputFromM(DEFAULT_RACK_DEPTH, 0),
  rackName: '',
  plankType: 'standard',
  sided: 'two',
  fixtureType: 'GONDOLA' as FixtureType,
})
