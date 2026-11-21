import { apiRequest } from '@/lib/api/client';

import type {
  CommunityComment,
  FatwaThreadDetail,
  FatwaThreadSummary,
  MyQuestion,
  PublishedFatwa,
  QuestionForShaykh,
  ShaykhProfile,
  TrustFields,
  TrustRequest,
  CommunityPost,
  CommunityRule,
  Gender,
  ImportResult,
  Membership,
  NewPost,
  PostPage,
  ReportReason,
  ReportTarget,
  RuleAcceptance,
  SpaceDetail,
  SpaceMemberItem,
  SpaceMemberStatus,
  SpaceRequestInput,
  SpaceRequestItem,
  SpaceSummary,
  SpaceType,
} from './types';

// Rules and membership
export async function getCommunityRules(token: string | null) {
  return apiRequest<{ rules: CommunityRule[] }>('/community/rules', { token });
}

export async function getMembership(token: string | null) {
  return apiRequest<Membership>('/community/me', { token });
}

/** Gender only when joining for the first time: it is set once. */
export async function joinCommunity(
  token: string | null,
  data: { first_name: string; last_name: string; gender?: Gender; rule_acceptances: RuleAcceptance[] },
) {
  return apiRequest<{ profile: NonNullable<Membership['profile']> }>('/community/join', { token, method: 'POST', body: data });
}

export async function acceptRules(token: string | null, ruleAcceptances: RuleAcceptance[]) {
  return apiRequest<{ profile: NonNullable<Membership['profile']> }>('/community/rules/accept', {
    token,
    method: 'POST',
    body: { rule_acceptances: ruleAcceptances },
  });
}

export async function leaveCommunity(token: string | null) {
  return apiRequest('/community/leave', { token, method: 'POST', body: {} });
}

export async function updateCommunityProfile(token: string | null, data: { first_name: string; last_name: string }) {
  return apiRequest<{ profile: NonNullable<Membership['profile']> }>('/community/me', { token, method: 'PUT', body: data });
}

// Spaces
export async function listSpaces(token: string | null, params: { type?: SpaceType; scope?: 'mine' | 'discover'; search?: string }) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as [string, string][]).toString();
  return apiRequest<{ spaces: SpaceSummary[]; has_more: boolean }>(`/community/spaces${query ? `?${query}` : ''}`, { token });
}

export async function getSpace(token: string | null, slug: string) {
  return apiRequest<{ space: SpaceDetail }>(`/community/spaces/${encodeURIComponent(slug)}`, { token });
}

type SpaceAction = 'join' | 'leave' | 'follow' | 'unfollow';

export async function spaceAction(token: string | null, id: number, action: SpaceAction) {
  return apiRequest<{ space: SpaceSummary }>(`/community/spaces/${id}/${action}`, { token, method: 'POST', body: {} });
}

export async function updateSpaceSettings(
  token: string | null,
  id: number,
  settings: { join_policy: 'open' | 'approval' } | Pick<SpaceDetail, 'posting_public' | 'posting_gender' | 'posting_requires_approval'>,
) {
  return apiRequest<{ space: SpaceDetail }>(`/community/spaces/${id}/settings`, { token, method: 'PUT', body: settings });
}

export async function getSpaceMembers(token: string | null, id: number, status: SpaceMemberStatus) {
  return apiRequest<{ members: SpaceMemberItem[] }>(`/community/spaces/${id}/members?status=${status}`, { token });
}

export async function moderateMember(token: string | null, id: number, memberId: number, action: 'approve' | 'reject' | 'ban' | 'unban') {
  return apiRequest(`/community/spaces/${id}/members/${memberId}/${action}`, { token, method: 'POST', body: {} });
}

export async function setMemberRole(token: string | null, id: number, memberId: number, role: 'moderator' | 'member') {
  return apiRequest(`/community/spaces/${id}/members/${memberId}/role`, { token, method: 'PUT', body: { role } });
}

export async function createSpaceRequest(token: string | null, data: SpaceRequestInput) {
  return apiRequest<{ request: SpaceRequestItem }>('/community/space-requests', { token, method: 'POST', body: data });
}

export async function updateSpaceRequest(token: string | null, id: number, data: SpaceRequestInput) {
  return apiRequest<{ request: SpaceRequestItem }>(`/community/space-requests/${id}`, { token, method: 'PUT', body: data });
}

