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
