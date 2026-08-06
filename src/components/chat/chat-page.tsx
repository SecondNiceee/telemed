'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChatSidebar } from './chat-sidebar'
import { ChatWindow } from './chat-window'
import { SocketProvider, useSocket } from '@/components/socket-provider'
import type { ApiAppointment } from '@/lib/api/types'
import { MessageSquare } from 'lucide-react'

interface ChatPageProps {
  appointments: ApiAppointment[]
  currentSenderType: 'user' | 'doctor'
  currentSenderId: number
  initialAppointmentId?: number | null
  onAppointmentCompleted?: (appointmentId: number) => void
}

function ChatPageContent({
  appointments: initialAppointments,
  currentSenderType,
  currentSenderId,
  initialAppointmentId,
  onAppointmentCompleted,
}: ChatPageProps) {
  const [appointments, setAppointments] = useState(initialAppointments)
  
  // Find initial appointment if provided
  const initialAppointment = initialAppointmentId 
    ? appointments.find(a => a.id === initialAppointmentId) || null
    : null
  
  const [selectedAppointment, setSelectedAppointment] = useState<ApiAppointment | null>(initialAppointment)
  
  // Handle appointment completion - update local state
  const handleAppointmentCompleted = useCallback((appointmentId: number) => {
    setAppointments(prev => 
      prev.map(a => a.id === appointmentId ? { ...a, status: 'completed' as const } : a)
    )
    if (selectedAppointment?.id === appointmentId) {
      setSelectedAppointment(prev => prev ? { ...prev, status: 'completed' as const } : null)
    }
    onAppointmentCompleted?.(appointmentId)
  }, [selectedAppointment?.id, onAppointmentCompleted])
  const [isMobileView, setIsMobileView] = useState(false)
  const { isConnected, joinRoom } = useSocket()

  // Check if mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Join all appointment rooms on connection
  useEffect(() => {
    if (isConnected) {
      appointments.forEach((appt) => {
        joinRoom(appt.id)
      })
    }
  }, [isConnected, appointments, joinRoom])

  const handleSelectAppointment = (appointment: ApiAppointment) => {
    setSelectedAppointment(appointment)
  }

  const handleBack = () => {
    setSelectedAppointment(null)
  }

  // Mobile view: show either sidebar or chat window
  if (isMobileView) {
    if (selectedAppointment) {
      return (
        <div className="h-full">
          <ChatWindow
            appointment={selectedAppointment}
            currentSenderType={currentSenderType}
            currentSenderId={currentSenderId}
            onBack={handleBack}
            onAppointmentCompleted={handleAppointmentCompleted}
          />
        </div>
      )
    }

    return (
      <div className="h-full">
        <ChatSidebar
          appointments={appointments}
          selectedAppointmentId={null}
          onSelectAppointment={handleSelectAppointment}
          currentSenderType={currentSenderType}
        />
      </div>
    )
  }

  // Desktop view: sidebar + chat window
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 border-r border-border shrink-0 bg-card">
        <ChatSidebar
          appointments={appointments}
          selectedAppointmentId={selectedAppointment?.id || null}
          onSelectAppointment={handleSelectAppointment}
          currentSenderType={currentSenderType}
        />
      </div>

      {/* Chat window or placeholder */}
      <div className="flex-1 min-w-0">
        {selectedAppointment ? (
          <ChatWindow
            appointment={selectedAppointment}
            currentSenderType={currentSenderType}
            currentSenderId={currentSenderId}
            onAppointmentCompleted={handleAppointmentCompleted}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Выберите диалог
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Выберите консультацию из списка слева, чтобы начать общение
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function ChatPage(props: ChatPageProps) {
  return (
    <SocketProvider 
      currentSenderType={props.currentSenderType} 
      currentSenderId={props.currentSenderId}
    >
      <ChatPageContent {...props} />
    </SocketProvider>
  )
}
