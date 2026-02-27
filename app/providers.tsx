"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "[Mission Control] NEXT_PUBLIC_CONVEX_URL が未設定です。\n" +
    "Vercel Dashboard > mission-control > Settings > Environment Variables に\n" +
    "NEXT_PUBLIC_CONVEX_URL = https://opulent-clam-873.convex.cloud\n" +
    "を追加してから Redeploy してください。"
  );
}

if (!convexUrl.includes("convex.cloud")) {
  console.warn(
    `[Mission Control] NEXT_PUBLIC_CONVEX_URL が convex.cloud を指していません: ${convexUrl}\n` +
    "本番環境では https://opulent-clam-873.convex.cloud を使用してください。"
  );
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
