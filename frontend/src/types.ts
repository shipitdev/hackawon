export type Mode = "in_person" | "online" | "hybrid" | "unknown";

export interface Hackathon {
  uid: string;
  source: string;
  source_id: string;
  title: string;
  url: string;
  tagline: string | null;
  excerpt?: string;
  starts_at: string | null;
  ends_at: string | null;
  reg_opens_at: string | null;
  reg_deadline: string | null;
  mode: Mode;
  city: string | null;
  country: string | null;
  organiser: string | null;
  prize_amount: number | null;
  prize_currency: string | null;
  themes: string[];
  tracks: string[];
  sponsors: string[];
  team_min: number | null;
  team_max: number | null;
  participants_count: number | null;
  domains: string[];
  ideas?: Idea[];
  exemplars?: Exemplar[];
  grounding?: Grounding;
}

export interface Idea {
  title: string;
  pitch: string;
  why_it_could_win: string;
  stack: string[];
  track?: string;
  inspired_by: string[];
  build_hours?: number;
}

export interface Exemplar {
  uid: string;
  title: string;
  url: string;
  prize: string | null;
  hackathon_name: string | null;
  year: number | null;
  tech: string[];
}

export interface Grounding {
  exemplar_count: number;
  domains: string[];
  thin: boolean;
  patterns: string[];
}

export interface Domain {
  id: string;
  label: string;
  count: number;
}

export interface Bundle {
  generated_at: string;
  count: number;
  domains: Domain[];
  hackathons: Hackathon[];
}
