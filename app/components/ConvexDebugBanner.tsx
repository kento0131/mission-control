"use client";

import { useConvexConnectionState } from "convex/react";
import { CONVEX_URL_IN_BUNDLE } from "../providers";

export function ConvexDebugBanner() {
  const { isWebSocketConnected, hasEverConnected, connectionRetries } =
    useConvexConnectionState();

  const urlOk =
    typeof CONVEX_URL_IN_BUNDLE === "string" &&
    CONVEX_URL_IN_BUNDLE.includes("opulent-clam-873.convex.cloud");

  // 接続状態ラベルと色を決定
  let wsLabel: string;
  let wsColor: string;
  if (isWebSocketConnected) {
    wsLabel = "WS接続 ✓";
    wsColor = "#22c55e";
  } else if (hasEverConnected) {
    wsLabel = `再接続中 (${connectionRetries}回)`;
    wsColor = "#f97316";
  } else if (connectionRetries > 0) {
    wsLabel = `接続失敗 (${connectionRetries}回)`;
    wsColor = "#ef4444";
  } else {
    wsLabel = "接続待機...";
    wsColor = "#eab308";
  }

  return (
    <div
      style={{
        marginLeft: "auto",
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        fontSize: "0.68rem",
        fontFamily: "monospace",
      }}
    >
      {/* WebSocket 接続状態 */}
      <span
        title={`isWebSocketConnected=${isWebSocketConnected} hasEverConnected=${hasEverConnected} retries=${connectionRetries}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: wsColor,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            backgroundColor: wsColor,
            flexShrink: 0,
            animation: isWebSocketConnected
              ? "screen-running 2s ease-in-out infinite"
              : undefined,
          }}
        />
        {wsLabel}
      </span>

      {/* バンドルに焼き込まれた URL */}
      <span
        title={`NEXT_PUBLIC_CONVEX_URL (build時バンドル): "${CONVEX_URL_IN_BUNDLE}"`}
        style={{
          color: urlOk ? "#6b7280" : "#ef4444",
          maxWidth: 280,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {CONVEX_URL_IN_BUNDLE ?? "❌ URL未設定 — Redeployしてください"}
      </span>
    </div>
  );
}
