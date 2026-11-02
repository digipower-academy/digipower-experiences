import { sunburstTargetingAdvertiser } from './postprocessors'
import { messenger } from './messenger'

const viewerFunctions = {
  postprocessors: {
    sunburstTargetingAdvertiser
  },
  customPipelines: {
    messenger
  }
}

export default viewerFunctions
