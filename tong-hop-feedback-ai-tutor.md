# Tổng hợp phản hồi và định hướng cải tiến AI Tutor học theo slide

## 1. Bối cảnh

Nhóm đang phát triển và cải tiến tính năng **AI Tutor trên VLearn** cho đề tài Hackathon. Sản phẩm cho phép người học mở tài liệu slide PDF và trao đổi với chatbot để hiểu bài tốt hơn.

Qua quá trình thử nghiệm thực tế, người dùng và mentor nhận thấy AI Tutor hiện tại chưa khai thác đầy đủ nội dung của tài liệu, đặc biệt với slide có hình ảnh hoặc khi người học đặt câu hỏi về toàn bộ bài học.

---

## 2. Vấn đề cốt lõi

Giá trị của AI Tutor không nên chỉ dừng ở việc trả lời một khái niệm đơn lẻ trên slide hiện tại. Nếu chatbot chỉ hỗ trợ tra cứu ngắn, người học có thể tìm kiếm trên Google hoặc hỏi trực tiếp giảng viên nhanh hơn.

AI Tutor chỉ thực sự tạo khác biệt khi có khả năng:

- Hiểu toàn bộ bộ slide.
- Đọc được cả chữ và hình ảnh trong slide.
- Tóm tắt bài học theo cấu trúc.
- Liên kết kiến thức giữa nhiều trang.
- Hỗ trợ ôn tập, hệ thống hóa và đào sâu nội dung.
- Chủ động gợi ý câu hỏi phù hợp với ngữ cảnh học tập.

---

## 3. Các lỗi và hạn chế được phản ánh

### 3.1. Không đọc được nội dung trong slide có hình ảnh

Một số slide chứa sơ đồ, hình minh họa hoặc nội dung được nhúng dưới dạng ảnh. AI Tutor hiện chưa trích xuất và hiểu được các thông tin này, dẫn tới việc không thể trả lời câu hỏi liên quan đến nội dung thực tế trên slide.

**Tác động:**

- Người học nhận câu trả lời thiếu hoặc sai ngữ cảnh.
- Mất niềm tin vào khả năng hiểu tài liệu của AI.
- Không hỗ trợ tốt các môn học có nhiều sơ đồ, biểu đồ hoặc ảnh chụp màn hình.

### 3.2. Chưa đọc và hiểu được toàn bộ bộ slide

AI Tutor có xu hướng chỉ bám vào slide đang mở hoặc thậm chí không truy cập được nội dung cụ thể của slide đó. Khi người dùng hỏi về toàn bộ bài học, hệ thống không cung cấp được cái nhìn tổng quan.

Ví dụ lỗi thực tế:

> Khi người học hỏi: “Cả slide này đang nói về gì?”, chatbot trả lời rằng không thể truy cập nội dung cụ thể của slide và yêu cầu người học tự mô tả lại.

**Tác động:**

- Không thể tóm tắt toàn bài.
- Không thể kết nối kiến thức giữa các phần.
- Không hỗ trợ tốt nhu cầu ôn tập trước kiểm tra.

### 3.3. Câu trả lời còn chung chung, thiếu bám sát tài liệu

Một số phản hồi chưa cho thấy chatbot thực sự hiểu slide đang được mở. Câu trả lời mang tính an toàn, chung chung hoặc yêu cầu người dùng cung cấp lại nội dung thay vì trực tiếp khai thác tài liệu.

**Tác động:**

- Trải nghiệm giống chatbot thông thường hơn là tutor chuyên biệt.
- Người dùng phải làm thêm việc thay cho hệ thống.
- Giảm tính hữu ích của tính năng trong môi trường học tập.

### 3.4. Chưa có tóm tắt toàn bộ bài học

Hệ thống chưa cung cấp phần giới thiệu hoặc tổng quan về bộ slide trước khi người học đi sâu vào từng trang.

**Nhu cầu người dùng:**

- Biết bài học gồm những phần nào.
- Nắm mục tiêu chính trước khi học.
- Có bản tóm tắt ngắn để ôn tập nhanh.
- Có thể chuyển nội dung thành sơ đồ hoặc cấu trúc dễ nhớ.

### 3.5. Chưa chủ động gợi ý câu hỏi học tập

AI Tutor hiện phản ứng thụ động, chỉ trả lời khi người dùng đặt câu hỏi. Hệ thống chưa chủ động tạo các câu hỏi gợi ý dựa trên slide hiện tại, chủ đề đang học hoặc tiến trình của người dùng.

