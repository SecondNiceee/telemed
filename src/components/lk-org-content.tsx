"use client"

import { useState, useCallback, useEffect } from "react"
import { Calendar, Clock, CheckCircle, Search, ChevronLeft, ChevronRight, Loader2, Video } from "lucide-react"
import Link from "next/link"
import { DoctorsApi } from "@/lib/api/doctors"
import type { ApiDoctor } from "@/lib/api/types"
import type { OrgStats } from "@/app/(frontend)/lk-org/page"
import { OrgPageHeader } from "@/components/lk-org/OrgPageHeader"
import { DoctorsListHeader } from "@/components/lk-org/DoctorsListHeader"
import { EmptyDoctorsList } from "@/components/lk-org/EmptyDoctorsList"
import { OrgDoctorCard } from "@/components/lk-org/OrgDoctorCard"
import { DeleteDoctorDialog } from "@/components/lk-org/DeleteDoctorDialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface LkOrgContentProps {
  userName: string
  initialDoctors: ApiDoctor[]
  orgId: number
  stats: OrgStats
}

const DOCTORS_PER_PAGE = 10

export function LkOrgContent({ userName, initialDoctors, orgId, stats }: LkOrgContentProps) {
  const [deleteDoctor, setDeleteDoctor] = useState<ApiDoctor | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Pagination & search state
  const [doctors, setDoctors] = useState<ApiDoctor[]>(initialDoctors)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocs, setTotalDocs] = useState(initialDoctors.length)
  const [isLoading, setIsLoading] = useState(false)
  const [refetchTrigger, setRefetchTrigger] = useState(0)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setCurrentPage(1) // Reset to first page on search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch doctors when page or search changes
  useEffect(() => {
    async function fetchDoctors() {
      setIsLoading(true)
      try {
        const response = await DoctorsApi.fetchByOrganisationPaginated(orgId, {
          page: currentPage,
          limit: DOCTORS_PER_PAGE,
          search: debouncedSearch || undefined,
        })
        setDoctors(response.docs)
        setTotalPages(response.totalPages)
        setTotalDocs(response.totalDocs)
      } catch (error) {
        console.error("Failed to fetch doctors:", error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchDoctors()
  }, [orgId, currentPage, debouncedSearch, refetchTrigger])

  const handleDeleteRequest = useCallback((doctor: ApiDoctor) => {
    setDeleteDoctor(doctor)
  }, [])

  const handleDeleteCancel = useCallback(() => {
    setDeleteDoctor(null)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDoctor) return
    setIsDeleting(true)
    try {
      await DoctorsApi.delete(deleteDoctor.id)
      setDeleteDoctor(null)
      setRefetchTrigger((t) => t + 1) // Trigger refetch
    } catch (err) {
      alert(err instanceof Error ? err.message : "Не удалось удалить врача")
    } finally {
      setIsDeleting(false)
    }
  }, [deleteDoctor])

  return (
    <div className="flex-1">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <OrgPageHeader userName={userName} />

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link
            href="/lk-org/consultations?sort=all"
            className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Всего консультаций</p>
              </div>
            </div>
          </Link>
          <Link
            href="/lk-org/consultations?sort=now"
            className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4 shadow-sm hover:shadow-md hover:border-orange-500/60 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Текущих</p>
              </div>
            </div>
          </Link>
          <Link
            href="/lk-org/consultations?sort=future"
            className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-blue-500/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.upcoming}</p>
                <p className="text-xs text-muted-foreground">Предстоящих</p>
              </div>
            </div>
          </Link>
          <Link
            href="/lk-org/consultations?sort=past"
            className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-green-500/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.past}</p>
                <p className="text-xs text-muted-foreground">Прошедших</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <DoctorsListHeader count={totalDocs} />
            
            {/* Search Input */}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Поиск по имени..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : doctors.length === 0 ? (
            debouncedSearch ? (
              <div className="text-center py-12 text-muted-foreground">
                По запросу &quot;{debouncedSearch}&quot; врачи не найдены
              </div>
            ) : (
              <EmptyDoctorsList />
            )
          ) : (
            <div className="flex flex-col gap-3">
              {doctors.map((doctor) => (
                <OrgDoctorCard
                  key={doctor.id}
                  doctor={doctor}
                  onDeleteRequest={handleDeleteRequest}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4">
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

      <DeleteDoctorDialog
        doctor={deleteDoctor}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  )
}
