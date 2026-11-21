import { apiRequest } from '@/lib/api/client';

// Rules
export async function getCommunityRules() {
  return apiRequest('/community/rules');
}

// Joining
export async function joinCommunity(data: { first_name: string; last_name: string; gender: 'male' | 'female'; rule_acceptances: Array<{ key: string; version: number }> }) {
  return apiRequest('/community/join', { method: 'POST', body: data });
}

export async function leaveCommunity() {
  return apiRequest('/community/leave', { method: 'POST', body: {} });
}

export async function getCommunityProfile() {
  return apiRequest('/community/me');
}

export async function updateCommunityProfile(data: { first_name: string; last_name: string }) {
  return apiRequest('/community/me', { method: 'PUT', body: data });
}

// Spaces
export async function discoverSpaces(params?: { gender?: 'male' | 'female' }) {
  const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : '';
  return apiRequest(`/community/spaces${query}`);
}

export async function getSpace(slug: string) {
  return apiRequest(`/community/spaces/${slug}`);
}

export async function joinSpace(id: number) {
  return apiRequest(`/community/spaces/${id}/join`, { method: 'POST', body: {} });
}

export async function leaveSpace(id: number) {
  return apiRequest(`/community/spaces/${id}/leave`, { method: 'POST', body: {} });
}

export async function followSpace(id: number) {
  return apiRequest(`/community/spaces/${id}/follow`, { method: 'POST', body: {} });
}

export async function unfollowSpace(id: number) {
  return apiRequest(`/community/spaces/${id}/unfollow`, { method: 'POST', body: {} });
}

export async function createSpaceRequest(data: {
  type: 'group' | 'page';
  name: string;
  purpose: string;
  goals: string;
  content_plan: string;
  join_policy?: 'open' | 'approval';
  audience?: 'everyone' | 'gender';
}) {
  return apiRequest('/community/space-requests', { method: 'POST', body: data });
}

export async function getMySpaceRequests() {
  return apiRequest('/community/space-requests/mine');
}

// Posts
export async function getCommunityFeed() {
  return apiRequest('/community/feed');
}

export async function getSpacePosts(spaceId: number) {
  return apiRequest(`/community/spaces/${spaceId}/posts`);
}

export async function createPost(spaceId: number, data: { type: string; body: string; payload?: Record<string, unknown>; audience: 'own_gender' | 'everyone' }) {
  return apiRequest(`/community/spaces/${spaceId}/posts`, { method: 'POST', body: data });
}

export async function updatePost(id: number, data: { body: string; payload?: Record<string, unknown> }) {
  return apiRequest(`/community/posts/${id}`, { method: 'PUT', body: data });
}

export async function deletePost(id: number) {
  return apiRequest(`/community/posts/${id}`, { method: 'DELETE' });
}

export async function savePost(id: number) {
  return apiRequest(`/community/posts/${id}/save`, { method: 'POST', body: {} });
}

export async function importPost(id: number) {
  return apiRequest(`/community/posts/${id}/import`, { method: 'POST', body: {} });
}

// Comments
export async function getComments(postId: number) {
  return apiRequest(`/community/posts/${postId}/comments`);
}

export async function createComment(postId: number, data: { body: string }) {
  return apiRequest(`/community/posts/${postId}/comments`, { method: 'POST', body: data });
}

export async function deleteComment(id: number) {
  return apiRequest(`/community/comments/${id}`, { method: 'DELETE' });
}

// Chats
export async function uploadChatKey(data: { public_key: string }) {
  return apiRequest('/community/chat-key', { method: 'PUT', body: data });
}

export async function getChatKey(userId: number) {
  return apiRequest(`/community/users/${userId}/chat-key`);
}

export async function createConversation(data: { type: 'direct' | 'group'; title?: string; member_ids: number[] }) {
  return apiRequest('/community/conversations', { method: 'POST', body: data });
}

export async function listConversations() {
  return apiRequest('/community/conversations');
}

export async function getMessages(conversationId: number) {
  return apiRequest(`/community/conversations/${conversationId}/messages`);
}

export async function sendMessage(conversationId: number, data: { copies: Record<string, string> }) {
  return apiRequest(`/community/conversations/${conversationId}/messages`, { method: 'POST', body: data });
}

export async function addReaction(messageId: number, data: { emoji: string }) {
  return apiRequest(`/community/messages/${messageId}/reactions`, { method: 'POST', body: data });
}

export async function removeReaction(messageId: number, emoji: string) {
  return apiRequest(`/community/messages/${messageId}/reactions/${emoji}`, { method: 'DELETE' });
}

// Safety
export async function createReport(data: { target_type: string; target_id: number; reason: string; details: string; revealed_content?: string }) {
  return apiRequest('/community/reports', { method: 'POST', body: data });
}

export async function blockUser(data: { target_id: number }) {
  return apiRequest('/community/blocks', { method: 'POST', body: data });
}

export async function unblockUser(id: number) {
  return apiRequest(`/community/blocks/${id}`, { method: 'DELETE' });
}

export async function muteUser(data: { target_id: number }) {
  return apiRequest('/community/mutes', { method: 'POST', body: data });
}

export async function unmuteUser(id: number) {
  return apiRequest(`/community/mutes/${id}`, { method: 'DELETE' });
}

// Shaykhs and Fatwa
export async function requestTrust(data: { manhaj: string; marja: string; studies?: string; ijazat?: string; teachers?: string; institution?: string; teaching?: string }) {
  return apiRequest('/community/shaykh-requests', { method: 'POST', body: data });
}

export async function getShaykhs() {
  return apiRequest('/community/shaykhs');
}

export async function askQuestion(data: { shaykh_gender: 'male' | 'female'; target_shaykh_id?: number; body: string; show_asker_gender: boolean }) {
  return apiRequest('/community/fatwa-questions', { method: 'POST', body: data });
}

export async function getMyQuestions() {
  return apiRequest('/community/fatwa/mine');
}

export async function getPublishedFatwas() {
  return apiRequest('/community/fatwas');
}

export async function proposePublish(threadId: number, data: { question_text: string; answer_text: string }) {
  return apiRequest(`/community/fatwa-threads/${threadId}/publish-proposal`, { method: 'POST', body: data });
}

export async function approveFatwa(publicationId: number) {
  return apiRequest(`/community/fatwa-publications/${publicationId}/approve`, { method: 'POST', body: {} });
}

export async function refuseFatwa(publicationId: number) {
  return apiRequest(`/community/fatwa-publications/${publicationId}/refuse`, { method: 'POST', body: {} });
}
