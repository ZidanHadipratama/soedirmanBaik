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
export type FeedPost = Post | PollPost;
export type FeedKind = PostKind | "poll";
export type PollSubmission = Omit<Submission, "kind"> & {
  kind: "poll";
  poll: { options: { id: string; label: string }[]; multiple: boolean };
};
export type PreviewSubmission = Submission | PollSubmission;
export const feedKinds: readonly FeedKind[] = process.env.NEXT_PUBLIC_UI_PREVIEW === "true" ? [...POST_KINDS, "poll"] : POST_KINDS;
export const feedKindLabels: Record<FeedKind, string> = { ...kindLabels, poll: "Polling" };
export const PREVIEW_POST_CHANGED = "soedirman:preview-post-changed";
export function canEditPost(post: FeedPost) {
  return post.status !== "pending" && (post.kind !== "poll" || (!post.poll.closed && post.poll.participants === 0));
}
