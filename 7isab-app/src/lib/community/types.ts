export type PostType = 'text' | 'ayah' | 'hadith' | 'testament' | 'program' | 'event';

export type Audience = 'own_gender' | 'everyone';

export interface CommunityProfile {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female';
  status: MemberStatus;
  joined_at?: string | null;
}

export type MemberStatus = 'active' | 'suspended' | 'left' | 'banned';

export type Gender = 'male' | 'female';

/** A rule shown on its own screen when joining; texts in every app language. */
export interface CommunityRule {
  key: string;
  version: number;
  texts: { ar: string; en: string; fr: string };
}

export type RuleAcceptance = Pick<CommunityRule, 'key' | 'version'>;

/** GET community/me: no profile until the user joins. */
export interface Membership {
  profile: Omit<CommunityProfile, 'user_id'> | null;
  /** Rules (new or changed) an active member must accept before taking part. */
  pending_rules: CommunityRule[];
}

/** A task inside a shared program (imported as a custom task). */
export interface SharedTask {
  name: string;
  type: string;
  reward?: number;
}

/** What the server shares about a post's author: names and gender only. */
export type PostAuthor = Pick<CommunityProfile, 'id' | 'first_name' | 'last_name' | 'gender'>;

export interface CommunityPost {
  id: number;
  space_id: number;
  author_id: number;
  author?: PostAuthor | null;
  imports_count?: number;
  type: PostType;
  body: string;
  payload: TestamentPayload | ProgramPayload | AyahPayload | HadithPayload | null;
  audience: Audience;
  status: 'published' | 'pending' | 'hidden';
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestamentPayload {
  template_id?: number;
  category: 'jannah' | 'nar' | 'akhira' | 'dunya' | 'athkar';
  text: string;
  source?: string;
}

export interface ProgramPayload {
  template_id?: number;
  name: string;
  category: 'improving' | 'healing' | 'custom';
  custom_category?: string;
  goal: string;
  length: number;
  tasks: SharedTask[];
}

export interface AyahPayload {
  surah: number;
  ayah: number;
  text: string;
  reference: string;
}

export interface HadithPayload {
  book: string;
  number: string;
  text: string;
  source: string;
}

export interface TestamentTemplate {
  id: number;
  author_id: number;
  category: 'jannah' | 'nar' | 'akhira' | 'dunya' | 'athkar';
  text: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

export interface ProgramTemplate {
  id: number;
  author_id: number;
  name: string;
  category: 'improving' | 'healing' | 'custom';
  custom_category?: string;
  goal: string;
  length: number;
  tasks: SharedTask[];
  created_at: string;
  updated_at: string;
}

export interface PostPage {
  posts: CommunityPost[];
  has_more: boolean;
}

export interface ImportResult {
  payload: TestamentPayload | ProgramPayload | null;
  imports_count: number;
}
