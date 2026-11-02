import { sunburstTargetingAdvertiser } from './postprocessors'
import {
  messenger,
  messenger_overview,
  messenger_deleted_accounts,
  messenger_anomalies,
  messenger_ids
} from './messenger'

const viewerFunctions = {
  postprocessors: {
    sunburstTargetingAdvertiser
  },
  customPipelines: {
    messenger,
    // the four former Messenger tabs: kept for viewer JSON files that still
    // list them (digipower.academy loads its viewer from experience-viewer-options)
    messenger_overview,
    messenger_deleted_accounts,
    messenger_anomalies,
    messenger_ids
  }
}

export default viewerFunctions
