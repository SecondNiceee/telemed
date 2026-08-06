/**
 * Store for active calls - persists call state so users can receive
 * incoming calls even after page refresh
 */

export interface ActiveCall {
  appointmentId: number
  callerPeerId: string
  callerName: string
  callerType: 'user' | 'doctor'
  callerId: number
  targetType: 'user' | 'doctor'
  targetId: number | null // ID of the target user/doctor (null if unknown)
  isAudioOnly: boolean // True if this is an audio-only call (no video)
  createdAt: number
}

// Map: appointmentId -> ActiveCall
const activeCallsMap = new Map<number, ActiveCall>()

// Call timeout - auto-cleanup after 60 seconds (safety net)
const CALL_TIMEOUT_MS = 60000

/**
 * Add an active call to the store
 */
export function addActiveCall(call: ActiveCall): void {
  activeCallsMap.set(call.appointmentId, call)
  console.log(`[ActiveCalls] Added call for appointment ${call.appointmentId}, caller: ${call.callerType}:${call.callerId}`)
  console.log(`[ActiveCalls] Active calls count: ${activeCallsMap.size}`)
  
  // Auto-cleanup after timeout (safety net in case call-end/reject is missed)
  setTimeout(() => {
    const existingCall = activeCallsMap.get(call.appointmentId)
    // Only remove if it's the same call (same createdAt timestamp)
    if (existingCall && existingCall.createdAt === call.createdAt) {
      activeCallsMap.delete(call.appointmentId)
      console.log(`[ActiveCalls] Auto-removed stale call for appointment ${call.appointmentId} after timeout`)
    }
  }, CALL_TIMEOUT_MS)
}

/**
 * Remove an active call from the store
 */
export function removeActiveCall(appointmentId: number): void {
  const removed = activeCallsMap.delete(appointmentId)
  if (removed) {
    console.log(`[ActiveCalls] Removed call for appointment ${appointmentId}`)
    console.log(`[ActiveCalls] Active calls count: ${activeCallsMap.size}`)
  }
}

/**
 * Get an active call by appointmentId
 */
export function getActiveCall(appointmentId: number): ActiveCall | undefined {
  return activeCallsMap.get(appointmentId)
}

/**
 * Get all active calls for a specific target type and optionally target ID
 * Used when a user/doctor connects to check if they have pending incoming calls
 */
export function getActiveCallsForTarget(targetType: 'user' | 'doctor', targetId?: number): ActiveCall[] {
  const calls: ActiveCall[] = []
  for (const call of activeCallsMap.values()) {
    // Match by targetType
    if (call.targetType !== targetType) continue
    
    // If targetId is specified, also match by targetId
    // If the call has no targetId stored (null), we still include it for backward compatibility
    if (targetId !== undefined && call.targetId !== null && call.targetId !== targetId) {
      continue
    }
    
    calls.push(call)
  }
  return calls
}

/**
 * Check if there's an active call for a specific appointment
 */
export function hasActiveCall(appointmentId: number): boolean {
  return activeCallsMap.has(appointmentId)
}

/**
 * Update the targetId for an active call
 * Called when we discover the target user's ID (e.g., when they connect)
 */
export function updateActiveCallTargetId(appointmentId: number, targetId: number): void {
  const call = activeCallsMap.get(appointmentId)
  if (call && call.targetId === null) {
    call.targetId = targetId
    console.log(`[ActiveCalls] Updated targetId for appointment ${appointmentId} to ${targetId}`)
  }
}

/**
 * Get all active calls (for debugging)
 */
export function getAllActiveCalls(): ActiveCall[] {
  return Array.from(activeCallsMap.values())
}
