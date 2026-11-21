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
  space: { id: number; name: string; slug: string; type: SpaceType } | null;
  /** Null when the author left the community (the post shows as deleted by its author). */
  author: PostAuthor | null;
  deleted_by_author: boolean;
  type: PostType;
  body: string | null;
  payload: TestamentPayload | ProgramPayload | AyahPayload | HadithPayload | EventPayload | null;
  audience: Audience;
  status: 'published' | 'pending' | 'hidden';
  edited_at: string | null;
  created_at: string;
  imports_count: number;
  /** Comments of the viewer's own gender only. */
  comments_count: number;
  saved: boolean;
  mine: boolean;
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

/** Always the server's Quran text, never what a member typed. */
export interface AyahPayload {
  surah: number;
  from: number;
  to: number;
  surah_name: string;
  ayat: { number: number; text: string }[];
}

/** An event or lesson; times are UTC ISO strings, shown in the phone's own time zone. */
export interface EventPayload {
  title: string;
  starts_at: string;
  ends_at: string | null;
  place: string | null;
  link: string | null;
  details: string | null;
}

export interface HadithPayload {
  text: string;
  book: string;
  number: string;
  grade?: string | null;
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

export type SpaceType = 'group' | 'page';
export type SpaceRole = 'owner' | 'moderator' | 'member' | 'follower';
export type SpaceMemberStatus = 'active' | 'pending' | 'banned';

/** A group or page as listed. `audience` is always 'gender' for a group. */
export interface SpaceSummary {
  id: number;
  type: SpaceType;
  name: string;
  slug: string;
  purpose: string;
  audience: 'everyone' | 'gender';
  join_policy: 'open' | 'approval' | null;
  members_count: number | null;
  my_role: SpaceRole | null;
  my_status: SpaceMemberStatus | null;
}

export interface SpaceDetail extends SpaceSummary {
  goals: string;
  content_plan: string;
  owner: { id: number; first_name: string; last_name: string };
  posting_public: boolean;
  posting_gender: 'any' | Gender;
  posting_requires_approval: boolean;
  members_count: number;
  can_post: boolean;
  can_manage: boolean;
}

export interface SpaceMemberItem {
  id: number;
  role: SpaceRole;
  status: SpaceMemberStatus;
  joined_at: string;
  profile: PostAuthor | null;
}

export type SpaceRequestStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested';

export interface SpaceRequestInput {
  type: SpaceType;
  name: string;
  purpose: string;
  goals: string;
  content_plan: string;
  join_policy: 'open' | 'approval' | null;
  audience: 'everyone' | 'gender' | null;
}

export interface SpaceRequestItem extends SpaceRequestInput {
  id: number;
  status: SpaceRequestStatus;
  admin_note: string | null;
  created_at: string;
}

/** A comment among the viewer's gender; the app builds the reply tree from parent_id. */
export interface CommunityComment {
  id: number;
  parent_id: number | null;
  body: string | null;
  deleted: boolean;
  author: { id: number; first_name: string; last_name: string } | null;
  mine: boolean;
  edited_at: string | null;
  created_at: string;
}

export type ReportTarget = 'post' | 'comment' | 'profile' | 'space' | 'fatwa' | 'fatwa_question';
export type ReportReason = 'off_purpose' | 'fitna' | 'haram' | 'hadith_source' | 'ads' | 'fake_name' | 'abuse' | 'other';

/** What a member writes; the server fills an ayah card's text. */
export type NewPost =
  | { type: 'text'; body: string; audience?: Audience }
  | { type: 'ayah'; body?: string; audience?: Audience; payload: { surah: number; from: number; to: number } }
  | { type: 'hadith'; body?: string; audience?: Audience; payload: Omit<HadithPayload, 'grade'> & { grade?: string } }
  | { type: 'testament'; body?: string; audience?: Audience; payload: Omit<TestamentPayload, 'template_id'> }
  | { type: 'program'; body?: string; audience?: Audience; payload: Omit<ProgramPayload, 'template_id'> }
  | { type: 'event'; body?: string; audience?: Audience; payload: Omit<EventPayload, 'ends_at' | 'place' | 'link' | 'details'> & Partial<EventPayload> };

/** A trusted shaykh: manhaj and marja' are public. Female shaykhs are listed for women only. */
export interface ShaykhProfile {
  id: number;
  first_name: string;
  last_name: string;
  gender: Gender;
  manhaj: string;
  marja: string;
  studies: string | null;
  ijazat: string | null;
  teachers: string | null;
  institution: string | null;
  teaching: string | null;
  trusted_at: string;
  fatwas_count?: number;
}

export type TrustFields = Pick<ShaykhProfile, 'manhaj' | 'marja' | 'studies' | 'ijazat' | 'teachers' | 'institution' | 'teaching'>;

export interface TrustRequest extends TrustFields {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
}

/** A published fatwa; the asker only as their gender, when they chose to show it. */
export interface PublishedFatwa {
  id: number;
  question: string;
  answer: string;
  published_at: string;
  asker_gender: Gender | null;
  shaykh: { id: number; first_name: string; last_name: string; manhaj: string; marja: string };
}

export interface FatwaPublicationDraft {
  id: number;
  question_text: string;
  answer_text: string;
  shaykh_approved_at: string | null;
  asker_approved_at: string | null;
  published_at: string | null;
}

export type ThreadStatus = 'open' | 'answered' | 'declined' | 'referred';

/** What a shaykh sees of a question: never who asked. */
export interface QuestionForShaykh {
  id: number;
  body: string;
  status: 'open' | 'answered' | 'closed';
  asker_gender: Gender | null;
  targeted: boolean;
  created_at: string;
}

export interface FatwaThreadSummary {
  id: number;
  role: 'asker' | 'shaykh';
  status: ThreadStatus;
  last_message_at: string | null;
  question: { id: number; body: string; status: string; asker_gender?: Gender | null };
  shaykh: ShaykhProfile | null;
  publication: FatwaPublicationDraft | null;
}

export interface FatwaThreadDetail extends FatwaThreadSummary {
  messages: { id: number; from: 'asker' | 'shaykh'; body: string; created_at: string }[];
}

export interface MyQuestion {
  id: number;
  body: string;
  status: 'open' | 'answered' | 'closed';
  shaykh_gender: Gender;
  show_asker_gender: boolean;
  target_shaykh: ShaykhProfile | null;
  created_at: string;
  threads: FatwaThreadSummary[];
}
