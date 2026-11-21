export type PostType = 'text' | 'ayah' | 'hadith' | 'testament' | 'program' | 'event';

export type Audience = 'own_gender' | 'everyone';

export interface CommunityProfile {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  gender: 'male' | 'female';
  status: 'active' | 'suspended' | 'left';
}

export interface CommunityPost {
  id: number;
  space_id: number;
  author_id: number;
  author?: CommunityProfile;
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
  tasks: Array<{
    name: string;
    type: string;
    reward?: number;
  }>;
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
  tasks: Array<{
    name: string;
    type: string;
    reward?: number;
  }>;
  created_at: string;
  updated_at: string;
}
