/**
 * Shared types for the risk engine, the weather code and the views. They describe the shapes
 * written out in the spec 1 design (Conditions, Place, risk result, factor, city, replay night).
 * Types only: nothing here runs.
 */

export type RiskLevel = 'low' | 'elevated' | 'high';
export type Season = 'spring' | 'fall';
export type NightPartName = 'early' | 'middle' | 'late';
/** Where data came from (R7). Anything missing counts as `sample`. */
export type DataSource = 'live' | 'replay' | 'sample';
export type BadgeTone = DataSource | 'notice';
export type TreatmentStatus = 'none' | 'partial' | 'full';

/** One reading of the weather, averaged over part of a night. Any field can be missing. */
export interface WeatherReading {
  windFromDegrees?: number;
  windSpeedMps?: number;
  lowCloudPercent?: number;
  visibilityKm?: number;
}

/** A value for each part of the night. A part with no data is missing or null. */
export type ByPart<T> = Partial<Record<NightPartName, T | null | undefined>>;

/** Weather for a night: per part, or one reading used for the whole night (R37). */
export type NightWeather = ByPart<WeatherReading> | WeatherReading;

/** Migration level from 0 to 1: per part, or one `level` for the whole night. */
export interface Migration extends ByPart<number> {
  level?: number;
  source?: DataSource;
}

export interface PreviousNight {
  migration?: Migration;
  weather?: NightWeather;
}

/** What the engine reads about one night. */
export interface Conditions {
  night: string;
  migration?: Migration;
  weather?: NightWeather;
  previousNights?: PreviousNight[];
}

/** One building, venue or route. Every field except the id can be missing. */
export interface Place {
  id: string | number;
  kind?: string;
  lit?: boolean;
  litGlassArea?: number;
  treeNear?: boolean;
  heightMeters?: number;
  lakeDistanceMeters?: number | null;
  birdSafeTreatment?: string;
}

export type FactorGroup = 'migration' | 'weather' | 'carryOver' | 'season' | 'light' | 'place';

/** What one factor returns. Points are internal and never shown (R9). */
export interface FactorOutput {
  id: string;
  group: FactorGroup;
  points: number;
  reasonKey: string | null;
  missing: string[];
}

interface FactorBase {
  id: string;
  group: FactorGroup;
  evidence: string[];
  reasonKeys: string[];
}

export interface NightFactor extends FactorBase {
  evaluate(conditions: Conditions, config: RiskConfig): FactorOutput;
}

export interface PlaceFactor extends FactorBase {
  evaluate(place: Place, conditions: Conditions, config: RiskConfig): FactorOutput;
}

export interface FactorEntry {
  factor: NightFactor | PlaceFactor;
  output: FactorOutput;
}

export interface TraceLine {
  factorId: string;
  group: FactorGroup;
  contribution: number;
  evidence: string[];
}

export interface RiskResult {
  level: RiskLevel;
  reasons: string[];
  missingInputs: string[];
  configVersion: string;
  trace: TraceLine[];
  /** For ranking and tests only. The interface must never show these numbers (R9, R34). */
  internal: {
    totalPoints: number;
    lightMultiplier: number;
    treatmentMultiplier: number;
    levelBeforeAdjustments: RiskLevel;
  };
}

export interface Thresholds {
  elevated: number;
  high: number;
}

export interface ConfigNote {
  date: string;
  change: string;
  evidence: string[];
}

/** A weight entry in the config. */
export interface WeightEntry {
  weight: number;
  evidence: string[];
}

export type WeightName =
  | 'migration'
  | 'wind'
  | 'windShift'
  | 'visibility'
  | 'carryOver'
  | 'fallBonus'
  | 'litGlass'
  | 'tree'
  | 'stadium'
  | 'height'
  | 'lakeshore';

/** The weights, with the extra settings some entries carry (see risk-config.ts). */
export type Weights = Record<WeightName, WeightEntry> & {
  litGlass: WeightEntry & { reasonAbove: number };
  stadium: WeightEntry & { kinds: string[] };
  height: WeightEntry & { fullAtMeters: number };
  lakeshore: WeightEntry & { maxDistanceMeters: number };
};

export type Sector = [number, number];

/** The risk config (R30). Plain data, safe to turn into JSON. */
export interface RiskConfig {
  version: string;
  notes: ConfigNote[];
  thresholds: Thresholds;
  placeThresholds: Thresholds;
  migrationBands: { moderate: number; heavy: number };
  weights: Weights;
  nightParts: Record<NightPartName, number> & { evidence: string[] };
  lightMultiplier: {
    lowCloudAbovePercent: number;
    lowVisibilityBelowKm: number;
    cloudFactor: number;
    visibilityFactor: number;
    evidence: string[];
  };
  weatherOnly: {
    floorLevel: RiskLevel;
    capLevel: RiskLevel;
    floorMinPoints: number;
    evidence: string[];
  };
  treatmentDiscount: Record<TreatmentStatus, number> & { evidence: string[] };
  weatherScaling: { minimum: number; evidence: string[] };
  missingMigrationCap: RiskLevel;
  wind: {
    fall: { unfavorableFrom: Sector[] };
    spring: { unfavorableFrom: Sector[] };
    strongMps: number;
    lightWindFactor: number;
    evidence: string[];
  };
  seasons: Record<Season, [string, string]>;
  reasons: Record<string, string>;
}

/** A change to the config: any part of it can be left out (R33). */
export type RiskConfigOverrides = DeepPartial<RiskConfig>;

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> }
    : T;

export interface Badge {
  text: string;
  tone: BadgeTone;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

/** Where the weather code looks: a place plus its time zone. */
export interface Location extends Coordinate {
  name?: string;
  timeZone: string;
}

export interface Shoreline {
  source: 'sample' | 'map';
  note?: string;
  points: Coordinate[];
}

export interface City {
  id: string;
  name: string;
  center: Coordinate;
  timeZone: string;
  riskOverrides?: RiskConfigOverrides;
  riskLabel?: string;
  shoreline?: Shoreline | null;
}

/** A saved replay night (R26). `reference` holds survey counts for checking only, never shown. */
export interface ReplayNight {
  id: string;
  night: string;
  season: Season;
  kind: string;
  source: DataSource;
  label: string;
  migration: Migration;
  weather: ByPart<WeatherReading>;
  weatherSource: string;
  weatherSavedOn: string;
  liveWeather: boolean;
  note: string;
  links?: { migrationDashboard?: string; report?: string };
  reference?: { surveyDate: string; birdsFound: number; litShare: number };
}

/** What the weather client returns (R27 to R29). */
export interface WeatherResult {
  weather: ByPart<WeatherReading> | undefined;
  notes: string[];
  source: 'live' | 'saved' | 'unavailable';
  label: string;
  provider?: string | null;
  savedOn?: string;
  night?: string;
  error?: { reason: string; status?: number };
}

export interface CreditEntry {
  id: string;
  text: string;
  href?: string;
}
/** A point on a footprint ring: [longitude, latitude] in degrees (the GeoJSON order). */
export type RingPoint = [number, number];
/** One building from a map source (spec 2 R3, R4). Missing values stay missing. */
export interface BuildingRecord {
  /** Stable ID from the source data (the Overture ID). */
  id: string;
  osmId?: string;
  name?: string;
  /** A closed ring: the first and last points are the same. */
  footprint: RingPoint[];
  centroid: Coordinate;
  heightMeters?: number;
  kind?: string;
  source: 'map' | 'sample';
  /** Every source that contributed to this record (spec 2 R32). */
  sources: string[];
}
