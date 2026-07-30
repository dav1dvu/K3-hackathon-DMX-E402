import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileIcon, SparkleIcon, UploadIcon } from "./icons";

type UploadScreenProps = {
  isProcessing: boolean;
  processingFileName: string;
  onFileSelected: (file: File) => void;
  onUseSample: () => void;
};

function isPdfFile(file: File) {
  const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
  const hasPdfMime = file.type === "application/pdf" || file.type === "";
  return hasPdfExtension && hasPdfMime;
}

export function UploadScreen({
  isProcessing,
  processingFileName,
  onFileSelected,
  onUseSample,
}: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const validateAndSelect = (file?: File) => {
    if (!file) return;
    if (!isPdfFile(file)) {
      setError("File không hợp lệ. Vui lòng chọn đúng định dạng PDF.");
      return;
    }
    setError("");
    onFileSelected(file);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    validateAndSelect(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    validateAndSelect(event.dataTransfer.files?.[0]);
  };

  return (
    <main className="upload-screen">
      <section className="upload-hero" aria-labelledby="upload-title">
        <div className="brand-mark" aria-label="Slidewise">
          <SparkleIcon />
        </div>
        <p className="eyebrow">SLIDEWISE AI TUTOR</p>
        <h1 id="upload-title">
          AI Tutor đọc cùng
          <span> tài liệu PDF của bạn.</span>
        </h1>
        <p className="hero-copy">
          Mở PDF thật, bôi đen nội dung cần ghi nhớ và đặt câu hỏi ngay trên
          trang bạn đang đọc.
        </p>

        <div
          className={`drop-zone ${isDragging ? "is-dragging" : ""} ${
            error ? "has-error" : ""
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {isProcessing ? (
            <div className="processing-state" role="status" aria-live="polite">
              <span className="spinner" />
              <strong>Đang xử lý tài liệu...</strong>
              <span className="processing-file-name">{processingFileName}</span>
              <span>PDF viewer và lớp văn bản đang được chuẩn bị</span>
            </div>
          ) : (
            <>
              <div className="upload-icon-wrap">
                <UploadIcon width={28} height={28} />
              </div>
              <strong>Thả file PDF vào đây</strong>
              <span>hoặc chọn một tài liệu từ máy tính</span>
              <button
                className="button button-primary"
                type="button"
                onClick={() => inputRef.current?.click()}
              >
                <FileIcon />
                Chọn file PDF
              </button>
              <input
                ref={inputRef}
                className="visually-hidden"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                aria-label="Chọn file PDF"
              />
            </>
          )}
        </div>

        {error && (
          <p className="upload-error" role="alert">
            {error}
          </p>
        )}

        <div className="sample-row">
          <span />
          <p>Chưa có file PDF?</p>
          <span />
        </div>
        <button
          className="button button-secondary sample-button"
          type="button"
          onClick={onUseSample}
          disabled={isProcessing}
        >
          <SparkleIcon />
          Dùng tài liệu mẫu
        </button>
        <p className="upload-note">
          Chỉ hỗ trợ file PDF · Không tải dữ liệu lên máy chủ
        </p>
      </section>
    </main>
  );
}

