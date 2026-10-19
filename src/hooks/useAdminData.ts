import { useOutletContext } from 'react-router-dom'
import type { AdminData } from '../services/adminService'

export interface AdminOutletContext {
  data: AdminData | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/** Shared admin data (invitations, responses, guests) loaded once by AdminLayout. */
export function useAdminData(): AdminOutletContext {
  return useOutletContext<AdminOutletContext>()
}
