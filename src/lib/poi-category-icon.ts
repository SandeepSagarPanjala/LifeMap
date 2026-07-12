import type { LucideIcon } from 'lucide-react-native';
import {
  Anchor,
  Banknote,
  Beer,
  Building2,
  Bus,
  Car,
  Caravan,
  Castle,
  Clapperboard,
  Coffee,
  Croissant,
  Dumbbell,
  FerrisWheel,
  Fish,
  Flag,
  Flame,
  Fuel,
  Goal,
  Hospital,
  Hotel,
  Kayak,
  Landmark,
  Library,
  Mail,
  Mailbox,
  MapPin,
  Mountain,
  Music,
  Orbit,
  PawPrint,
  PersonStanding,
  Pill,
  Plane,
  PlugZap,
  School,
  Shield,
  Shirt,
  ShoppingCart,
  Snowflake,
  Sparkles,
  SquareParking,
  Store,
  Tent,
  Toilet,
  Trees,
  Trophy,
  Umbrella,
  University,
  Users,
  UtensilsCrossed,
  Volleyball,
  Wind,
  Wine,
  Wrench,
} from 'lucide-react-native';

/** Strip `MKPOICategory` prefix → `Restaurant` */
export function normalizePoiCategoryKey(
  category: string | null | undefined,
): string | null {
  if (!category?.trim()) {
    return null;
  }
  const trimmed = category.trim();
  const withoutPrefix = trimmed.startsWith('MKPOICategory')
    ? trimmed.slice('MKPOICategory'.length)
    : trimmed;
  const key = withoutPrefix.trim();
  return key.length > 0 ? key : null;
}

function categoryLookupKey(raw: string): string {
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  museum: Landmark,
  musicVenue: Music,
  theater: Clapperboard,
  library: Library,
  planetarium: Orbit,
  school: School,
  university: University,
  movieTheater: Clapperboard,
  nightlife: Wine,
  fireStation: Flame,
  hospital: Hospital,
  pharmacy: Pill,
  police: Shield,
  castle: Castle,
  fortress: Castle,
  landmark: Landmark,
  nationalMonument: Landmark,
  bakery: Croissant,
  brewery: Beer,
  cafe: Coffee,
  distillery: Wine,
  foodMarket: ShoppingCart,
  restaurant: UtensilsCrossed,
  winery: Wine,
  animalService: PawPrint,
  atm: Banknote,
  automotiveRepair: Wrench,
  bank: Landmark,
  beauty: Sparkles,
  evCharger: PlugZap,
  fitnessCenter: Dumbbell,
  laundry: Shirt,
  mailbox: Mailbox,
  postOffice: Mail,
  restroom: Toilet,
  spa: Sparkles,
  store: Store,
  amusementPark: FerrisWheel,
  aquarium: Fish,
  beach: Umbrella,
  campground: Tent,
  fairground: FerrisWheel,
  marina: Anchor,
  nationalPark: Trees,
  park: Trees,
  rvPark: Caravan,
  zoo: PawPrint,
  baseball: Trophy,
  basketball: Trophy,
  bowling: Trophy,
  goKart: Car,
  golf: Flag,
  hiking: Mountain,
  miniGolf: Flag,
  rockClimbing: Mountain,
  skatePark: PersonStanding,
  skating: PersonStanding,
  skiing: Snowflake,
  soccer: Goal,
  stadium: Landmark,
  tennis: Trophy,
  volleyball: Volleyball,
  airport: Plane,
  carRental: Car,
  conventionCenter: Users,
  gasStation: Fuel,
  hotel: Hotel,
  parking: SquareParking,
  publicTransport: Bus,
  fishing: Fish,
  kayaking: Kayak,
  surfing: Wind,
  swimming: PersonStanding,
};

/**
 * Lucide icon for a MapKit POI category.
 * Missing / unknown category → MapPin (current pin fallback).
 */
export function poiCategoryLucideIcon(
  category: string | null | undefined,
): LucideIcon {
  const raw = normalizePoiCategoryKey(category);
  if (!raw) {
    return MapPin;
  }
  return CATEGORY_ICONS[categoryLookupKey(raw)] ?? MapPin;
}
