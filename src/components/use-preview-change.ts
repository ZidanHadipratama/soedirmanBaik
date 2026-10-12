"use client";
import { useEffect } from "react";
import { PREVIEW_POST_CHANGED, PREVIEW_SOCIAL_CHANGED, type FeedPost } from "@/lib/preview-types";

export function usePreviewChange(refresh: () => void, postId?: string) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_UI_PREVIEW !== "true") return;
    function update(event: Event) {
      if (postId && event.type === PREVIEW_POST_CHANGED && (event as CustomEvent<FeedPost>).detail.id !== postId) return;
      refresh();
    }
    window.addEventListener(PREVIEW_POST_CHANGED, update); window.addEventListener(PREVIEW_SOCIAL_CHANGED, update);
    return () => { window.removeEventListener(PREVIEW_POST_CHANGED, update); window.removeEventListener(PREVIEW_SOCIAL_CHANGED, update); };
  }, [refresh, postId]);
}
