# Reflection — Nguyễn Hoàng Biên (mã HV: 2A202601233)

## Vai trò trong nhóm

Phụ trách backend và AI pipeline cho prototype Slidewise AI Tutor. Phần việc chính của mình là xử lý tài liệu PDF thành dữ liệu theo từng trang, xây dựng API slide và API hỏi đáp, gọi LLM ở phía server, kiểm tra citation, đồng thời thiết kế cơ chế retry/fallback để hệ thống vẫn phản hồi khi provider chính gặp lỗi.

## Phần mình đã làm cụ thể

- Xây dựng `LLMCore` và adapter OpenAI-compatible, hiện được lưu tại `codebase/server/llm/`. Pipeline hỗ trợ cấu hình provider chính/provider dự phòng, timeout, retry cho lỗi tạm thời, chuẩn hóa lỗi HTTP, health check và structured output có kiểm tra schema. API key chỉ được dùng ở backend, không đưa xuống frontend.
- Xây dựng luồng xử lý PDF phía server tại `server/slides/document-service.ts` và `server/slides/partition_pdf.py`: tự phát hiện PDF trong `data/slide`, partition nội dung bằng Unstructured, giữ metadata số trang, tạo `lesson_context`, cache kết quả theo fingerprint của file và dùng in-flight promise để tránh xử lý trùng cùng một tài liệu.
- Xây dựng các endpoint slide trong `server/app.ts`, gồm lấy danh sách tài liệu, thông tin tài liệu, file PDF, nội dung đã xử lý và chat theo tài liệu. Document ID chỉ được lấy từ danh sách đã discover thay vì ghép trực tiếp thành đường dẫn file, giúp hạn chế truy cập sai phạm vi.
- Triển khai phần hỏi đáp trong `server/slides/chat-service.ts`: đặt nội dung trang hiện tại trước ngữ cảnh toàn bài, giới hạn lịch sử hội thoại, yêu cầu LLM trả JSON có cấu trúc và lọc citation trùng, ngoài phạm vi hoặc trỏ tới trang không tồn tại.
- Bổ sung hai lớp fallback. Trong `codebase/server/llm/core.ts`, nếu provider chính gặp lỗi phù hợp thì hệ thống retry rồi chuyển sang provider dự phòng.
- Bổ sung `backend/src/slides/json-document-service.ts` để hệ thống có thể đọc các file JSON đã xử lý sẵn khi môi trường demo không chạy được OCR/Python hoặc thiếu PDF gốc. Service có kiểm tra cấu trúc dữ liệu, cache trong bộ nhớ và test cho các trường hợp file thiếu, file sai định dạng, slide rỗng và citation sai trang.

## AI hỗ trợ thế nào

Mình dùng AI như một công cụ pair programming để gợi ý cấu trúc module, liệt kê các tình huống lỗi của provider/PDF parser và hỗ trợ tạo khung test. Sau đó mình tự đối chiếu đề xuất với luồng chạy thật và sửa lại những điểm chưa phù hợp:

- Đọc lại log ở từng tầng để phân biệt lỗi partition PDF, đọc số trang, retrieval, structured output và lỗi provider.
- Kiểm tra response HTTP thật và ánh xạ riêng các lỗi authentication, rate limit, timeout, network và provider 5xx thay vì xử lý tất cả như một lỗi chung.
- Viết test cho retry, timeout, chuyển provider, schema JSON, giới hạn history và lọc citation; không chỉ kiểm tra happy path.
- Kiểm tra lại citation ở backend bằng tập số trang có trong evidence, không tin trực tiếp số trang do model sinh ra.

AI giúp mình triển khai và rà soát nhanh hơn, nhưng quyết định cuối cùng vẫn dựa trên code, log, request thực tế và test của hệ thống.

## Một bài học từ case fail của chính nhóm

Case CP3-003 trong `eval/eval_summary.md` hỏi tác giả của tài liệu, trong khi trang 1 chỉ ghi “Instructor: Minh Tran”. Model đã suy diễn “Instructor” là “tác giả”, trả lời rất tự tin và trích đúng trang 1. Citation này vượt qua bước kiểm tra kỹ thuật vì số trang tồn tại và nằm trong evidence, nhưng nội dung kết luận vẫn không được tài liệu chứng minh.

Từ case này mình học được rằng kiểm tra citation hợp lệ về mặt cấu trúc chỉ chặn được trang giả hoặc trang ngoài phạm vi, chưa kiểm tra được quan hệ giữa phát biểu và bằng chứng. Với hệ thống grounded AI, quality gate phải có thêm các case kiểm tra suy diễn quá mức; prompt cần yêu cầu model phân biệt thông tin được nêu trực tiếp với suy luận, và khi tài liệu không xác nhận thì phải trả `insufficientContext` thay vì khẳng định. Vì CP3-003 là lỗi zero-tolerance, nhóm giữ kết quả quality gate là FAIL dù sau soát tay đạt 17/18 case hợp lệ.
