"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowLeft,
  Calendar,
  Clock,
  Video,
  CheckCircle,
  User,
  Stethoscope,
  Download,
  XCircle,
} from "lucide-react"
import { AppointmentsApi } from "@/lib/api/appointments"
import { exportConsultationsToExcel } from "@/lib/export-consultations"
import type { ApiAppointment } from "@/lib/api/types"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface OrgConsultationsContentProps {
  orgId: number
  orgName: string
  doctorIds: number[]
  initialSort: 'all' | 'future' | 'past' | 'cancelled'
}

type SortType = 'all' | 'future' | 'past' | 'cancelled'

const CONSULTATIONS_PER_PAGE = 10

const sortLabels: Record<SortType, string> = {
  all: 'Все консультации',
  future: 'Предстоящие',
  past: 'Прошедшие',
  cancelled: 'Отменённые',
}

const sortIcons: Record<SortType, React.ReactNode> = {
  all: <Calendar className="w-4 h-4" />,
  future: <Clock className="w-4 h-4" />,
  past: <CheckCircle className="w-4 h-4" />,
  cancelled: <XCircle className="w-4 h-4" />,
}

export function OrgConsultationsContent({
  orgName,
  doctorIds,
  initialSort,
}: OrgConsultationsContentProps) {
  const router = useRouter()
  
  const [consultations, setConsultations] = useState<ApiAppointment[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [activeSort, setActiveSort] = useState<SortType>(initialSort)
  const [isExporting, setIsExporting] = useState(false)
  
  // Track if this is the initial mount to avoid double fetch
  const isInitialMount = useRef(true)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch consultations
  useEffect(() => {
    async function fetchConsultations() {
      if (doctorIds.length === 0) {
        setConsultations([])
        setTotalPages(0)
        setTotalDocs(0)
        setIsLoading(false)
        return
      }
      
      setIsLoading(true)
      try {
        const response = await AppointmentsApi.fetchByDoctorsPaginated(doctorIds, {
          page: currentPage,
          limit: CONSULTATIONS_PER_PAGE,
          search: debouncedSearch || undefined,
          sort: activeSort,
        })
        setConsultations(response.docs)
        setTotalPages(response.totalPages)
        setTotalDocs(response.totalDocs)
      } catch (error) {
        console.error("Failed to fetch consultations:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchConsultations()
  }, [doctorIds, currentPage, debouncedSearch, activeSort])

  const handleSortChange = useCallback((sort: SortType) => {
    if (sort === activeSort) return // Don't refetch if same sort
    setActiveSort(sort)
    setCurrentPage(1)
    // Update URL without triggering navigation/refetch
    window.history.replaceState(null, '', `/lk-org/consultations?sort=${sort}`)
  }, [activeSort])

  const handleExport = async () => {
    if (consultations.length === 0) return
    
    setIsExporting(true)
    try {
      // Create a map of doctor durations (default 30 minutes if not available)
      const doctorDurations: Record<number, number> = {}
      consultations.forEach((consultation) => {
        if (consultation.doctor && typeof consultation.doctor === 'object' && consultation.doctor.id) {
          doctorDurations[consultation.doctor.id] = 30 // Default duration
        }
      })

      const sortLabel = sortLabels[activeSort]
      const timestamp = new Date().toLocaleDateString('ru-RU')
      const filename = `consultations_${activeSort}_${timestamp}.xlsx`
      
      exportConsultationsToExcel(consultations, doctorDurations, filename)
    } catch (error) {
      console.error("Failed to export consultations:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const getStatusBadge = (appointment: ApiAppointment) => {
    switch (appointment.status) {
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-teal/10 text-teal border border-teal/25">
            <Video className="w-3 h-3" />
            В процессе
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            <CheckCircle className="w-3 h-3" />
            Завершена
          </span>
        )
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/25">
            <Clock className="w-3 h-3" />
            Запланирована
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/25">
            <XCircle className="w-3 h-3" />
            Отменена
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex-1">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/lk-org"
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Консультации</h1>
            <p className="text-sm text-muted-foreground">{orgName}</p>
          </div>
        </div>

        {/* Sort Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(Object.keys(sortLabels) as SortType[]).map((sort) => (
            <button
              key={sort}
              onClick={() => handleSortChange(sort)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                "border shadow-sm hover:shadow-md hover:-translate-y-0.5",
                activeSort === sort
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:border-primary/50"
              )}
            >
              {sortIcons[sort]}
              {sortLabels[sort]}
            </button>
          ))}
        </div>

        {/* Search and Export */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Поиск по имени врача или пациента..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            onClick={handleExport}
            disabled={consultations.length === 0 || isExporting}
            className="gap-2"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? 'Экспортирую...' : 'Экспорт в Excel'}
          </Button>
        </div>

        {/* Results Count */}
        <p className="text-sm text-muted-foreground mb-4">
          Найдено консультаций: {totalDocs}
        </p>

        {/* Consultations List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : consultations.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-border bg-card">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {debouncedSearch
                ? `По запросу "${debouncedSearch}" консультации не найдены`
                : "Консультации не найдены"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {consultations.map((consultation) => (
              <Link
                key={consultation.id}
                href={`/lk-org/consultation?id=${consultation.id}`}
                className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all block"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusBadge(consultation)}
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                      <div className="flex items-center gap-2 text-foreground">
                        <Stethoscope className="w-4 h-4 text-primary" />
                        <span className="font-medium">{consultation.doctorName || 'Врач'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span>{consultation.userName || 'Пациент'}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(consultation.date)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>{consultation.time}</span>
                      </div>
                    </div>
                    
                    {consultation.specialty && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {consultation.specialty}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {consultation.price && (
                      <p className="text-lg font-semibold text-foreground">
                        {consultation.price.toLocaleString('ru-RU')} &#8381;
                      </p>
                    )}
                    <ArrowRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isLoading}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              {currentPage} из {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || isLoading}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
