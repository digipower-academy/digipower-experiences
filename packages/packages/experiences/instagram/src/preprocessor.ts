import { PreprocessorFunction } from '@/types/experience-options'
import facebook from '../../facebook/src/preprocessor'

const SINGLE_ACTIVITY_ENTRY = /^\s*\{\s*"timestamp"\s*:/

const instagram: PreprocessorFunction = input => {
  const s = facebook(input)
  return SINGLE_ACTIVITY_ENTRY.test(s) ? `[${s}]` : s
}

export default instagram
