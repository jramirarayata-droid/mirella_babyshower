import {
  CameraOff,
  Car,
  Church,
  Clock,
  Gift,
  Heart,
  Hotel,
  Info,
  MapPin,
  Music,
  ParkingCircle,
  Shirt,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react'
import type { SectionIconName } from '../../types/wedding'

const ICONS: Record<SectionIconName, LucideIcon> = {
  shirt: Shirt,
  church: Church,
  wine: Wine,
  'camera-off': CameraOff,
  gift: Gift,
  car: Car,
  hotel: Hotel,
  clock: Clock,
  parking: ParkingCircle,
  info: Info,
  heart: Heart,
  music: Music,
  utensils: UtensilsCrossed,
  'map-pin': MapPin,
}

export function SectionIcon({ name, className }: { name: SectionIconName; className?: string }) {
  const Icon = ICONS[name] ?? Info
  return <Icon aria-hidden="true" className={className} strokeWidth={1.25} />
}
