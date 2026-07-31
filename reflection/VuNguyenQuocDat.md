# Reflection — Vũ Nguyễn Quốc Đạt (mã HV: 2A202601199)

## Vai trò trong nhóm

Mình đóng vai trò **Product / Spec Lead** cho dự án Slidewise AI Tutor. Trọng tâm công việc của mình là chịu trách nhiệm về bài toán người dùng (Problem Statement & JTBD), khai phá dữ liệu bằng chứng (Evidence mining từ chatlog VLearn), xây dựng tài liệu thiết kế sản phẩm (`spec.md`), định nghĩa Quality Bar cùng bộ tiêu chuẩn chấp nhận (Acceptance Criteria), và xây dựng kịch bản demo (Demo Narrative) bám sát các đường đi trải nghiệm của người dùng.

## Phần mình đã làm cụ thể

- **Phân tích Chatlog VLearn & Thu thập Evidence đạt chuẩn B (`spec.md §1`)**:
  - Trực tiếp chạy lọc và đếm trên 2.522 dòng chatlog VLearn thật (`data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv` — 585 hội thoại, 1.261 turn).
  - Xác định được **130/1.261 turn (10,3%)** là câu hỏi về tóm tắt/tổng quan bài học ("tóm tắt", "toàn bộ bài", "nội dung chính"). Trong đó có **85 turn (65,4%) trả lời không có trích dẫn nguồn** (`citations: []`) và **79 turn (60,8%) AI xin lỗi kiểu "không tìm thấy nội dung"**.
  - Trích xuất 5 quote nguyên văn có `message_id/turn_id` cụ thể (như M0122, M0332, M1807...) làm bằng chứng thực tế chứng minh pain point tồn tại thực sự chứ không suy đoán cảm tính.

- **Soạn thảo & Đóng góp chính cho `spec.md`**:
  - Viết **Problem Statement chuẩn** (không nhắc tới từ "AI"): Tập trung vào nỗi đau học viên ôn bài slide PDF tốn thời gian lật tìm từng trang hoặc nhận câu trả lời không đáng tin/không trích dẫn nguồn.
  - Phân tích và lựa chọn **Impact Matrix (`spec.md §2`)**: Đề xuất chọn Ứng viên B (Tóm tắt & hỏi đáp xuyên toàn bài có trích dẫn) vì có 130 turn pain point đếm được, loại Ứng viên A (Multimodal) vì vượt effort 1,5 ngày hackathon và Ứng viên C (Gợi ý câu hỏi) vì không giải quyết con số 65,4% fail rate đã đo.
  - Định nghĩa **4 lớp chỗ khó & 10 kịch bản lỗi (`spec.md §5`)**: Bao gồm kịch bản bịa nguồn sự thật, kịch bản vỡ nhận diện ý định tóm tắt khi lọc từ đệm, và kịch bản trích dẫn đúng trang nhưng sai ngữ cảnh.
  - Xây dựng **4 đường đi trải nghiệm (`spec.md §6`) & Nguyên tắc HAX/PAIR (`spec.md §4b`)**: Quy định rõ hành vi hệ thống cho Happy path, Low-confidence, Failure (khi không đủ evidence trả `insufficientContext=true`), và Out-of-scope.

- **Xây dựng Quality Bar & Demo Narrative (`spec.md §7`, `README.md`)**:
  - Phối hợp với Quỳnh (Eval Lead) chốt Quality Bar: Hệ thống đạt khi **≥80% trên bộ 20 case CP3**, VÀ áp dụng luật **Zero-Tolerance** (0 lỗi suy diễn sai nguồn sự thật `UNSUPPORTED_ASSERTED_ANSWER` / `INVALID_CITATION`).
  - Thiết kế Kịch bản Demo 8 bước trong `README.md` phủ đầy đủ 4 đường trải nghiệm (từ hỏi slide hiện tại, hỏi tóm tắt toàn bài, đến hỏi ngoài phạm vi như GPT-5 context window để kiểm tra cơ chế chống bịa).

## AI hỗ trợ thế nào

- **Bước sử dụng AI**:
  - Dùng AI để hỗ trợ viết script Python/Shell regex đếm tần suất các từ khóa ("tóm tắt", "toàn bộ bài", "nội dung chính") và đếm trường `citations` rỗng trong file CSV chatlog.
  - Dùng AI gợi ý dàn ý tài liệu theo `03-template-ai-spec.md` và kiểm tra tính nhất quán giữa các mục trong `spec.md`.

