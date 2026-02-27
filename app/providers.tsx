"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

// NEXT_PUBLIC_* はビルド時にバンドルへ焼き込まれる。
// この値が undefined の場合はビルド後に env var を追加した（Redeploy 未実施）ことを意味する。
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

console.log(
  `[Convex] NEXT_PUBLIC_CONVEX_URL = "${convexUrl}" (${typeof convexUrl})`
);

if (!convexUrl) {
  throw new Error(
    "[Mission Control] NEXT_PUBLIC_CONVEX_URL が未設定です。\n" +
    "Vercel Dashboard > Settings > Environment Variables に\n" +
    "NEXT_PUBLIC_CONVEX_URL = https://opulent-clam-873.convex.cloud\n" +
    "を設定してから Redeploy してください。"
  );
}

if (!convexUrl.includes("convex.cloud")) {
  console.warn(
    `[Mission Control] NEXT_PUBLIC_CONVEX_URL が convex.cloud を指していません: "${convexUrl}"` +
    " — 本番環境では https://opulent-clam-873.convex.cloud を使用してください。"
  );
}

console.log("[Convex] ConvexReactClient を初期化:", convexUrl);
const convex = new ConvexReactClient(convexUrl);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}

// デバッグ用: バンドルに焼き込まれた URL を外部から参照できるようにエクスポート
export const CONVEX_URL_IN_BUNDLE = convexUrl;
