import {
  Stethoscope,
  Heart,
  Brain,
  Eye,
  Ear,
  Bone,
  Baby,
  Smile,
  Activity,
  Thermometer,
  Shield,
  Syringe,
  Pill,
  Microscope,
  HeartPulse,
  Dna,
  FlaskConical,
  Radiation,
  Scissors,
  Bandage,
  Plus as CrossIcon,
  HandHeart,
  Wind,
  PersonStanding,
  UserRound,
  Bed,
  ClipboardList,
  LucideIcon,
} from "lucide-react"
import type { ApiCategory, ApiMedia } from "@/lib/api/types"

// Map of icon names to Lucide components
export const CATEGORY_ICON_OPTIONS = [
  { value: "stethoscope", label: "Стетоскоп" },
  { value: "heart", label: "Сердце" },
  { value: "heart-pulse", label: "Пульс" },
  { value: "brain", label: "Мозг" },
  { value: "eye", label: "Глаз" },
  { value: "ear", label: "Ухо" },
  { value: "bone", label: "Кость" },
  { value: "baby", label: "Педиатрия" },
  { value: "smile", label: "Улыбка" },
  { value: "activity", label: "Активность" },
  { value: "thermometer", label: "Термометр" },
  { value: "shield", label: "Защита" },
  { value: "syringe", label: "Шприц" },
  { value: "pill", label: "Таблетка" },
  { value: "microscope", label: "Микроскоп" },
  { value: "dna", label: "ДНК" },
  { value: "flask-conical", label: "Лаборатория" },
  { value: "radiation", label: "Радиология" },
  { value: "scissors", label: "Хирургия" },
  { value: "bandage", label: "Повязка" },
  { value: "cross", label: "Медицина" },
  { value: "hand-heart", label: "Забота" },
  { value: "wind", label: "Дыхание" },
  { value: "person-standing", label: "Человек" },
  { value: "user-round", label: "Пациент" },
  { value: "bed", label: "Стационар" },
  { value: "clipboard-list", label: "Карта" },
] as const

const ICON_MAP: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  heart: Heart,
  "heart-pulse": HeartPulse,
  brain: Brain,
  eye: Eye,
  ear: Ear,
  bone: Bone,
  baby: Baby,
  smile: Smile,
  activity: Activity,
  thermometer: Thermometer,
  shield: Shield,
  syringe: Syringe,
  pill: Pill,
  microscope: Microscope,
  dna: Dna,
  "flask-conical": FlaskConical,
  radiation: Radiation,
  scissors: Scissors,
  bandage: Bandage,
  cross: CrossIcon,
  "hand-heart": HandHeart,
  wind: Wind,
  "person-standing": PersonStanding,
  "user-round": UserRound,
  bed: Bed,
  "clipboard-list": ClipboardList,
}

/**
 * Get Lucide icon component by name
 */
export function getLucideIcon(iconName: string | null | undefined): LucideIcon {
  if (!iconName) return Stethoscope
  return ICON_MAP[iconName] || Stethoscope
}

/**
 * Get icon image URL from category
 */
export function getCategoryIconImageUrl(category: ApiCategory): string | null {
  if (!category.iconImage) return null
  
  if (typeof category.iconImage === "number") {
    return null // Need to populate the iconImage to get URL
  }
  
  const media = category.iconImage as ApiMedia
  return media.url || null
}

/**
 * Render category icon - either Lucide icon or uploaded image
 */
export function CategoryIcon({
  category,
  className = "w-5 h-5",
  iconClassName = "text-primary",
}: {
  category: ApiCategory
  className?: string
  iconClassName?: string
}) {
  // Priority: iconImage > icon (lucide) > default Stethoscope
  const imageUrl = getCategoryIconImageUrl(category)
  
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={category.name}
        className={className + " object-contain"}
      />
    )
  }
  
  const Icon = getLucideIcon(category.icon)
  return <Icon className={`${className} ${iconClassName}`} />
}
