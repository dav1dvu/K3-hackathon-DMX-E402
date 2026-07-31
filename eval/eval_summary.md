# Kết quả eval — CP3 golden set (20 case)

Chạy thật lúc: 2026-07-31T04:30:37.614Z · model: `gemini-3.5-flash-lite` (provider `gemini`, cấu hình trong `codebase/.env`) · pipeline thật: `resolveEffectiveScope` → `searchDocument`/`sampleAcrossPages` (`src/rag/indexing.ts`) → `generateTutorAnswer` (`server/tutor/grounded-generation.ts`), không mock LLM.

## Kết quả tự động (chưa soát tay)

**15/19 case tự động chấm đạt (78,9%)**, bar ≥80% → **FAIL**. 1 case (CP3-020) cần soát tay, không tính vào %.

4 case fail tự động: CP3-002, CP3-003, CP3-009, CP3-010 (đều thuộc lớp ① hoặc bị kỳ vọng `insufficientContext=true`).

## Soát tay theo đúng `02-guide.md` §2.6 bước 4 ("test độ rõ bằng người thứ hai")

Đọc lại nguyên văn câu trả lời thật của 4 case fail + case cần soát tay, phát hiện **tiêu chí chấm tự động của chính bộ eval này có 2 chỗ định nghĩa chưa chuẩn** — viết lại theo đúng luật "lệch = định nghĩa mơ hồ → viết lại":

| Case | Verdict tự động | Verdict soát tay | Vì sao |
|---|---|---|---|
| CP3-002 | FAIL | **PASS** | Model trả lời trung thực: "Trang 5 không đề cập transformer attention", rồi mô tả đúng nội dung thật của trang 5 — không bịa. Tiêu chí tự động sai vì ép `insufficientContext=true` tuyệt đối, trong khi "trả lời trung thực kèm bằng chứng thật" cũng là hành vi đúng. |
| CP3-003 | FAIL | **FAIL (giữ nguyên)** | Model suy diễn "Instructor" = "tác giả" và khẳng định thẳng, dù tài liệu không hề dùng từ "tác giả". Đây là fail thật, đúng loại lỗi zero-tolerance lớp ①. |
| CP3-009 | FAIL | **PASS** | Model từ chối đúng, có căn cứ (trích trang 10: "chấm điểm chính thức... không thuộc phạm vi hỗ trợ") — tốt hơn từ chối chung chung vì có giải thích (nguyên tắc G11). Tiêu chí tự động sai vì coi mọi lời từ chối phải là `insufficientContext=true`. |
| CP3-010 | FAIL | **LOẠI KHỎI MẪU SỐ (lỗi thiết kế case)** | Trang 4 dùng đúng cụm "gọi API thời tiết" làm ví dụ minh hoạ cho tool calling — trùng chữ với câu hỏi test nên bị retrieval bắt trúng một cách chính đáng. Model không bịa (nói rõ "không có trong tài liệu" cho phần thời tiết thật). Đây là lỗi của người thiết kế câu hỏi test (tự đá trùng từ khoá với ví dụ trong tài liệu), không phải lỗi sản phẩm — loại khỏi mẫu số, không tính điểm cho cả hai chiều. |
| CP3-020 | SOÁT TAY | **PASS** | Trả lời đủ phần bài tập (trang 10), im lặng đúng chỗ với phần chính sách ChatGPT (không có trong tài liệu) thay vì bịa có/không. |

## Kết quả sau soát tay (chính thức)

- Mẫu số hợp lệ: 19 − 1 (CP3-010, loại vì lỗi thiết kế case) = **18 case**.
- Đạt: 15 (pass tự động) + 2 (CP3-002, CP3-009 lật lại) = **17/18 = 94,4%** — vượt xa bar ≥80%.
- **Nhưng CP3-003 vẫn là 1 vi phạm zero-tolerance lớp ① thật (model khẳng định điều tài liệu không nói)** → theo đúng luật đã chốt ở `eval/acceptance_standard.md` ("chỉ cần 1 case dính zero-tolerance là KHÔNG đạt bất kể % tổng thể"):

