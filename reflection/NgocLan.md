# Reflection — [Tên thành viên] (mã HV: [___])

> Copy file này thành `reflection/<ten-cua-ban>.md` và tự điền — mỗi người 1 file, viết bằng lời của chính mình. Theo `04-rubric.md — Reflection cá nhân`: chấm riêng, và **bị hỏi tại CP5/CP6 mà không giải thích được phần có tên mình → 0 điểm phần cá nhân liên quan** (vibe-coding rule) — nên đừng để AI viết hộ phần này.

## Vai trò trong nhóm

Phụ trách mảng: QA, demo

## Phần mình đã làm cụ thể

- Đổi tên/định vị lại tính năng chat trên UI: "Hỏi đáp có nguồn" → "Trợ lý học tập", đổi icon (sparkle → mũ tốt nghiệp) ở cả 4 chỗ hiển thị avatar trợ lý (`codebase/src/components/ChatPanel.tsx`, `ChatMessage.tsx`).
- Vai trò tester: chạy bộ eval CP3 20 case (`eval/run-eval.ts`) qua LLM thật (Gemini), đọc lại từng câu trả lời thật thay vì chỉ tin số % tự động — phát hiện 2 case (CP3-002, CP3-009) bị tiêu chí chấm tự động sai (bản thân câu trả lời đúng), và xác nhận 1 lỗi thật của model (CP3-003 — nhầm "Instructor" thành "tác giả").
- Vai trò demo: dựng `demo-slides.pptx` 6 trang theo đúng khung `02-guide.md §5.1`, dùng số liệu thật tự phân tích từ chatlog VLearn (không bịa số).

## Một bài học từ case fail của chính nhóm

Từ `eval/eval_summary.md` (case CP3-003): khi hỏi "trang 1 tác giả của tài liệu là ai" trên tài liệu chỉ ghi "Instructor: Minh Tran" (không có mục "tác giả" riêng), model tự suy diễn Instructor = tác giả và khẳng định thẳng thay vì nói rõ tài liệu không có thông tin này. Bài học: model có thể trả lời rất tự tin và có trích dẫn hợp lệ (đúng trang) nhưng vẫn suy diễn sai — trích dẫn đúng không đồng nghĩa với nội dung đúng, cần thiết kế câu hỏi test riêng cho đúng lỗi này thay vì chỉ tin vào cơ chế chặn citation sai trang.
