# Validation Log - MOCK DATA - AI Tutor hỏi đáp slide

> CẢNH BÁO: Đây là dữ liệu giả lập do AI tạo để minh họa cách điền form. Không dùng file này như bằng chứng validation thật trong bài nộp. Khi có test người dùng thật, hãy thay toàn bộ nội dung bằng log quan sát thực tế.

## 1. Thông tin phiên test

| Trường | Nội dung |
|---|---|
| Mã phiên | MOCK-V-20260731-01 |
| Ngày giờ | 31/07/2026 10:30 |
| Người điều phối | Thành viên nhóm phụ trách validation |
| Người quan sát / ghi log | Thành viên nhóm phụ trách spec |
| Người thử | Người thử A (mock) |
| Vai trò người thử | Học viên |
| Tài liệu dùng test | day03.pdf - Từ Chatbot Đến Agentic Agent |
| Prototype version / commit | Local demo build sau khi tách FE/BE |
| Thiết bị / trình duyệt | Laptop Windows, Chrome |

## 2. Mục tiêu validation

- Kiểm tra người học có hỏi được về nội dung slide hiện tại.
- Kiểm tra AI có tìm được thông tin ở trang khác slide hiện tại.
- Kiểm tra citation có đúng trang nguồn và người dùng mở được trang nguồn.
- Kiểm tra hệ thống không bịa khi tài liệu không có thông tin.
- Kiểm tra người dùng có hiểu sự khác biệt giữa thông tin trong tài liệu và kiến thức ngoài.

## 3. Task giao cho người thử

| Task | Mục đích | Thành công khi |
|---|---|---|
| Đang ở slide 1, hỏi “Slide này nói gì?” | CURRENT_SLIDE | AI trả lời nội dung trang tiêu đề và cite slide 1 |
| Hỏi “ReAct được giải thích ở đâu?” | FULL_LESSON / cross-slide retrieval | AI tìm các slide nói về ReAct, không chỉ slide hiện tại |
| Hỏi “Tóm tắt các chủ đề chính của bài học” | Summarize toàn bài | AI gom được nhiều phần chính và cite nhiều trang |
| Hỏi “GPT-5 context window bao nhiêu?” | OUTSIDE_MATERIAL | AI nói tài liệu không có thông tin và xin phép dùng kiến thức ngoài |
| Bấm citation ở câu trả lời về ReAct | Trust & source navigation | Người dùng mở được đúng slide nguồn |

## 4. Log từng câu hỏi

| # | Slide hiện tại | Câu hỏi người dùng | Scope kỳ vọng | AI trả lời đúng? | Citation đúng? | Mở nguồn được? | Có bịa không? | Ghi chú / lỗi |
|---|---:|---|---|---|---|---|---|---|
| 1 | 1 | Slide này nói gì? | CURRENT_SLIDE | Có | Có | Có | Không | Trả lời đúng tiêu đề bài học, ngày học và chủ đề ReAct. |
| 2 | 1 | ReAct được giải thích ở đâu? | FULL_LESSON | Một phần | Có | Có | Không | AI tìm được phần ReAct nhưng câu trả lời hơi ngắn, chưa giải thích rõ Thought/Action/Observation. |
| 3 | 3 | Tóm tắt các chủ đề chính của bài học | FULL_LESSON | Có | Một phần | Có | Không | Tóm tắt đúng các cụm chính nhưng citation còn thiếu một vài trang đại diện. |
| 4 | 10 | Chatbot khác agent như thế nào? | FULL_LESSON | Có | Có | Có | Không | Câu trả lời hữu ích, có so sánh theo khả năng dùng tool và vòng lặp hành động. |
| 5 | 12 | GPT-5 context window bao nhiêu? | OUTSIDE_MATERIAL | Một phần | Không áp dụng | Không áp dụng | Không | AI nên nói rõ hơn rằng thông tin này không có trong tài liệu và hỏi trước khi dùng kiến thức ngoài. |

## 5. Quote nguyên văn từ người thử

| Câu hỏi sau phiên test | Quote nguyên văn |
|---|---|
| Điều gì khó hiểu hoặc khó chịu nhất? | “Mình chưa biết lúc nào nó đang trả lời theo slide hiện tại, lúc nào nó tìm toàn bài.” |
| Kết quả này bạn có tin không? Vì sao? | “Có tin hơn khi thấy nguồn slide, nhưng nếu có timestamp transcript nữa thì tốt hơn.” |
| Bạn có dùng thật không? Vì sao / vì sao chưa? | “Có, nếu mình đang ôn bài trước lab. Nhưng cần câu trả lời ổn định hơn, đừng lúc được lúc lỗi.” |
| Nếu được sửa một thứ trước demo, bạn sửa gì? | “Làm citation bấm vào được rõ hơn và báo khi câu hỏi nằm ngoài tài liệu.” |

