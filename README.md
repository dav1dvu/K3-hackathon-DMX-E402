# Slidewise AI Tutor - Mini Hackathon AI Batch 03

Slidewise AI Tutor là prototype trợ lý học tập cho phép học viên đọc PDF bài giảng và hỏi đáp theo nội dung slide. Hệ thống ưu tiên trả lời dựa trên tài liệu chính thức của buổi học, có citation về trang slide nguồn, và tránh tự bịa khi tài liệu không có thông tin.

## Thành viên nhóm

| Mã học viên | Họ tên                | Vai trò chính         | Phân công                                                                      |
| -------------- | ----------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| 01199          | Vũ Nguyễn Quốc Đạt | Product / Spec lead     | Viết problem statement, use case chính, quality bar, chuẩn bị demo narrative |
| 01233          | Nguyễn Hoàng Biên    | Backend / AI pipeline   | Xử lý PDF, API slide, gọi LLM, fallback khi provider lỗi                     |
| 01561          | Nguyễn Ngọc Nam       | Frontend / UX           | Giao diện đọc slide, khung chat, citation, trạng thái loading/error         |
| 01239          | Vũ Tú Quỳnh          | Evaluation / Validation | Golden set, metric, validation log, kiểm tra citation đúng trang              |
| 01385          | Trần Thị Ngọc Lan    | Demo / QA               | Test end-to-end, chuẩn bị demo script, ghi changelog và checklist nộp bài   |

## Problem Statement

Học viên khi xem lại slide bài giảng thường không nhớ chính xác nội dung nằm ở trang nào, đặc biệt với các khái niệm xuất hiện rải rác trong toàn bộ buổi học. Việc tự lật slide để tìm lại mất thời gian, dễ bỏ sót ngữ cảnh, và khó kiểm chứng câu trả lời nếu AI không chỉ rõ nguồn.

## Tính năng chính

- Tự phát hiện PDF trong `data/slide`
- Hiển thị slide PDF trên frontend.
- Chat hỏi đáp theo slide hiện tại hoặc toàn bộ bài học.
- Trả lời có citation theo trang slide.
- Cho phép người dùng mở lại trang nguồn từ citation.
- Xử lý PDF server-side bằng Python/Unstructured và cache kết quả trong `data/processed`.
- Gọi LLM qua backend, không để API key trong frontend.
- Có fallback trả lời từ nội dung slide đã xử lý nếu LLM/provider lỗi.

## AI Decision Chính

Hệ thống dùng quyết định AI/retrieval theo scope câu hỏi:

| Scope            | Ví dụ                                            | Cách xử lý                                                        |
| ---------------- | -------------------------------------------------- | -------------------------------------------------------------------- |
| CURRENT_SLIDE    | “Slide này nói gì?”                           | Ưu tiên slide hiện tại                                           |
| SPECIFIC_PAGE    | “Trang 21 nói gì về context window?”          | Tìm đúng trang được nhắc tới                                 |
| FULL_LESSON      | “Tóm tắt các chủ đề chính của bài học” | Tìm trong nhiều slide liên quan                                   |
| OUTSIDE_MATERIAL | “GPT-5 context window bao nhiêu?”               | Không tự bịa; cần nói rõ tài liệu không có thông tin      |
| AMBIGUOUS        | “Cái này khác cái kia thế nào?”            | Cần ngữ cảnh rõ hơn hoặc dùng slide hiện tại nếu phù hợp |

## Cấu trúc dự án

```text
K3-hackathon-DMX-E402/
|-- frontend/                 # React + Vite, giao diện đọc PDF và chat
|   |-- index.html
|   |-- public/
|   |-- src/
|   |   |-- components/      # UI components
|   |   |-- rag/             # Logic RAG/test frontend cũ
|   |   |-- services/        # API client gọi backend
|   |   |-- styles/          # CSS
|   |   |-- types/           # TypeScript types
|   |   |-- App.tsx
|   |   `-- main.tsx
|   `-- vite.config.ts
|
|-- backend/                  # Express + TypeScript backend
|   |-- src/
|   |   |-- llm/             # LLM config, provider, core caller
|   |   |-- slides/          # PDF processing, cache, slide chat API
|   |   |-- tutor/           # Grounded generation utilities
|   |   |-- app.ts
|   |   `-- index.ts
|
|-- data/
|   |-- slide/                # Đặt PDF bài giảng ở đây
|   `-- processed/            # Cache JSON sinh tự động, không commit
|-- eval/                     # Golden set / script đánh giá
|-- validation/               # Log validation người dùng
|-- docs/                     # Tài liệu kỹ thuật
|-- .env                      # API key backend, không commit
|-- .env.example              # Mẫu cấu hình
|-- package.json              # Script chạy chung FE/BE
|-- requirements.txt          # Python dependencies
`-- README.md
```

## Cài đặt

Chạy từ thư mục root của repo.

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Cấu hình `.env`:

```env
LLM_PRIMARY_PROVIDER=gemini
LLM_PRIMARY_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_PRIMARY_API_KEY=your_api_key_here
LLM_PRIMARY_MODEL=gemini-flash-latest

LLM_TIMEOUT_MS=20000
LLM_MAX_RETRIES=1
LLM_RETRY_BASE_DELAY_MS=250
PORT=3001

