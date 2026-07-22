// The shape and defaults of course.json — pure data, importable from
// browser code too. Reading the actual file is node-only and lives in
// course-config.ts.

export interface CourseConfig {
  student: string;
  country: string;
  /** Currency ticker of the student's country, e.g. "CZK". */
  currency: string;
  /** Decimal places of the currency: 2 for CZK (cents), 0 for JPY. */
  decimals: number;
  /** Course server address. */
  dashboard: string;
}

/** The hosted course server; prefilled so submissions work out of the box. */
export const DEFAULT_COURSE_SERVER = 'https://discover-2026.pazderka.dev';

export const COURSE_DEFAULTS: CourseConfig = {
  student: '',
  country: '',
  currency: '',
  decimals: 2,
  dashboard: DEFAULT_COURSE_SERVER,
};
