import { getDatabase } from '../../../database'
import { listBans } from '../../../services/challenge-service'
import { getChallengeId } from '../../../utils/route'
import { requireUser } from '../../../utils/session'

export default defineEventHandler(
  async (event): Promise<{ users: Array<{ id: string; firstName: string }> }> => {
    const user = await requireUser(event)
    return { users: await listBans(getDatabase(event), getChallengeId(event), user) }
  },
)