- **Tự kiểm tra & Sửa đổi (Không tin AI 100%)**:
  - Con số đếm từ script AI: Mình tự mở file CSV ra kiểm tra lại mẫu 20 dòng ngẫu nhiên để xác nhận logic đếm `citations: []` và các mẫu câu xin lỗi của chatbot ("rất tiếc", "không thể tự động tổng hợp") không bị bắt nhầm/trùng lặp.
  - Định nghĩa Quality Bar: Ban đầu AI đề xuất Quality Bar lỏng lẻo (chỉ cần đạt 70% accuracy tổng thể). Mình chủ động bác bỏ và tự viết lại tiêu chuẩn nghiêm ngặt: **Phải đạt ≥80% VÀ Zero-Tolerance cho lỗi suy diễn sai nguồn**, vì đối với sản phẩm giáo dục, câu trả lời sai nguồn kiến thức gây hại nghiêm trọng đến lòng tin của học viên.
  - Trích dẫn quote nguyên văn: AI tự sinh trích dẫn thường bịa nội dung quote. Mình tự tra đúng `message_id` trong file chatlog gốc để chép nguyên văn câu hỏi và câu trả lời thật vào spec.

## Một bài học từ case fail của chính nhóm

Bài học xương máu nhất đến từ kết quả chạy Eval CP3 trên 20 case (`eval/eval_summary.md`, case **CP3-003**):

- **Tình huống fail**: Ở case CP3-003, khi được hỏi *"Trang 1 tác giả của tài liệu là ai?"*, trong khi slide PDF trang 1 chỉ ghi *"Instructor: Minh Tran"*. Model (`gemini-3.5-flash-lite`) đã tự suy diễn *"Instructor"* đồng nghĩa với *"tác giả"* và tự tin khẳng định thẳng *"Trang 1: Tác giả là Minh Tran"*.
- **Hậu quả**: Mặc dù sau khi soát tay bộ eval, tỉ lệ pass của nhóm đạt **17/18 case (94,4%)** — vượt xa ngưỡng 80%, nhưng vì vi phạm đúng 1 lỗi **Zero-Tolerance lớp ① (suy diễn khẳng định điều tài liệu không nói trực tiếp)** nên Quality Gate của toàn nhóm vẫn bị đánh giá **FAIL**.
- **Bài học rút ra**:
  1. **Trích dẫn đúng trang không đồng nghĩa với nội dung đúng (Citation alignment ≠ Semantic accuracy)**. Model có thể trích dẫn đúng trang 1, trả lời rất mạch lạc tự tin, nhưng vẫn đang tự bịa/suy diễn thêm khái niệm mà tài liệu không hề phát biểu.
  2. **Bài học làm Product / Spec**: Khi viết System Prompt và thiết kế Guardrail, không được chỉ dặn AI "hãy trích dẫn số trang", mà phải bắt buộc quy tắc nghiêm ngặt: Phân biệt rõ thông tin *khẳng định trực tiếp* và *thông tin suy luận*. Nếu tài liệu chỉ ghi "Instructor", AI phải trả lời *"Tài liệu không ghi rõ tác giả, chỉ ghi Instructor là Minh Tran"* hoặc báo `insufficientContext=true` chứ tuyệt đối không được tự ý gán ghép khái niệm.

## Điều mình sẽ cải thiện nếu có thêm thời gian

- Hoàn thiện Khảo sát người dùng (Đường A - chuẩn khảo sát ≥20 người) trước CP5 để kiểm chứng thêm mức độ sẵn sàng trả phí/sử dụng của học viên đối với tính năng tóm tắt slide.
- Bổ sung kịch bản kiểm thử riêng cho Kịch bản #9 trong spec: Trích dẫn đúng dạng nhưng sai nội dung (chèn 3-5 câu hỏi lừa dạng đồng nghĩa/suy diễn vào Golden Set).
- Tinh chỉnh System Prompt để xử lý triệt để lỗi suy diễn vai trò (Author vs Instructor) nhằm đưa Quality Gate từ FAIL sang PASS chính thức.
