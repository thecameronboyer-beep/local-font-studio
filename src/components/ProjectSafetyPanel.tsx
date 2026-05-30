import { useRef, useState } from "react";
import type { FontStudioData, ProjectBackup, StorageHealthCheck } from "../types/fontTypes";

type ProjectSafetyPanelProps = {
  backups: ProjectBackup[];
  data: FontStudioData;
  health: StorageHealthCheck;
  onCreateRestorePoint: () => void;
  onExportProject: () => void;
  onImportProject: (file: File) => Promise<string>;
  onRestoreBackup: (backupId: string) => void;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function healthLabel(status: StorageHealthCheck["status"]) {
  if (status === "migrated") {
    return "Migrated";
  }

  if (status === "recovered") {
    return "Recovered";
  }

  if (status === "reset") {
    return "Reset";
  }

  return "Healthy";
}

export default function ProjectSafetyPanel({
  backups,
  data,
  health,
  onCreateRestorePoint,
  onExportProject,
  onImportProject,
  onRestoreBackup,
}: ProjectSafetyPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const latestBackup = backups[0];
  const activity = data.activityLog.slice(0, 6);

  async function handleImportFile(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const message = await onImportProject(file);
      setStatusMessage(message);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  return (
    <section className="studio-panel project-safety-panel" aria-label="Project safety">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project safety</p>
          <h2>Portable project</h2>
        </div>
        <div className={`glyph-pill storage-${health.status}`}>{healthLabel(health.status)}</div>
      </div>

      <div className="project-health-grid">
        <div className="project-health-card">
          <span>Storage</span>
          <strong>{health.message}</strong>
        </div>
        <div className="project-health-card">
          <span>Version</span>
          <strong>v{data.version}</strong>
        </div>
        <div className="project-health-card">
          <span>Backups</span>
          <strong>{backups.length}</strong>
        </div>
        <div className="project-health-card">
          <span>Latest</span>
          <strong>{latestBackup ? formatDate(latestBackup.createdAt) : "No restore point yet"}</strong>
        </div>
      </div>

      {health.warnings.length > 0 && (
        <div className="project-warning-list">
          {health.warnings.map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      )}

      <div className="project-actions">
        <button className="primary-button compact-button" type="button" onClick={onExportProject}>
          Export JSON
        </button>
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          Import JSON
        </button>
        <button className="secondary-button compact-button" type="button" onClick={onCreateRestorePoint}>
          Restore point
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            void handleImportFile(event.target.files?.[0]);
          }}
        />
      </div>

      {statusMessage && <div className="project-status">{statusMessage}</div>}

      <div className="backup-list" aria-label="Restore points">
        {backups.slice(0, 4).map((backup) => (
          <div className="backup-card" key={backup.id}>
            <div>
              <strong>{backup.reason}</strong>
              <span>
                {backup.activeFontName} - {backup.fontCount} fonts - {backup.glyphCount} glyphs
              </span>
              <small>{formatDate(backup.createdAt)}</small>
            </div>
            <button className="secondary-button compact-button" type="button" onClick={() => onRestoreBackup(backup.id)}>
              Restore
            </button>
          </div>
        ))}
        {backups.length === 0 && (
          <div className="backup-empty">
            <strong>No restore points yet</strong>
            <span>The app creates automatic backups as you edit. You can also make one before risky changes.</span>
          </div>
        )}
      </div>

      <div className="activity-list" aria-label="Project activity">
        <div className="activity-heading">
          <span>Activity</span>
          <strong>{data.activityLog.length}</strong>
        </div>
        {activity.map((item) => (
          <div className="activity-item" key={item.id}>
            <span>{item.message}</span>
            <small>{formatDate(item.createdAt)}</small>
          </div>
        ))}
        {activity.length === 0 && <div className="activity-empty">No project activity recorded yet.</div>}
      </div>
    </section>
  );
}
