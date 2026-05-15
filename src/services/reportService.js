import { api } from '../lib/api'

export const createReport = (type, targetId, reason) => {
  return api.post('/api/reports', { target_type: type, target_id: targetId, reason })
}
