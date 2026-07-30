import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const apiMocks = vi.hoisted(() => ({
  listSlideDocuments: vi.fn(),
  getProcessedSlides: vi.fn(),
  askTutor: vi.fn(),
}));

vi.mock("./services/tutorApi", () => apiMocks);

vi.mock("react-pdf", async () => {
  const React = await import("react");

  function Document({
    children,
    onLoadSuccess,
  }: {
    children: ReactNode;
    onLoadSuccess?: (pdf: { numPages: number }) => void;
  }) {
    React.useEffect(() => {
      onLoadSuccess?.({ numPages: 5 });
    }, [onLoadSuccess]);
    return <div data-testid="pdf-document">{children}</div>;
  }

  function Page({ pageNumber, renderTextLayer }: { pageNumber: number; renderTextLayer?: boolean }) {
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

const documents = [
  { id: "d2-slide-hackathon", filename: "d2-slide-hackathon.pdf", title: "D2 Slide Hackathon", url: "/api/slides/documents/d2-slide-hackathon/file" },
  { id: "day01-slide-blue-v0", filename: "day01-slide-blue-v0.pdf", title: "Day01 Slide Blue V0", url: "/api/slides/documents/day01-slide-blue-v0/file" },
];

const processed = {
  document_id: documents[0].id,
  filename: documents[0].filename,
  status: "ready" as const,
  total_pages: 5,
  slides: Array.from({ length: 5 }, (_, index) => ({
    filename: documents[0].filename,
    page_number: index + 1,
    text: `Slide ${index + 1}`,
    element_types: ["NarrativeText"],
  })),
};

describe("automatic slide AI Tutor flow", () => {
  beforeEach(() => {
    apiMocks.listSlideDocuments.mockResolvedValue(documents);
    apiMocks.getProcessedSlides.mockResolvedValue(processed);
    apiMocks.askTutor.mockImplementation(({ currentPage }) => Promise.resolve({
      answer: `Nội dung được lấy từ slide ${currentPage}.`,
      citations: [{ page_number: currentPage, reason: "Slide hiện tại hỗ trợ câu trả lời." }],
      insufficient_context: false,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  async function openDefaultDocument() {
    render(<App />);
    expect(screen.getByText(/đang tìm tài liệu pdf/i)).toBeInTheDocument();
    await screen.findByText(/nội dung bài học đã sẵn sàng/i);
    expect(apiMocks.getProcessedSlides).toHaveBeenCalledWith("d2-slide-hackathon");
  }

  it("uses the first discovered PDF automatically and offers simple selection", async () => {
    await openDefaultDocument();
    expect(screen.queryByLabelText(/chọn file pdf/i)).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /chọn tài liệu/i })).toHaveValue("d2-slide-hackathon");
    expect(screen.getByTestId("pdf-document")).toBeInTheDocument();
  });

  it("shows the required empty state when data/slide has no PDF", async () => {
    apiMocks.listSlideDocuments.mockResolvedValue([]);
    render(<App />);
    expect(await screen.findByText(/không tìm thấy tài liệu pdf trong thư mục data\/slide/i)).toBeInTheDocument();
    expect(apiMocks.getProcessedSlides).not.toHaveBeenCalled();
  });

  it("navigates Previous/Next and never exceeds the PDF page range", async () => {
    await openDefaultDocument();
    const previous = screen.getByRole("button", { name: /trang trước/i });
    const next = screen.getByRole("button", { name: /trang tiếp theo/i });
    expect(previous).toBeDisabled();
    expect(screen.getByText("1", { selector: ".page-indicator strong" })).toBeInTheDocument();
    expect(screen.getByText("/ 5", { selector: ".page-indicator span:last-child" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mở trang 5/i }));
    expect(screen.getByRole("heading", { name: "Trang 5" })).toBeInTheDocument();
    expect(next).toBeDisabled();
    fireEvent.click(next);
    expect(screen.getByRole("heading", { name: "Trang 5" })).toBeInTheDocument();
  });

  it("sends the current page, renders [Slide 5], and keeps history after page changes", async () => {
    await openDefaultDocument();
    fireEvent.click(screen.getByRole("button", { name: /mở trang 5/i }));
    const input = screen.getByLabelText(/câu hỏi tại slide 5/i);
    fireEvent.change(input, { target: { value: "Slide này đang nói về gì?" } });
    fireEvent.click(screen.getByRole("button", { name: /gửi câu hỏi/i }));

    await waitFor(() => expect(apiMocks.askTutor).toHaveBeenCalledWith(expect.objectContaining({
      documentId: "d2-slide-hackathon",
      currentPage: 5,
      question: "Slide này đang nói về gì?",
      history: [],
    })));
    expect(await screen.findByText(/nội dung được lấy từ slide 5/i)).toBeInTheDocument();
    const citations = screen.getByLabelText(/nguồn trích dẫn/i);
    expect(within(citations).getByRole("button", { name: /slide 5/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /trang trước/i }));
    expect(screen.getByText("Slide này đang nói về gì?")).toBeInTheDocument();
    expect(screen.getByText(/nội dung được lấy từ slide 5/i)).toBeInTheDocument();
  });

  it("sends prior conversation as history for a whole-lesson follow-up", async () => {
    await openDefaultDocument();
    const input = screen.getByLabelText(/câu hỏi tại slide 1/i);
    fireEvent.change(input, { target: { value: "Slide này nói gì?" } });
    fireEvent.click(screen.getByRole("button", { name: /gửi câu hỏi/i }));
    await screen.findByText(/nội dung được lấy từ slide 1/i);

    fireEvent.change(input, { target: { value: "Tóm tắt toàn bộ bài học." } });
    fireEvent.click(screen.getByRole("button", { name: /gửi câu hỏi/i }));
    await act(async () => { await Promise.resolve(); });
    expect(apiMocks.askTutor.mock.calls[1][0].history).toHaveLength(2);
    expect(apiMocks.askTutor.mock.calls[1][0].question).toBe("Tóm tắt toàn bộ bài học.");
  });
});
