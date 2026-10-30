import { sunburstTargetingAdvertiser } from './postprocessors'
import {
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
    messenger_overview,
    messenger_deleted_accounts,
    messenger_anomalies,
    messenger_ids
  }
}

export default viewerFunctions
