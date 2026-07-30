import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("react-pdf", async () => {
  const React = await import("react");

  function Document({
    children,
    onLoadSuccess,
  }: {
    children: ReactNode;
    onLoadSuccess?: (pdf: { numPages: number }) => void;
  }) {
    React.useEffect(() => onLoadSuccess?.({ numPages: 5 }), [onLoadSuccess]);
    return <div data-testid="pdf-document">{children}</div>;
  }

  function Page({
    pageNumber,
    renderTextLayer,
  }: {
    pageNumber: number;
    renderTextLayer?: boolean;
  }) {
    return (
      <div data-testid={`pdf-page-${pageNumber}`} data-text-layer={String(renderTextLayer)}>
        Nội dung PDF trang {pageNumber}
      </div>
    );
  }

  return {
    Document,
    Page,
    pdfjs: { GlobalWorkerOptions: { workerSrc: "" } },
  };
});

describe("AI PDF Tutor MVP", () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  async function openSampleDocument() {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /dùng tài liệu mẫu/i }));
    expect(screen.getByText(/đang xử lý tài liệu/i)).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(1000));
  }

  it("rejects a non-PDF file", () => {
    render(<App />);
    const input = screen.getByLabelText(/chọn file pdf/i);
    const invalidFile = new File(["hello"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [invalidFile] } });
    expect(screen.getByRole("alert")).toHaveTextContent(/file không hợp lệ/i);
  });

  it("renders a selectable text layer and navigates PDF pages", async () => {
    await openSampleDocument();
    const previous = screen.getByRole("button", { name: /trang trước/i });
    const next = screen.getByRole("button", { name: /trang tiếp theo/i });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    expect(screen.getAllByTestId("pdf-page-1").some((page) => page.dataset.textLayer === "true")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /mở trang 5/i }));
    expect(screen.getByRole("heading", { name: "Trang 5" })).toBeInTheDocument();
    expect(next).toBeDisabled();
    expect(previous).toBeEnabled();
  });

  it("keeps chat history by page and answers for the page at send time", async () => {
    await openSampleDocument();
    const input = screen.getByLabelText(/câu hỏi về trang 1/i);
    fireEvent.change(input, { target: { value: "Tóm tắt trang này." } });
    fireEvent.click(screen.getByRole("button", { name: /gửi câu hỏi/i }));
    expect(screen.getByText(/trợ lý đang trả lời/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /trang tiếp theo/i }));
    expect(screen.getByText(/gắn với trang 2 tại thời điểm gửi/i)).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTime(800));

    fireEvent.click(screen.getByRole("button", { name: /trang trước/i }));
    expect(screen.getByText(/theo nội dung đang hiển thị ở trang 1/i)).toBeInTheDocument();
    expect(screen.getByText(/nguồn ngữ cảnh · trang 1/i)).toBeInTheDocument();
    expect(screen.getByText("Tóm tắt trang này.")).toBeInTheDocument();
  });

  it("resets the PDF and all page chat state", async () => {
    await openSampleDocument();
    fireEvent.click(screen.getByRole("button", { name: /tải file khác/i }));
    expect(screen.getByRole("heading", { name: /ai tutor đọc cùng/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dùng tài liệu mẫu/i })).toBeEnabled();
  });
});