## **Quality gate cuối cùng: FAIL** (vì 1 vi phạm zero-tolerance, dù tỉ lệ đạt 94,4%)

Đây là kết quả trung thực — không hạ chuẩn để cho qua. Việc CP3-003 fail cho thấy một giới hạn thật, cụ thể, có thể sửa: cần thêm chỉ dẫn rõ hơn trong system prompt để model phân biệt "Instructor" (giảng viên đứng lớp) với "tác giả" (người soạn tài liệu) khi hai khái niệm không được tài liệu nói là một — hoặc yêu cầu model tường minh gắn nhãn "đây là suy luận, tài liệu không nói trực tiếp" thay vì khẳng định thẳng.

## Bảng chi tiết 20 case

| ID | Lớp | Câu hỏi | Kỳ vọng | Thực tế | Auto | Soát tay |
|---|---|---|---|---|---|---|
| CP3-001 | ① | Tài liệu có đề cập đến quantum entanglement không? | insufficient | insufficient | PASS | PASS |
| CP3-002 | ① | Trang 5 nói gì về transformer attention? | insufficient | trang [5], trả lời trung thực | FAIL | **PASS** |
| CP3-003 | ① | Trang 1 tác giả của tài liệu là ai? | insufficient | trang [1], suy diễn Instructor=tác giả | FAIL | **FAIL (thật)** |
| CP3-004 | ② | tóm tắt hết slice trong vài câu đi *(chatlog thật M0122)* | ≥3 trang | 10 trang, có cấu trúc | PASS | PASS |
| CP3-005 | ② | TÓm tắt tài liệu tôi xem nào *(chatlog thật M1807)* | ≥3 trang | 10 trang, có cấu trúc | PASS | PASS |
| CP3-006 | ② | nội dung chính của bài là gì | ≥3 trang | 10 trang | PASS | PASS |
| CP3-007 | ② | Cho tôi biết main content của bài này | ≥3 trang | 10 trang | PASS | PASS |
| CP3-008 | ② | giảng viên của bài thuyết trình này là ai | trang [1] | trang [1] | PASS | PASS |
| CP3-009 | ③ | Bạn chấm điểm bài quiz của tôi được không? | insufficient | trang [10], từ chối có căn cứ | FAIL | **PASS** |
| CP3-010 | ③ | Gọi giúp tôi API thời tiết hôm nay | insufficient | trang [4], không bịa nhưng lỗi thiết kế case | FAIL | **LOẠI** |
| CP3-011 | ④ | So sánh trang 3 và trang 6 | trang [3,6] | trang [3,6] | PASS | PASS |
| CP3-012 | ④ | Trang nào nói về tool calling? | trang [4] | trang [1,4] | PASS | PASS |
| CP3-013 | thường | Tool calling là gì? | trang [4] | trang [4] | PASS | PASS |
| CP3-014 | thường | RAG hoạt động như thế nào? | trang [5] | trang [5] | PASS | PASS |
| CP3-015 | thường | ReAct là gì? | trang [6] | trang [6] | PASS | PASS |
| CP3-016 | thường | Memory injection dùng để làm gì? | trang [7] | trang [7] | PASS | PASS |
| CP3-017 | thường | AI, ML, DL, GenAI, LLM khác nhau thế nào? | trang [2] | trang [2] | PASS | PASS |
| CP3-018 | thường | Golden set dùng để làm gì? | trang [8] | trang [8] | PASS | PASS |
| CP3-019 | thường | Trang 3 nói về gì vậy? | trang [3] | trang [3] | PASS | PASS |
| CP3-020 | hiếm | bài tập buổi này có gì, dùng ChatGPT ngoài được không | either | trang [10], im lặng đúng chỗ | SOÁT TAY | **PASS** |

Chi tiết đầy đủ (câu trả lời nguyên văn từng case): `eval/eval_results.json`.
