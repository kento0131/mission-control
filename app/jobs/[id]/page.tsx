"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { StatusBadge } from "../../components/StatusBadge";
import { LogTail } from "../../components/LogTail";
import { formatRelativeTime, formatDuration } from "../../../lib/utils";

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  const job = useQuery(api.queries.getJob, { job_id: jobId });

  if (job === undefined) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  if (job === null) {
    return (
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <p style={{ color: "var(--text-muted)" }}>Job not found: {jobId}</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>{job.title}</h1>
          <StatusBadge status={job.status} />
        </div>
        <p style={{ fontFamily: "monospace", fontSize: "0.875rem", color: "var(--text-muted)" }}>
          {job.job_id}
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <Stat label="Started" value={formatRelativeTime(job.started_at)} />
        <Stat
          label="Duration"
          value={formatDuration(job.started_at, job.finished_at)}
        />
        {job.result && <Stat label="Result" value={job.result} />}
        {job.error && (
          <Stat label="Error" value={job.error} highlight="var(--red)" />
        )}
      </div>

      <section>
        <h2
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "0.75rem",
          }}
        >
          Logs
        </h2>
        <LogTail jobId={jobId} />
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "0.5rem",
        padding: "0.875rem",
      }}
    >
      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
        {label}
      </p>
      <p style={{ fontSize: "0.875rem", color: highlight ?? "var(--text)", fontWeight: 500 }}>
        {value}
      </p>
    </div>
  );
}