**Tác động:**

- Người học không biết nên hỏi gì tiếp theo.
- Chưa khuyến khích tư duy sâu.
- Chưa tận dụng được vai trò “tutor” trong việc dẫn dắt học tập.

### 3.6. Thiếu dữ liệu bài học thực tế để kiểm thử và phát triển

Nhóm cần thêm các bộ slide thật để:

- Kiểm thử khả năng đọc tài liệu.
- Đánh giá trên nhiều định dạng slide khác nhau.
- Xây dựng tài nguyên thực tế cho quá trình phát triển.
- Phát hiện lỗi với slide có nhiều hình ảnh, biểu đồ hoặc cấu trúc phức tạp.

---

## 4. Insight quan trọng từ người dùng

Người dùng không cần một chatbot chỉ trả lời câu hỏi đơn lẻ. Họ cần một trợ lý học tập có khả năng hiểu toàn bộ tài liệu và biến tài liệu thành trải nghiệm học có định hướng.

Giá trị kỳ vọng bao gồm:

1. **Tóm tắt toàn bộ bài học.**
2. **Chuyển nội dung thành sơ đồ hoặc cấu trúc kiến thức.**
3. **Hỗ trợ ôn tập theo từng chủ đề.**
4. **Giải thích nội dung của từng slide.**
5. **Tạo câu hỏi gợi ý để học sâu hơn.**
6. **Kết nối nội dung giữa các slide.**

---

## 5. Định hướng kỹ thuật từ mentor

### 5.1. Nghiên cứu giải pháp multimodal RAG

Mentor đề xuất tham khảo các repository mã nguồn mở như:

- **LightRAG**
- **RAGAnything**

Mục tiêu là cải thiện khả năng xử lý tài liệu đa phương thức, bao gồm:

- Văn bản.
- Hình ảnh.
- Sơ đồ.
- Bảng biểu.
- Cấu trúc nhiều trang.

Đây được xem là phần kỹ thuật quan trọng nhất vì chất lượng AI Tutor phụ thuộc trực tiếp vào khả năng đọc và xử lý tài liệu.

### 5.2. Xây dựng tính năng tóm tắt bài học

Tóm tắt toàn bộ bài học là tính năng khả thi và có giá trị cao. Có thể triển khai dưới dạng phần giới thiệu trước khi người dùng đi sâu vào từng slide.

Nội dung phần tổng quan có thể gồm:

- Chủ đề chính của bài học.
- Các phần nội dung quan trọng.
- Kiến thức cần ghi nhớ.
- Từ khóa chính.
- Danh sách slide liên quan đến từng chủ đề.

### 5.3. Gợi ý câu hỏi dựa trên ngữ cảnh

Hệ thống cần theo dõi:

- Người dùng đang ở slide nào.
- Nội dung của slide hiện tại.
- Chủ đề đang học.
- Các câu hỏi đã hỏi trước đó.
- Nội dung đã xem hoặc chưa xem.

Từ các dữ liệu này, AI có thể tạo ngược các câu hỏi gợi ý để người dùng tiếp tục tìm hiểu.

Ví dụ:

- “Khái niệm này khác gì với phần ở slide trước?”
- “Tại sao quy trình này cần bước kiểm tra đầu ra?”
- “Bạn muốn tôi tóm tắt toàn bộ phần này thành checklist không?”
- “Bạn có muốn thử một câu hỏi kiểm tra nhanh về nội dung vừa học không?”

---

## 6. Giải pháp đề xuất

### 6.1. Document Processing Pipeline

Xây dựng pipeline xử lý tài liệu gồm các bước:

1. Nhận file PDF.
2. Tách từng trang slide.
3. Trích xuất văn bản bằng PDF parser.
4. Dùng OCR với trang không có text layer.
5. Phân tích hình ảnh, sơ đồ và biểu đồ bằng mô hình multimodal.
6. Lưu nội dung theo từng slide.
7. Tạo embedding cho từng đoạn nội dung.
8. Lưu metadata như số trang, tiêu đề, chủ đề và loại nội dung.
9. Tạo bản tóm tắt toàn bộ bài học.

### 6.2. Hai phạm vi ngữ cảnh cho chatbot

Chatbot nên có hai chế độ truy xuất:

#### Ngữ cảnh slide hiện tại

Dùng cho các câu hỏi như:

- “Slide này nói về gì?”
- “Giải thích sơ đồ này.”
- “Khái niệm ở trang này có ý nghĩa gì?”

