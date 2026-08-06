import XLSX from 'xlsx-js-style'
import type { ApiAppointment } from './api/types'

export interface ConsultationExportData {
  'Дата консультации': string
  'ФИО врача': string
  'Специальность': string
  'Стоимость (₽)': number
  'Длительность (мин)': number
  'ФИО пациента': string
  'Ссылка на консультацию': string
}

export function exportConsultationsToExcel(
  consultations: ApiAppointment[],
  doctorDurations: Record<number, number>,
  filename: string = 'consultations.xlsx'
) {
  const data: ConsultationExportData[] = consultations.map((consultation) => ({
    'Дата консультации': formatDate(consultation.date),
    'ФИО врача': consultation.doctorName || 'N/A',
    'Специальность': consultation.specialty || 'N/A',
    'Стоимость (₽)': consultation.price || 0,
    'Длительность (мин)': (typeof consultation.doctor === 'object' && consultation.doctor?.id ? doctorDurations[consultation.doctor.id] : 30) || 30,
    'ФИО пациента': consultation.userName || 'N/A',
    'Ссылка на консультацию': `${typeof window !== 'undefined' ? window.location.origin : ''}/lk-org/consultation?id=${consultation.id}`,
  }))

  const ws = XLSX.utils.json_to_sheet(data, {
    header: [
      'Дата консультации',
      'ФИО врача',
      'Специальность',
      'Стоимость (₽)',
      'Длительность (мин)',
      'ФИО пациента',
      'Ссылка на консультацию',
    ],
  })

  // Set column widths
  const colWidths = [20, 40, 20, 15, 18, 40, 56]
  ws['!cols'] = colWidths.map((width) => ({ wch: width }))

  // Set left alignment for Стоимость (col 3) and Длительность (col 4)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
      if (ws[cellAddress]) {
        // Header row (R = 0) - bold, gray background, center alignment
        if (R === 0) {
          ws[cellAddress].s = {
            font: { bold: true, color: { rgb: 'FFFFFF' } },
            fill: { fgColor: { rgb: '4472C4' } },
            alignment: {
              horizontal: 'center',
              vertical: 'center',
              wrapText: true,
            },
          }
        }
        // Data rows for columns 3 and 4 - left alignment
        else if ([3, 4].includes(C)) {
          ws[cellAddress].s = {
            alignment: {
              horizontal: 'left',
              vertical: 'center',
              wrapText: true,
            },
          }
        }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Консультации')
  XLSX.writeFile(wb, filename)
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateString
  }
}
