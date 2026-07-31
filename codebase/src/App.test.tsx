import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { answerFromDocument } from "./rag/grounding";
import App from "./App";
import type { DayRecord } from "./types";

const tutorMocks = vi.hoisted(() => ({ askTutor: vi.fn() }));
const libraryMocks = vi.hoisted(() => ({
  fetchLibrary: vi.fn(),
  createDay: vi.fn(),
  setDayPublished: vi.fn(),
  deleteDay: vi.fn(),
  uploadMaterial: vi.fn(),
  deleteMaterial: vi.fn(),
}));

vi.mock("./services/tutorApi", () => ({ askTutor: tutorMocks.askTutor }));
vi.mock("./services/libraryApi", () => ({
  fetchLibrary: libraryMocks.fetchLibrary,
  createDay: libraryMocks.createDay,
  setDayPublished: libraryMocks.setDayPublished,
  deleteDay: libraryMocks.deleteDay,
  uploadMaterial: libraryMocks.uploadMaterial,
  deleteMaterial: libraryMocks.deleteMaterial,
  materialFileUrl: (materialId: string) => `/api/library/files/${materialId}`,
}));

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

const sampleDays: DayRecord[] = [
  {
    id: "day-1",
    title: "Day01",
    published: true,
    materials: [
      {
        id: "material-1",
        fileName: "slides.pdf",
        displayName: "Bài giảng Day01",
        pageCount: 5,
        uploadedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  },
];

describe("VLearn AI study assistant", () => {
  beforeEach(() => {
    window.localStorage.clear();
    tutorMocks.askTutor.mockImplementation(({ index, question, scope, currentPage }) => (
      Promise.resolve(answerFromDocument(index, { question, scope, currentPage }))
    ));
    libraryMocks.fetchLibrary.mockResolvedValue(sampleDays);
  });

  afterEach(() => {
    cleanup();
  });

  async function loginAsStudent(name = "Lan") {
    render(<App />);
    fireEvent.change(screen.getByPlaceholderText(/nhập tên của bạn/i), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: /vào vlearn/i }));
    await screen.findByText(sampleDays[0].title);
  }

  async function openFirstMaterial() {
    await loginAsStudent();
    fireEvent.click(await screen.findByRole("button", { name: /bài giảng day01/i }));
    await act(async () => {
      for (let index = 0; index < 30; index += 1) await Promise.resolve();
    });
    expect(await screen.findByText(/đã lập index 5 trang/i)).toBeInTheDocument();
  }

  it("logs in as a student and lists the published library", async () => {
    await loginAsStudent();
    expect(screen.getByText(/1 tài liệu/i)).toBeInTheDocument();
  });

  it("opens a material, renders a selectable text layer and navigates PDF pages", async () => {
    await openFirstMaterial();
    const previous = screen.getByRole("button", { name: /trang trước/i });
    const next = screen.getByRole("button", { name: /trang tiếp theo/i });
    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    expect(screen.getAllByTestId("pdf-page-1").some((page) => page.dataset.textLayer === "true")).toBe(true);

    for (let i = 0; i < 4; i += 1) fireEvent.click(next);
    expect(screen.getByRole("heading", { name: "Trang 5" })).toBeInTheDocument();
    expect(next).toBeDisabled();
    expect(previous).toBeEnabled();
  });

  it("keeps chat history by page and answers for the page at send time", async () => {
    await openFirstMaterial();
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
    await openFirstMaterial();
    fireEvent.click(screen.getByRole("button", { name: /toàn bộ bài/i }));
    const input = screen.getByLabelText(/câu hỏi về toàn bộ bài học/i);
    fireEvent.change(input, { target: { value: "Toàn bài nói gì về precision và recall?" } });
    fireEvent.click(screen.getByRole("button", { name: /gửi câu hỏi/i }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/nguồn · trang 1, 2, 3, 4/i)).toBeInTheDocument();
  });

  it("prefills the chat composer when asking AI about a text selection", async () => {
    await openFirstMaterial();
    const pageNode = screen.getByTestId("pdf-page-1");
    const range = document.createRange();
    range.selectNodeContents(pageNode);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));

    const popoverButton = await screen.findByRole("button", { name: /hỏi ai về đoạn này/i });
    fireEvent.click(popoverButton);

    const composer = screen.getByLabelText(/câu hỏi về trang 1/i) as HTMLTextAreaElement;
    expect(composer.value).toMatch(/giải thích đoạn này giúp mình/i);
  });

  it("logs out back to the login screen", async () => {
    await openFirstMaterial();
    fireEvent.click(screen.getByRole("button", { name: /đăng xuất/i }));
    expect(screen.getByRole("heading", { name: /đăng nhập/i })).toBeInTheDocument();
  });

  it("logs in as an admin and sees the management screen instead of the chat", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("radio", { name: /admin/i }));
    fireEvent.change(screen.getByPlaceholderText(/nhập tên của bạn/i), { target: { value: "Cô Mai" } });
    fireEvent.click(screen.getByRole("button", { name: /vào vlearn/i }));

    expect(await screen.findByText(sampleDays[0].title)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/tên buổi học mới/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/câu hỏi về trang/i)).not.toBeInTheDocument();
  });
});