PYTHON_EXECUTABLE=.venv\Scripts\python.exe
PDF_PROCESSING_TIMEOUT_MS=120000
PDF_PARTITION_STRATEGY=fast
PDF_INFER_TABLE_STRUCTURE=false
```

Không commit `.env` hoặc API key.

## Thêm tài liệu mới

Đặt file PDF vào:

```text
data/slide/
```

Khuyến nghị đặt tên không dấu để tránh lỗi đường dẫn trên Windows:

```text
data/slide/day03.pdf
```

Nếu muốn xử lý lại từ đầu, xóa cache tương ứng:

```powershell
Remove-Item data\processed\day03.json -ErrorAction SilentlyContinue
```

## Chạy prototype

Chạy cả frontend và backend:

```powershell
npm run dev
```

Mặc định:

- Backend: `http://127.0.0.1:3001`
- Frontend: Vite sẽ báo URL, thường là `http://localhost:5173` hoặc `http://localhost:5174`

Chạy riêng từng phần:

```powershell
npm run dev:server
npm run dev:web
```

## API chính

| Method | Endpoint                                     | Mục đích                             |
| ------ | -------------------------------------------- | --------------------------------------- |
| GET    | `/api/health`                              | Kiểm tra backend sống                 |
| GET    | `/api/llm/health`                          | Kiểm tra provider LLM                  |
| GET    | `/api/slides/documents`                    | Danh sách PDF trong`data/slide`      |
| GET    | `/api/slides/documents/:documentId/file`   | Lấy file PDF                           |
| GET    | `/api/slides/documents/:documentId/slides` | Xử lý/lấy nội dung slide đã cache |
| POST   | `/api/slides/documents/:documentId/chat`   | Hỏi đáp theo tài liệu              |

Ví dụ request chat:

```json
{
  "current_page": 1,
  "question": "Slide này nói gì?",
  "history": []
}
```

## Kiểm thử

```powershell
npm run typecheck
npm run test:server
npm run test:web
npm test
npm run build
```

Trạng thái gần nhất:

- Backend tests: pass.
- Typecheck: pass.
- Frontend phụ thuộc trạng thái test/UI hiện tại, cần chạy lại trước khi nộp.

## Validation

Template/log validation nằm ở:

```text
validation/template.md
```

Nhóm cần thay dữ liệu mock bằng log người dùng thật trước khi nộp. Tối thiểu nên có:

- 3-5 phiên test thật.
- Câu hỏi người dùng nhập nguyên văn.
- Câu trả lời AI.
- Citation đúng/sai.
- Quote người dùng sau phiên test.
- Changelog dựa trên feedback.

## Metric đề xuất

| Metric                                               | Mục tiêu                       |
| ---------------------------------------------------- | -------------------------------- |
| Tỷ lệ trả lời đúng                             | >= 80% trên golden set nội bộ |
| Tỷ lệ citation đúng trang                        | >= 80%                           |
| Tỷ lệ tìm được nội dung ở trang khác        | >= 70%                           |
| Tỷ lệ không bịa khi tài liệu thiếu thông tin | >= 90%                           |
| Tỷ lệ mở được trang nguồn                     | >= 90%                           |

## Rủi ro và giới hạn

- Một số PDF có encryption/metadata lỗi khiến `pdf-lib` không đọc được số trang; backend đã fallback sang `pdfinfo`.
- LLM provider có thể rate limit hoặc reject model; backend có fallback trả lời từ nội dung slide đã xử lý.
- Transcript timestamp chưa hoàn chỉnh trong prototype hiện tại.
- Intent classification đang ở mức rule/retrieval đơn giản, chưa phải classifier riêng hoàn chỉnh.
- Câu trả lời ngoài tài liệu cần được kiểm soát rõ để không lẫn với nội dung chính thức của giảng viên.

## Demo Script Ngắn

1. Mở frontend.
2. Chọn `day03.pdf`.
3. Đợi trạng thái xử lý xong.
4. Hỏi: `Slide này nói gì?`
5. Hỏi: `ReAct được giải thích ở đâu?`
6. Hỏi: `Tóm tắt các chủ đề chính của bài học.`
7. Hỏi: `GPT-5 context window bao nhiêu?`
8. Bấm citation để mở slide nguồn.

## Changelog

| Thời điểm | Thay đổi                                                | Lý do                                                             |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------ |
| 31/07/2026   | Tách cấu trúc`frontend/` và `backend/`            | Giảm nhầm lẫn FE/BE, dễ demo và bảo trì                     |
| 31/07/2026   | Thêm xử lý PDF server-side và cache`data/processed` | Cho phép hỏi đáp trên PDF thật                               |
| 31/07/2026   | Fallback đọc số trang bằng`pdfinfo`                 | Day03 là PDF encrypted/object lỗi khiến`pdf-lib` fail         |
| 31/07/2026   | Giới hạn context gửi LLM                               | Giảm rate limit và giảm prompt quá dài                        |
| 31/07/2026   | Thêm fallback khi LLM lỗi                               | Tránh UI chỉ hiện lỗi chung, vẫn có câu trả lời từ slide |
| 31/07/2026   | Đổi model mặc định sang`gemini-flash-latest`       | Model cũ không còn khả dụng hoặc quota lỗi                  |
