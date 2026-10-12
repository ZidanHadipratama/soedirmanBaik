import { POST_KINDS, kindLabels, type Post, type PostKind, type Submission } from "./types";

export type PollOption = { id: string; label: string; votes: number };
export type PollData = {
  options: PollOption[];
  multiple: boolean;
  closed: boolean;
  participants: number;
  ballot: string[];
};
export type PollPost = Omit<Post, "kind"> & { kind: "poll"; poll: PollData };
export type ShortPost = Omit<Post, "kind"> & { kind: "short" };
export type Room = { id: string; slug: string; name: string; description: string; rules: string; following: boolean; postCount: number };
export type ThreadPart = { id: string; postId: string; body: string; status: Post["status"]; reason: string; revision: number; createdAt: string; initial: boolean };
export type Reply = { id: string; postId: string; parentId: string | null; body: string; author: string; replyingTo: string | null; owned: boolean; deleted: boolean; reported: boolean; reports?: number; reportReasons?: string[]; createdAt: string };
export type SocialMeta = { room: Pick<Room, "id" | "slug" | "name">; saved: boolean; locked: boolean; owned: boolean; replyCount: number; partCount: number; parts: ThreadPart[]; hasPendingParts: boolean };
export type FeedPost = (Post | PollPost | ShortPost) & { social?: SocialMeta };
export type ThreadDetail = { post: FeedPost; parts: ThreadPart[]; replies: Reply[]; owned: boolean; admin: boolean };
export type MyReply = Reply & { postTitle: string; accessible: boolean };
export type PartReview = { post: FeedPost; part: ThreadPart };
export type ReportedReply = { post: FeedPost; reply: Reply };
export type FeedKind = PostKind | "poll" | "short";
export type PollSubmission = Omit<Submission, "kind"> & {
  kind: "poll";
  poll: { options: { id: string; label: string }[]; multiple: boolean };
};
export type ShortSubmission = Omit<Submission, "kind"> & { kind: "short" };
export type PreviewSubmission = (Submission | PollSubmission | ShortSubmission) & { roomId?: string; parts?: string[] };
export const feedKinds: readonly FeedKind[] = process.env.NEXT_PUBLIC_UI_PREVIEW === "true" ? ["short", ...POST_KINDS, "poll"] : POST_KINDS;
export const feedKindLabels: Record<FeedKind, string> = { ...kindLabels, poll: "Polling", short: "Cerita singkat" };
export const PREVIEW_POST_CHANGED = "soedirman:preview-post-changed";
export const PREVIEW_SOCIAL_CHANGED = "soedirman:preview-social-changed";
export function canEditPost(post: FeedPost) {
  return post.status !== "pending" && !post.social?.hasPendingParts && (post.kind !== "poll" || (!post.poll.closed && post.poll.participants === 0));
}
