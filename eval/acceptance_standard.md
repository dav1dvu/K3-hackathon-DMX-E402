# Quality bar — chốt tại spec.md, không đổi sau khi thấy kết quả

**Đạt khi ≥80% qua bộ 20 case (`eval_cases.json`), VÀ zero-tolerance cho hai lỗi sau (chỉ cần 1 case dính là KHÔNG đạt bất kể % tổng thể):**

- **`UNSUPPORTED_ASSERTED_ANSWER`** — trả lời khẳng định một điều tài liệu không thực sự nói (kể cả khi có trích dẫn kèm theo, như case CP3-002/CP3-003 dùng để bẫy lỗi này).
- **`INVALID_CITATION`** — trích dẫn số trang không nằm trong bằng chứng đã truy xuất, hoặc ngoài `total_pages` của tài liệu. Lỗi này đã có một lớp chặn cứng ở code (`server/tutor/grounded-generation.ts` — validate `sourcePages ⊆ allowedPages`), nên về lý thuyết không thể lọt qua nếu code chạy đúng; eval vẫn đo lại để xác nhận.

Không có case nào được phép ở trạng thái `blocked` (crash/timeout không trả được kết quả).

## Cách chấm từng case

Với mỗi case trong `eval_cases.json`, so khớp `expected` với kết quả thật của `generateTutorAnswer`:

| Trường `expected` | Điều kiện đạt |
|---|---|
| `insufficientContext: true` | Kết quả thật phải có `insufficientContext === true` |
| `insufficientContext: false` | Kết quả thật phải có `insufficientContext === false` |
| `insufficientContext: "either"` | Không bắt buộc — chuyển sang `manualReview` |
| `mustIncludePages: [...]` | `sourcePages` thật phải chứa mọi trang trong danh sách này |
| `mustOnlyBeAmongPages: [...]` | Mọi phần tử của `sourcePages` thật phải nằm trong danh sách này (không lẫn trang khác) |
| `minDistinctPages: N` | `sourcePages` thật phải có ≥N trang khác nhau |
| `manualReview: true` | Không chấm tự động — đọc `answer` thật và áp `manualReviewNote` bằng mắt |

Vì `INVALID_CITATION` đã được chặn ở tầng code, mọi case có `insufficientContext=false` mặc nhiên có citation hợp lệ (nếu không hợp lệ, hệ thống tự chuyển case đó thành `insufficientContext=true` với thông báo "Không thể xác minh câu trả lời..." trước khi trả về) — script chấm không cần tự kiểm tra lại điều này, chỉ cần đối chiếu đúng `sourcePages` mong đợi.

## Cách chạy

```
cd codebase
npx tsx ../eval/run-eval.ts
```

Cần `.env` (trong `codebase/`) có `LLM_PRIMARY_*` hợp lệ — script gọi LLM thật qua đúng `LLMCore`/`generateTutorAnswer` đang dùng trong sản phẩm, không mock. Kết quả ghi ra `eval/eval_results.json` (chi tiết từng case) và `eval/eval_summary.md` (bảng tổng hợp, tự động, không chỉnh tay).

## Giới hạn đã biết của bộ eval này

- Tài liệu dùng để test (`eval/fixtures/lesson.json`) là nội dung **tự soạn** (khái niệm AI/ML phổ thông), không phải trích nguyên văn slide/transcript thật — vì quy định bảo mật dữ liệu cấm commit nguyên văn tài liệu được cấp vào repo nộp bài. Câu hỏi test thì có lấy/phát triển từ chatlog thật (xem `sourceNote` từng case).
- Bộ 20 case này đo trên nhánh code hiện có trong `codebase/` (`/api/tutor/chat` + RAG trong `src/rag/`) — **khác nhánh** với lượt đo 13/20 đã ghi trong `spec.md §9` (đo trên nhánh `server/slides` không có trong repo này). Hai kết quả không so sánh trực tiếp được, chỉ dùng chung một bộ tiêu chí.
