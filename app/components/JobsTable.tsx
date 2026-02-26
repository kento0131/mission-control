"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { StatusBadge } from "./StatusBadge";
import { formatRelativeTime, formatDuration } from "../../lib/utils";

export function JobsTable({ limit }: { limit?: number }) {
  const jobs = useQuery(api.queries.getRecentJobs, { limit });

  if (!jobs) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>Loading...</p>
    );
  }

  if (jobs.length === 0) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>No jobs yet</p>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.875rem",
        }}
      >
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Job ID", "Title", "Status", "Started", "Duration"].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "0.5rem 0.75rem",
                  color: "var(--text-muted)",
                  fontWeight: 500,
                  fontSize: "0.75rem",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr
              key={job._id}
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <td style={{ padding: "0.625rem 0.75rem" }}>
                <Link
                  href={`/jobs/${job.job_id}`}
                  style={{ color: "var(--blue)", fontFamily: "monospace" }}
                >
                  {job.job_id.slice(0, 12)}
                </Link>
              </td>
              <td style={{ padding: "0.625rem 0.75rem", color: "var(--text)" }}>
                {job.title}
              </td>
              <td style={{ padding: "0.625rem 0.75rem" }}>
                <StatusBadge status={job.status} />
              </td>
              <td style={{ padding: "0.625rem 0.75rem", color: "var(--text-muted)" }}>
                {formatRelativeTime(job.started_at)}
              </td>
              <td style={{ padding: "0.625rem 0.75rem", color: "var(--text-muted)" }}>
                {formatDuration(job.started_at, job.finished_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
