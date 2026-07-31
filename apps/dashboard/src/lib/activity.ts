"use client";

import { STORAGE_KEYS } from "./config";

export type ActivityKind =
  | "create"
  | "deposit"
  | "spend_ok"
  | "spend_fail"
  | "pause"
  | "unpause"
  | "clawback"
  | "mint";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
  signature?: string;
  ts: number;
  success: boolean;
}

export function loadActivity(): ActivityItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.activity);
    if (!raw) return [];
    return JSON.parse(raw) as ActivityItem[];
  } catch {
    return [];
  }
}

export function pushActivity(
  item: Omit<ActivityItem, "id" | "ts"> & { ts?: number }
): ActivityItem[] {
  const next: ActivityItem = {
    ...item,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: item.ts ?? Math.floor(Date.now() / 1000),
  };
  const list = [next, ...loadActivity()].slice(0, 40);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.activity, JSON.stringify(list));
  }
  return list;
}

export function clearActivity(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEYS.activity);
  }
}
