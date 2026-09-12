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
}

export interface Bundle {
  generated_at: string;
  count: number;
  hackathons: Hackathon[];
}
