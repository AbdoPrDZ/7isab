import { apiRequest } from '@/lib/api/client';

import type { CommunityPost, CommunityRule, Gender, ImportResult, Membership, PostPage, RuleAcceptance } from './types';

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
export async function discoverSpaces(token: string | null, params?: { gender?: 'male' | 'female' }) {
  const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
  return apiRequest(`/community/spaces${query}`, { token });
}

export async function getSpace(token: string | null, slug: string) {
  return apiRequest(`/community/spaces/${slug}`, { token });
}

export async function joinSpace(token: string | null, id: number) {
  return apiRequest(`/community/spaces/${id}/join`, { token, method: 'POST', body: {} });
}

export async function leaveSpace(token: string | null, id: number) {
  return apiRequest(`/community/spaces/${id}/leave`, { token, method: 'POST', body: {} });
}

export async function followSpace(token: string | null, id: number) {
  return apiRequest(`/community/spaces/${id}/follow`, { token, method: 'POST', body: {} });
}

export async function unfollowSpace(token: string | null, id: number) {
  return apiRequest(`/community/spaces/${id}/unfollow`, { token, method: 'POST', body: {} });
}

export async function createSpaceRequest(token: string | null, data: {
  type: 'group' | 'page';
  name: string;
  purpose: string;
  goals: string;
  content_plan: string;
  join_policy?: 'open' | 'approval';
  audience?: 'everyone' | 'gender';
}) {
  return apiRequest('/community/space-requests', { token, method: 'POST', body: data });
}

export async function getMySpaceRequests(token: string | null) {
  return apiRequest('/community/space-requests/mine', { token });
}

// Posts
export async function getCommunityFeed(token: string | null) {
  return apiRequest<PostPage>('/community/feed', { token });
}

export async function getSpacePosts(token: string | null, spaceId: number) {
  return apiRequest<PostPage>(`/community/spaces/${spaceId}/posts`, { token });
}

export async function createPost(token: string | null, spaceId: number, data: { type: string; body: string; payload?: Record<string, unknown>; audience: 'own_gender' | 'everyone' }) {
  return apiRequest(`/community/spaces/${spaceId}/posts`, { token, method: 'POST', body: data });
}

export async function updatePost(token: string | null, id: number, data: { body: string; payload?: Record<string, unknown> }) {
  return apiRequest(`/community/posts/${id}`, { token, method: 'PUT', body: data });
}

export async function deletePost(token: string | null, id: number) {
  return apiRequest(`/community/posts/${id}`, { token, method: 'DELETE' });
}

export async function savePost(token: string | null, id: number) {
  return apiRequest(`/community/posts/${id}/save`, { token, method: 'POST', body: {} });
}

export async function importPost(token: string | null, id: CommunityPost['id']) {
  return apiRequest<ImportResult>(`/community/posts/${id}/import`, { token, method: 'POST', body: {} });
}

// Comments
export async function getComments(token: string | null, postId: number) {
  return apiRequest(`/community/posts/${postId}/comments`, { token });
}

export async function createComment(token: string | null, postId: number, data: { body: string }) {
  return apiRequest(`/community/posts/${postId}/comments`, { token, method: 'POST', body: data });
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
export async function createReport(token: string | null, data: { target_type: string; target_id: number; reason: string; details: string; revealed_content?: string }) {
  return apiRequest('/community/reports', { token, method: 'POST', body: data });
}

export async function blockUser(token: string | null, data: { target_id: number }) {
  return apiRequest('/community/blocks', { token, method: 'POST', body: data });
}

export async function unblockUser(token: string | null, id: number) {
  return apiRequest(`/community/blocks/${id}`, { token, method: 'DELETE' });
}

export async function muteUser(token: string | null, data: { target_id: number }) {
  return apiRequest('/community/mutes', { token, method: 'POST', body: data });
}

export async function unmuteUser(token: string | null, id: number) {
  return apiRequest(`/community/mutes/${id}`, { token, method: 'DELETE' });
}

// Shaykhs and Fatwa
export async function requestTrust(token: string | null, data: { manhaj: string; marja: string; studies?: string; ijazat?: string; teachers?: string; institution?: string; teaching?: string }) {
  return apiRequest('/community/shaykh-requests', { token, method: 'POST', body: data });
}

export async function getShaykhs(token: string | null) {
  return apiRequest('/community/shaykhs', { token });
}

export async function askQuestion(token: string | null, data: { shaykh_gender: 'male' | 'female'; target_shaykh_id?: number; body: string; show_asker_gender: boolean }) {
  return apiRequest('/community/fatwa-questions', { token, method: 'POST', body: data });
}

export async function getMyQuestions(token: string | null) {
  return apiRequest('/community/fatwa/mine', { token });
}

export async function getPublishedFatwas(token: string | null) {
  return apiRequest('/community/fatwas', { token });
}

export async function proposePublish(token: string | null, threadId: number, data: { question_text: string; answer_text: string }) {
  return apiRequest(`/community/fatwa-threads/${threadId}/publish-proposal`, { token, method: 'POST', body: data });
}

export async function approveFatwa(token: string | null, publicationId: number) {
  return apiRequest(`/community/fatwa-publications/${publicationId}/approve`, { token, method: 'POST', body: {} });
}

export async function refuseFatwa(token: string | null, publicationId: number) {
  return apiRequest(`/community/fatwa-publications/${publicationId}/refuse`, { token, method: 'POST', body: {} });
}