## 6. Metric sau phiên test

| Metric | Cách tính | Kết quả |
|---|---|---:|
| Tỷ lệ trả lời đúng | Số câu đúng hoặc chấp nhận được / tổng câu | 4/5 = 80% |
| Tỷ lệ citation đúng trang | Citation đúng / tổng citation cần kiểm tra | 3/4 = 75% |
| Tỷ lệ tìm được nội dung ở trang khác | Câu cross-slide đúng / tổng câu cross-slide | 3/3 = 100% |
| Tỷ lệ không bịa khi thiếu thông tin | Câu ngoài tài liệu xử lý đúng / tổng câu ngoài tài liệu | 1/1 = 100% |
| Tỷ lệ người dùng mở được nguồn | Lần mở nguồn thành công / tổng lần thử | 3/3 = 100% |
| Thời gian chờ trung bình | Tổng thời gian từ gửi câu hỏi đến có câu trả lời / số câu | Khoảng 6-12 giây/câu |

## 7. Lỗi phát hiện

| Mã lỗi | Mô tả | Mức độ | Bằng chứng | Quyết định sửa |
|---|---|---|---|---|
| BUG-001 | Người dùng không phân biệt được scope hiện tại: current slide hay toàn bài | High | Quote: “chưa biết lúc nào nó đang trả lời theo slide hiện tại...” | Thêm intent/scope hiển thị nhẹ trong response hoặc log nội bộ cho demo |
| BUG-002 | Citation cho câu tóm tắt toàn bài còn thiếu trang đại diện | Medium | Câu hỏi #3 | Ưu tiên chọn 3-5 slide đại diện khi summarize |
| BUG-003 | Câu ngoài tài liệu cần phản hồi rõ hơn trước khi dùng kiến thức ngoài | High | Câu hỏi #5 | Thêm policy: không tự dùng external knowledge, hỏi xin phép trước |
| BUG-004 | LLM/API có lúc lỗi khiến người dùng mất niềm tin | Critical | Quote: “đừng lúc được lúc lỗi” | Thêm fallback có citation và log lỗi provider rõ ràng |

## 8. Tổng hợp sau 3-5 phiên

- Pattern lỗi lặp lại nhiều nhất: Người dùng cần biết AI đang dựa trên slide nào và có đang tìm toàn bài hay không.
- Điều người dùng thấy có giá trị nhất: Citation đúng trang làm câu trả lời đáng tin hơn và giúp quay lại slide nguồn nhanh.
- Điều làm người dùng mất niềm tin nhất: Câu trả lời lỗi chung chung hoặc citation thiếu rõ ràng.
- Thay đổi sẽ làm trước demo:
  - Làm rõ scope xử lý: slide hiện tại / toàn bài / ngoài tài liệu.
  - Giữ fallback khi LLM lỗi để vẫn trả nội dung trích từ slide.
  - Cải thiện citation cho câu summarize toàn bài.
- Thay đổi đưa vào backlog:
  - Thêm transcript timestamp thật.
  - Thêm đánh giá confidence cho từng citation.
  - Thêm nút “trả lời bằng kiến thức ngoài” khi tài liệu không có thông tin.
- Điều quyết định giữ nguyên, kèm lý do:
  - Giữ citation theo slide vì dễ hiểu với học viên và phù hợp use case chính.

## 9. Changelog từ validation

| Thời điểm | Feedback / bằng chứng | Thay đổi đã làm | File / commit liên quan |
|---|---|---|---|
| 31/07/2026 | Người dùng mất niềm tin khi LLM lỗi | Thêm fallback trả lời từ slide đã xử lý | backend/src/slides/chat-service.ts |
| 31/07/2026 | Day03 không process vì PDF encrypted/object lỗi | Fallback đọc số trang bằng pdfinfo | backend/src/slides/document-service.ts |
| 31/07/2026 | Cần giảm lỗi rate limit | Giới hạn context slide gửi lên LLM | backend/src/slides/chat-service.ts |
| 31/07/2026 | Cần model gọi được thật | Đổi model sang gemini-flash-latest | .env.example |

## 10. Checklist trước demo

- [ ] Thay dữ liệu mock này bằng ít nhất 3 phiên test thật.
- [ ] Có log câu hỏi và câu trả lời AI.
- [ ] Có kiểm tra citation đúng trang.
- [ ] Có ít nhất 1 case hỏi ngoài phạm vi tài liệu.
- [ ] Có ít nhất 1 case hỏi nội dung ở trang khác slide hiện tại.
- [ ] Có ghi rõ lỗi chưa sửa và lý do.
- [ ] Có cập nhật `spec.md` phần kiểm thử/changelog từ kết quả validation thật.