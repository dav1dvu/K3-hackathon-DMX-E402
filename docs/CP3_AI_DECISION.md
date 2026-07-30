# CP3 — Quyết định AI và model

AI quyết định câu hỏi có đủ bằng chứng trong các slide được truy xuất để trả lời kèm đúng trang nguồn, hay phải yêu cầu làm rõ/từ chối vì thiếu bằng chứng hoặc vượt ngoài khả năng đọc tài liệu.

Lần đánh giá CP3 dùng model `gemma-4-26b-a4b-it` qua Gemini OpenAI-compatible API. Provider và model vẫn được cấu hình bằng biến môi trường; `eval_results.json` là nguồn xác nhận cấu hình thực tế của từng lần chạy.

Đây là quyết định đặc trưng của AI Tutor: hệ thống phải chọn giữa trả lời có căn cứ, yêu cầu làm rõ và từ chối; đồng thời trả về `sourcePages` hợp lệ và `insufficientContext`, không chỉ sinh văn bản.

Contract: `answer` + `sourcePages` + `insufficientContext`. Retrieval giới hạn evidence theo trang/toàn bài; grounded generation cấm kiến thức ngoài evidence và citation không có thật.
