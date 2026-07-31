# Reflection - Vũ Tú Quỳnh (mã HV: 2A202601239)

## Vai trò trong nhóm

Mình phụ trách phần backend và AI pipeline cho prototype Slidewise AI Tutor. Trọng tâm công việc là giúp hệ thống đọc được PDF bài giảng, tạo ngữ cảnh theo từng trang, gọi mô hình ngôn ngữ ở server và trả câu trả lời có citation về đúng slide nguồn.

## Phần mình đã làm cụ thể

- Tham gia tổ chức lại code thành hai phần rõ ràng: frontend nằm trong `frontend/`, backend nằm trong `backend/`. Việc này giúp nhóm xác định được API key, xử lý PDF và gọi LLM phải nằm ở server, còn giao diện chỉ gọi các endpoint `/api`.
- Kiểm tra và sửa pipeline xử lý PDF trong `backend/src/slides/document-service.ts` và `backend/src/slides/partition_pdf.py`. Kết quả xử lý được lưu thành JSON trong `data/processed` để lần mở sau không phải partition lại toàn bộ tài liệu.
- Sửa lỗi Unstructured in warning vào stdout làm backend không parse được JSON. Mình tách warning sang stderr và giữ stdout là dữ liệu JSON mà Node có thể đọc.
- Sửa case `day03.pdf`: Unstructured đã lấy được 1.113 element trên 78 trang nhưng `pdf-lib` không đọc được page count vì PDF có encryption và object reference lỗi. Pipeline được bổ sung fallback sang `pdfinfo`, nhờ đó backend vẫn tạo được cache `data/processed/day03.json`.
- Tham gia phần hỏi đáp trong `backend/src/slides/chat-service.ts`: lựa chọn slide hiện tại và các slide liên quan theo từ khóa, giới hạn lượng context gửi lên LLM, kiểm tra citation có trỏ tới trang tồn tại, và trả fallback từ nội dung slide nếu provider tạm thời lỗi.
- Kiểm tra cấu hình LLM trong `.env` và adapter tại `backend/src/llm/providers/openai-compatible.ts`. Qua request trực tiếp, mình xác định một số model cũ trả 404 hoặc quota 0, sau đó chuyển cấu hình mẫu sang `gemini-flash-latest` là model đã phản hồi thành công với API key của nhóm.

## AI hỗ trợ thế nào

Mình dùng AI để hỗ trợ đọc log, đề xuất giả thuyết lỗi, viết một phần code TypeScript/Python và gợi ý test. Tuy nhiên mình không lấy kết quả AI làm bằng chứng cuối cùng. Với mỗi lỗi, mình tự kiểm tra lại bằng output thực tế:

- Gọi trực tiếp script `partition_pdf.py` để xác nhận PDF có được trích xuất hay không.
- So sánh output của `pdf-lib` và `pdfinfo` để tìm nguyên nhân Day03 không tạo cache.
- Gọi trực tiếp endpoint `/api/slides/documents/:id/chat` để phân biệt lỗi retrieval với lỗi provider.
- Gọi endpoint Gemini OpenAI-compatible để đọc status 404, 429 và 503 của từng model.
- Chạy `npm run typecheck` và `npm run test:server`; bộ backend có 34 test pass sau các thay đổi.

AI giúp mình đi nhanh hơn trong việc tìm vị trí cần kiểm tra, nhưng mình vẫn phải đọc log, xác nhận bằng request thật và sửa lại những đề xuất chưa phù hợp. Ví dụ, việc chỉ nhìn `/api/llm/health` là chưa đủ vì endpoint danh sách model có thể trả 200 trong khi request generate với model cụ thể vẫn trả 404.

## Một bài học từ case fail của chính nhóm

Case fail đáng nhớ nhất là `day03.pdf`. Ban đầu giao diện chỉ hiển thị trạng thái processing hoặc lỗi chung, nên nhóm tưởng Unstructured không đọc được tài liệu. Log chi tiết lại cho thấy bước partition đã hoàn thành với 1.113 element. Lỗi thật xảy ra sau đó: `pdf-lib` không đọc được số trang vì PDF được mã hóa và có object reference không hợp lệ. Khi thử bằng `pdfinfo`, công cụ vẫn đọc đúng 78 trang.

Từ case này mình học được rằng một pipeline AI thường có nhiều lớp lỗi: ingestion, parsing, cache, retrieval, provider và post-processing. Nếu chỉ nhìn lỗi ở giao diện thì rất dễ sửa nhầm tầng. Cách làm tốt hơn là đặt log theo từng mốc (`slide_partition_started`, `slide_partition_completed`, `slide_document_processed`), kiểm tra output trung gian và có fallback cho từng dependency quan trọng.

Bài học thứ hai đến từ phần LLM. Health check trả `ok` không có nghĩa là model generate được. Model `gemini-2.5-flash` vẫn xuất hiện trong danh sách nhưng request thực tế trả 404 đối với user mới; model khác có thể trả 429 do quota hoặc 503 do nhu cầu cao. Vì vậy health check đúng cần thử một request generate nhỏ với chính model đang cấu hình, đồng thời UI phải phân biệt lỗi provider với trường hợp tài liệu không có ngữ cảnh.

## Điều mình sẽ cải thiện nếu có thêm thời gian

- Tách intent classifier rõ thành `CURRENT_SLIDE`, `SPECIFIC_PAGE`, `FULL_LESSON`, `TRANSCRIPT`, `OUTSIDE_MATERIAL` và `AMBIGUOUS` thay vì chỉ dựa trên từ khóa.
- Thêm retrieval ranking và giới hạn token có đo lường thay vì giới hạn chủ yếu theo số ký tự.
- Thêm transcript thật với timestamp để citation có cả slide và thời gian bài giảng.
- Bổ sung health check bằng generate request nhỏ và hiển thị lỗi provider rõ ràng trên frontend.
- Thêm test integration với một PDF encrypted/corrupted-object giống Day03 để tránh lỗi này quay lại.