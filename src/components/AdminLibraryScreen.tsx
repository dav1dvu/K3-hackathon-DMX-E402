import { useState, type FormEvent } from "react";
import type { DayRecord, MaterialRecord } from "../types";
import { BookIcon, LogoutIcon, PlusIcon, TrashIcon, UploadIcon } from "./icons";
import { CourseTree } from "./CourseTree";

type AdminLibraryScreenProps = {
  displayName: string;
  days: DayRecord[];
  isLoading: boolean;
  error: string;
  onCreateDay: (title: string) => Promise<void>;
  onTogglePublish: (day: DayRecord) => Promise<void>;
  onDeleteDay: (day: DayRecord) => Promise<void>;
  onUploadMaterial: (day: DayRecord, file: File, displayName: string) => Promise<void>;
  onDeleteMaterial: (day: DayRecord, material: MaterialRecord) => Promise<void>;
  onLogout: () => void;
};

type UploadFormProps = {
  day: DayRecord;
  onUpload: AdminLibraryScreenProps["onUploadMaterial"];
};

function DayUploadForm({ day, onUpload }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setIsUploading(true);
    setError("");
    try {
      await onUpload(day, file, displayName.trim() || file.name.replace(/\.pdf$/i, ""));
      setFile(null);
      setDisplayName("");
    } catch {
      setError("Tải file thất bại. Vui lòng thử lại.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form className="day-upload-form" onSubmit={submit}>
      <input
        className="day-upload-file"
        type="file"
        accept=".pdf,application/pdf"
        onChange={(event) => {
          const selected = event.target.files?.[0] ?? null;
          setFile(selected);
          if (selected && !displayName) setDisplayName(selected.name.replace(/\.pdf$/i, ""));
        }}
      />
      <input
        className="day-upload-name"
        type="text"
        placeholder="Tên hiển thị"
        value={displayName}
        onChange={(event) => setDisplayName(event.target.value)}
      />
      <button type="submit" className="button button-secondary" disabled={!file || isUploading}>
        <UploadIcon width={16} height={16} />
        {isUploading ? "Đang tải..." : "Tải lên"}
      </button>
      {error && <span className="upload-error">{error}</span>}
    </form>
  );
}

export function AdminLibraryScreen({
  displayName,
  days,
  isLoading,
  error,
  onCreateDay,
  onTogglePublish,
  onDeleteDay,
  onUploadMaterial,
  onDeleteMaterial,
  onLogout,
}: AdminLibraryScreenProps) {
  const [newDayTitle, setNewDayTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const submitNewDay = async (event: FormEvent) => {
    event.preventDefault();
    const title = newDayTitle.trim();
    if (!title) return;
    setIsCreating(true);
    try {
      await onCreateDay(title);
      setNewDayTitle("");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="admin-screen">
      <header className="app-header">
        <div className="app-brand">
          <span className="small-brand-mark"><BookIcon /></span>
          <div><strong>VLearn</strong><span>QUẢN TRỊ HỌC LIỆU</span></div>
        </div>
        <div className="admin-identity">Admin · {displayName}</div>
        <button className="reset-button" type="button" onClick={onLogout}>
          <LogoutIcon /><span>Đăng xuất</span>
        </button>
      </header>

      <div className="admin-body">
        <form className="new-day-form" onSubmit={submitNewDay}>
          <input
            type="text"
            value={newDayTitle}
            onChange={(event) => setNewDayTitle(event.target.value)}
            placeholder="Tên buổi học mới, vd: Day06"
            maxLength={80}
          />
          <button className="button button-primary" type="submit" disabled={!newDayTitle.trim() || isCreating}>
            <PlusIcon width={16} height={16} />
            Tạo buổi học
          </button>
        </form>

        {error && <p className="admin-error" role="alert">{error}</p>}
        {isLoading ? (
          <p className="admin-loading">Đang tải danh sách học liệu...</p>
        ) : (
          <CourseTree
            days={days}
            collapsed={false}
            onToggleCollapsed={() => {}}
            onSelectMaterial={() => {}}
            emptyLabel="Chưa có buổi học nào. Hãy tạo buổi học đầu tiên."
            renderDayExtra={(day) => (
              <span className="course-day-admin-actions">
                <button
                  type="button"
                  className={`badge-toggle ${day.published ? "is-published" : ""}`}
                  onClick={() => onTogglePublish(day)}
                >
                  {day.published ? "PUBLISHED" : "DRAFT"}
                </button>
                <button
                  type="button"
                  className="icon-button icon-button-danger"
                  onClick={() => onDeleteDay(day)}
                  aria-label={`Xoá ${day.title}`}
                >
                  <TrashIcon width={16} height={16} />
                </button>
              </span>
            )}
            renderMaterialActions={(day, material) => (
              <button
                type="button"
                className="icon-button icon-button-danger"
                onClick={() => onDeleteMaterial(day, material)}
                aria-label={`Xoá ${material.displayName}`}
              >
                <TrashIcon width={15} height={15} />
              </button>
            )}
            renderDayFooter={(day) => <DayUploadForm day={day} onUpload={onUploadMaterial} />}
          />
        )}
      </div>
    </main>
  );
}
