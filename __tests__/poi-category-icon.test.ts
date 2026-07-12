import {
  normalizePoiCategoryKey,
  poiCategoryLucideIcon,
} from '@/lib/poi-category-icon';
import { Banknote, Coffee, MapPin, PlugZap, Caravan } from 'lucide-react-native';

describe('poi-category-icon', () => {
  it('strips MKPOICategory prefix', () => {
    expect(normalizePoiCategoryKey('MKPOICategoryRestaurant')).toBe(
      'Restaurant',
    );
    expect(normalizePoiCategoryKey('MKPOICategoryATM')).toBe('ATM');
  });

  it('maps normal PascalCase and leading-acronym categories', () => {
    expect(poiCategoryLucideIcon('MKPOICategoryCafe')).toBe(Coffee);
    expect(poiCategoryLucideIcon('MKPOICategoryATM')).toBe(Banknote);
    expect(poiCategoryLucideIcon('MKPOICategoryEVCharger')).toBe(PlugZap);
    expect(poiCategoryLucideIcon('MKPOICategoryRVPark')).toBe(Caravan);
  });

  it('falls back to MapPin when unknown', () => {
    expect(poiCategoryLucideIcon(null)).toBe(MapPin);
    expect(poiCategoryLucideIcon('MKPOICategoryNotARealThing')).toBe(MapPin);
  });
});
