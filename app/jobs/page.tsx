import { JobsTable } from "../components/JobsTable";
import { ja } from "../../lib/i18n/ja";

export default function JobsPage() {
  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1.5rem" }}>
        {ja.nav.jobs}
      </h1>
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          padding: "0.25rem",
        }}
      >
        <JobsTable limit={100} />
      </div>
    </div>
  );
}