export async function getMySpaceRequests(token: string | null) {
  return apiRequest<{ requests: SpaceRequestItem[] }>('/community/space-requests/mine', { token });
}

// Posts
export async function getCommunityFeed(token: string | null) {
  return apiRequest<PostPage>('/community/feed', { token });
}

export async function getSpacePosts(token: string | null, spaceId: number) {
  return apiRequest<PostPage>(`/community/spaces/${spaceId}/posts`, { token });
}

export async function getPendingPosts(token: string | null, spaceId: number) {
  return apiRequest<PostPage>(`/community/spaces/${spaceId}/pending-posts`, { token });
}

export async function getUpcomingEvents(token: string | null) {
  return apiRequest<PostPage>('/community/events', { token });
}

export async function getSavedPosts(token: string | null) {
  return apiRequest<PostPage>('/community/saved-posts', { token });
}

export async function getPost(token: string | null, id: number) {
  return apiRequest<{ post: CommunityPost }>(`/community/posts/${id}`, { token });
}

export async function createPost(token: string | null, spaceId: number, data: NewPost) {
  return apiRequest<{ post: { id: number; status: CommunityPost['status'] } }>(`/community/spaces/${spaceId}/posts`, {
    token,
    method: 'POST',
    body: data,
  });
}

export async function updatePost(token: string | null, id: number, body: string) {
  return apiRequest<{ post: CommunityPost }>(`/community/posts/${id}`, { token, method: 'PUT', body: { body } });
}

/** The author deletes; the space's owner or a moderator hides. */
export async function deletePost(token: string | null, id: number) {
  return apiRequest(`/community/posts/${id}`, { token, method: 'DELETE' });
}

export async function reviewPost(token: string | null, id: number, decision: 'approve' | 'reject') {
  return apiRequest(`/community/posts/${id}/${decision}`, { token, method: 'POST', body: {} });
}

export async function setPostSaved(token: string | null, id: number, saved: boolean) {
  return apiRequest(`/community/posts/${id}/save`, { token, method: saved ? 'POST' : 'DELETE', body: saved ? {} : undefined });
}

export async function importPost(token: string | null, id: CommunityPost['id']) {
  return apiRequest<ImportResult>(`/community/posts/${id}/import`, { token, method: 'POST', body: {} });
}

// Comments (always the viewer's own gender)
export async function getComments(token: string | null, postId: number) {
  return apiRequest<{ comments: CommunityComment[] }>(`/community/posts/${postId}/comments`, { token });
}

export async function createComment(token: string | null, postId: number, data: { body: string; parent_id?: number | null }) {
  return apiRequest<{ comment: CommunityComment }>(`/community/posts/${postId}/comments`, { token, method: 'POST', body: data });
}

export async function updateComment(token: string | null, id: number, body: string) {
  return apiRequest<{ comment: CommunityComment }>(`/community/comments/${id}`, { token, method: 'PUT', body: { body } });
}

export async function deleteComment(token: string | null, id: number) {
  return apiRequest(`/community/comments/${id}`, { token, method: 'DELETE' });
}

// Chats
export async function uploadChatKey(token: string | null, data: { public_key: string }) {
  return apiRequest('/community/chat-key', { token, method: 'PUT', body: data });
}

export async function getChatKey(token: string | null, userId: number) {
  return apiRequest(`/community/users/${userId}/chat-key`, { token });
}

export async function createConversation(token: string | null, data: { type: 'direct' | 'group'; title?: string; member_ids: number[] }) {
  return apiRequest('/community/conversations', { token, method: 'POST', body: data });
}

export async function listConversations(token: string | null) {
  return apiRequest('/community/conversations', { token });
}

export async function getMessages(token: string | null, conversationId: number) {
  return apiRequest(`/community/conversations/${conversationId}/messages`, { token });
}

export async function sendMessage(token: string | null, conversationId: number, data: { copies: Record<string, string> }) {
  return apiRequest(`/community/conversations/${conversationId}/messages`, { token, method: 'POST', body: data });
}

export async function addReaction(token: string | null, messageId: number, data: { emoji: string }) {
  return apiRequest(`/community/messages/${messageId}/reactions`, { token, method: 'POST', body: data });
}

export async function removeReaction(token: string | null, messageId: number, emoji: string) {
  return apiRequest(`/community/messages/${messageId}/reactions/${emoji}`, { token, method: 'DELETE' });
}

