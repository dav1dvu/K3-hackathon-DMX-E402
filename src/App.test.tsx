import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerFromDocument } from "./rag/grounding";
import App from "./App";

const tutorMocks = vi.hoisted(() => ({ askTutor: vi.fn() }));

vi.mock("./services/tutorApi", () => ({ askTutor: tutorMocks.askTutor }));

vi.mock("react-pdf", async () => {
  const React = await import("react");

  function Document({
    children,
    onLoadSuccess,
  }: {
    children: ReactNode;
    onLoadSuccess?: (pdf: {
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str: string; hasEOL: boolean }> }>;
        getOperatorList: () => Promise<{ fnArray: number[] }>;
      }>;
    }) => void;
  }) {
    React.useEffect(() => {
      onLoadSuccess?.({
        numPages: 5,
        getPage: async (pageNumber) => ({
          getTextContent: async () => ({
            items: [{
              str: `Trang ${pageNumber} trình bày machine learning, dữ liệu huấn luyện và cách đánh giá mô hình bằng precision và recall.`,
              hasEOL: false,
            }],
          }),
          getOperatorList: async () => ({ fnArray: [] }),
        }),
      });
    }, [onLoadSuccess]);
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
    pdfjs: {
      GlobalWorkerOptions: { workerSrc: "" },
      OPS: { paintImageXObject: 1, paintInlineImageXObject: 2, paintImageMaskXObject: 3 },
    },
  };
});

describe("AI PDF Tutor MVP", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tutorMocks.askTutor.mockImplementation(({ index, question, scope, currentPage }) => (
      Promise.resolve(answerFromDocument(index, { question, scope, currentPage }))
    ));
  });

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
    await act(async () => {
      for (let index = 0; index < 30; index += 1) await Promise.resolve();
    });
    expect(screen.getByText(/đã lập index 5 trang/i)).toBeInTheDocument();
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
    expect(screen.getByText(/chỉ dùng bằng chứng từ trang 2/i)).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole("button", { name: /trang trước/i }));
    expect(screen.getByText(/trang 1 trình bày machine learning/i, { selector: ".chat-message.assistant p" })).toBeInTheDocument();
    expect(screen.getByText(/nguồn · trang 1/i)).toBeInTheDocument();
    expect(screen.getByText("Tóm tắt trang này.")).toBeInTheDocument();
  });

  it("switches to whole-lesson retrieval and cites multiple pages", async () => {
    await openSampleDocument();
    fireEvent.click(screen.getByRole("button", { name: /toàn bộ bài/i }));
    const input = screen.getByLabelText(/câu hỏi về toàn bộ bài học/i);
    fireEvent.change(input, { target: { value: "Toàn bài nói gì về precision và recall?" } });
    fireEvent.click(screen.getByRole("button", { name: /gửi câu hỏi/i }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/nguồn · trang 1, 2, 3, 4/i)).toBeInTheDocument();
  });

  it("resets the PDF and all page chat state", async () => {
    await openSampleDocument();
    fireEvent.click(screen.getByRole("button", { name: /tải file khác/i }));
    expect(screen.getByRole("heading", { name: /ai tutor đọc cùng/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dùng tài liệu mẫu/i })).toBeEnabled();
  });
});