#### Ngữ cảnh toàn bộ bài học

Dùng cho các câu hỏi như:

- “Tóm tắt toàn bộ bài.”
- “Các nội dung chính của bộ slide là gì?”
- “Phần nào liên quan đến tool calling?”
- “So sánh kiến thức ở slide 5 và slide 10.”

### 6.3. Giao diện tổng quan bài học

Sau khi upload và xử lý PDF, hệ thống nên hiển thị:

- Tên bài học.
- Tổng số slide.
- Tóm tắt ngắn.
- Danh sách chủ đề.
- Các từ khóa chính.
- Nút “Bắt đầu học”.
- Nút “Ôn tập nhanh”.

### 6.4. Câu hỏi gợi ý chủ động

Mỗi slide nên có từ 2 đến 4 câu hỏi gợi ý, được sinh dựa trên nội dung thực tế của slide.

Nhóm câu hỏi gợi ý có thể gồm:

- Câu hỏi hiểu nội dung.
- Câu hỏi so sánh.
- Câu hỏi ứng dụng.
- Câu hỏi kiểm tra nhanh.
- Câu hỏi liên kết với slide trước hoặc sau.

### 6.5. Chế độ ôn tập

AI Tutor có thể biến toàn bộ slide thành:

- Bản tóm tắt.
- Checklist kiến thức.
- Flashcard.
- Quiz ngắn.
- Sơ đồ kiến thức.
- Danh sách phần cần học lại.

---

## 7. Phạm vi MVP ưu tiên

Để phù hợp với thời gian Hackathon, nên ưu tiên các tính năng sau:

### P0 — Bắt buộc

- Upload và hiển thị PDF.
- Trích xuất được nội dung chữ của toàn bộ slide.
- OCR cho slide chứa ảnh chụp chữ.
- Chat theo slide hiện tại.
- Chat trên toàn bộ bộ slide.
- Tóm tắt toàn bộ bài học.
- Hiển thị nguồn là số slide được dùng để trả lời.

### P1 — Nên có

- Đọc và mô tả hình ảnh hoặc sơ đồ cơ bản.
- Câu hỏi gợi ý theo slide hiện tại.
- Các nút prompt nhanh như “Giải thích”, “Tóm tắt”, “Tạo quiz”.
- Chế độ ôn tập nhanh.

### P2 — Mở rộng

- Sơ đồ kiến thức tự động.
- Theo dõi tiến độ học tập.
- Cá nhân hóa câu hỏi theo mức độ hiểu bài.
- Nhận diện phần người học còn yếu.
- Đề xuất nội dung cần ôn lại.

---

## 8. Tiêu chí nghiệm thu đề xuất

### Khả năng hiểu tài liệu

- Hệ thống trích xuất được nội dung từ tất cả các trang có text layer.
- Hệ thống xử lý được slide có chữ nằm trong hình ảnh.
- Hệ thống trả lời được câu hỏi về slide đang mở.
- Hệ thống trả lời được câu hỏi tổng hợp từ nhiều slide.

### Chất lượng câu trả lời

- Câu trả lời phải bám sát nội dung tài liệu.
- Không tự suy đoán khi tài liệu không có thông tin.
- Có trích dẫn số slide liên quan.
- Khi không đủ dữ liệu, phải nói rõ thiếu thông tin nào.

### Trải nghiệm học tập

- Người dùng xem được tổng quan bài học trước khi học.
- Mỗi slide có câu hỏi gợi ý phù hợp.
- Người dùng có thể tạo bản tóm tắt hoặc quiz từ tài liệu.
- Chatbot không yêu cầu người dùng tự chép lại nội dung đã có trong slide.

---

## 9. Kết luận

Pain point lớn nhất của AI Tutor hiện tại không nằm ở giao diện mà nằm ở khả năng hiểu tài liệu. Khi hệ thống chưa đọc được toàn bộ slide, chưa xử lý tốt nội dung hình ảnh và chưa kết nối được ngữ cảnh giữa các trang, chatbot khó tạo ra giá trị vượt trội so với công cụ tìm kiếm thông thường.

Hướng cải tiến phù hợp nhất là tập trung vào **multimodal document processing, RAG trên toàn bộ tài liệu, tóm tắt bài học và gợi ý câu hỏi theo ngữ cảnh**. Đây là các năng lực có thể trực tiếp giải quyết phản hồi của người dùng và giúp AI Tutor trở thành một trợ lý học tập thực sự thay vì chỉ là chatbot hỏi đáp.