// Safety
export async function createReport(
  token: string | null,
  data: { target_type: ReportTarget; target_id: number; reason: ReportReason; details?: string },
) {
  return apiRequest('/community/reports', { token, method: 'POST', body: data });
}

type PersonList = { items: { id: number; first_name: string; last_name: string }[] };

/** Blocks hide content both ways; mutes hide someone's content from you only. */
export async function getHidden(token: string | null, kind: 'blocks' | 'mutes') {
  return apiRequest<PersonList>(`/community/${kind}`, { token });
}

export async function hidePerson(token: string | null, kind: 'blocks' | 'mutes', targetId: number) {
  return apiRequest(`/community/${kind}`, { token, method: 'POST', body: { target_id: targetId } });
}

export async function unhidePerson(token: string | null, kind: 'blocks' | 'mutes', targetId: number) {
  return apiRequest(`/community/${kind}/${targetId}`, { token, method: 'DELETE' });
}

// Trusted shaykhs and fatwa
export async function requestTrust(token: string | null, data: TrustFields) {
  return apiRequest<{ request: TrustRequest }>('/community/shaykh-requests', { token, method: 'POST', body: data });
}

export async function getMyTrustRequest(token: string | null) {
  return apiRequest<{ request: TrustRequest | null; is_shaykh: boolean }>('/community/shaykh-requests/mine', { token });
}

export async function getShaykhs(token: string | null) {
  return apiRequest<{ shaykhs: ShaykhProfile[] }>('/community/shaykhs', { token });
}

export async function getShaykh(token: string | null, id: number) {
  return apiRequest<{ shaykh: ShaykhProfile; fatwas: PublishedFatwa[] }>(`/community/shaykhs/${id}`, { token });
}

export async function getFatwas(token: string | null) {
  return apiRequest<{ fatwas: PublishedFatwa[] }>('/community/fatwas', { token });
}

/** An open question (to the shaykhs of one gender) or one to a specific shaykh. */
export async function askQuestion(
  token: string | null,
  data: { body: string; show_asker_gender: boolean; shaykh_gender?: Gender; target_shaykh_id?: number },
) {
  return apiRequest<{ question: { id: number } }>('/community/fatwa-questions', { token, method: 'POST', body: data });
}

export async function getMyQuestions(token: string | null) {
  return apiRequest<{ questions: MyQuestion[] }>('/community/fatwa/mine', { token });
}

export async function closeQuestion(token: string | null, id: number) {
  return apiRequest(`/community/fatwa-questions/${id}/close`, { token, method: 'POST', body: {} });
}

export async function getFatwaInbox(token: string | null) {
  return apiRequest<{ threads: FatwaThreadSummary[]; open_questions: QuestionForShaykh[] }>('/community/fatwa/inbox', { token });
}

export async function takeQuestion(token: string | null, id: number, body: string, answered: boolean) {
  return apiRequest<{ thread: { id: number } }>(`/community/fatwa-questions/${id}/take`, { token, method: 'POST', body: { body, answered } });
}

export async function declineQuestion(token: string | null, id: number) {
  return apiRequest(`/community/fatwa-questions/${id}/decline`, { token, method: 'POST', body: {} });
}

export async function getFatwaThread(token: string | null, id: number) {
  return apiRequest<{ thread: FatwaThreadDetail }>(`/community/fatwa-threads/${id}`, { token });
}

export async function sendFatwaMessage(token: string | null, id: number, body: string, answered = false) {
  return apiRequest<{ thread: FatwaThreadDetail }>(`/community/fatwa-threads/${id}/messages`, { token, method: 'POST', body: { body, answered } });
}

export async function declineThread(token: string | null, id: number) {
  return apiRequest(`/community/fatwa-threads/${id}/decline`, { token, method: 'POST', body: {} });
}

export async function referThread(token: string | null, id: number, shaykhId: number) {
  return apiRequest(`/community/fatwa-threads/${id}/refer`, { token, method: 'POST', body: { shaykh_id: shaykhId } });
}

export async function proposePublish(token: string | null, threadId: number, data: { question_text: string; answer_text: string }) {
  return apiRequest(`/community/fatwa-threads/${threadId}/publish-proposal`, { token, method: 'POST', body: data });
}

export async function decidePublication(token: string | null, publicationId: number, decision: 'approve' | 'refuse') {
  return apiRequest(`/community/fatwa-publications/${publicationId}/${decision}`, { token, method: 'POST', body: {} });
}
