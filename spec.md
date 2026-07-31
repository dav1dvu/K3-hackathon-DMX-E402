# AI SPEC — AI Tutor trả lời có trích dẫn, xuyên toàn bài & xuyên diễn đạt · Nhóm [XX] · Zone [X]

Hướng: [x] A — VLearn  [ ] B — Trợ lý Học viên  [ ] C — Làn mở
Loại: [x] Tối ưu tính năng có sẵn  [ ] Tính năng mới

> Nguồn dựng spec này: `CHANGELOG.md` (trail quyết định thật của nhóm, phục hồi từ file lỗi encoding do người dùng cung cấp), `data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv` (585 hội thoại VLearn thật, tự phân tích lại), `tong-hop-feedback-ai-tutor.md` (feedback mentor + người dùng), và `eval/acceptance_standard.md`/kết quả CP3 được ghi trong changelog. Chỗ nào không có bằng chứng thật, spec đánh dấu `[CẦN ĐIỀN]` thay vì bịa số — theo đúng luật "không có bằng chứng thì không có slide/spec".

## §1. User & Job

- **Job executor:** Học sinh VLearn đang tự ôn tập cùng AI Tutor ngay trên slide bài giảng PDF, trong buổi học `in_class` (100% hội thoại trong log thuộc mode này).
- **Core JTBD (một câu, không nhắc AI):** Khi cần nắm nhanh toàn bộ một bài giảng dài trước khi ôn tập, học sinh muốn tóm tắt đúng nội dung và biết rõ nó lấy từ trang nào — thay vì tự lật từng trang để ghép lại.
- **Problem statement (không chữ AI):** Học sinh đang ôn bài từ slide PDF dài nhiều trang, cần nắm ý chính nhanh trước khi làm quiz/ôn tập, nhưng hôm nay hoặc tự lật từng trang tốn thời gian, hoặc hỏi trực tiếp và nhận câu trả lời không đúng phần mình cần — không kiểm chứng được câu trả lời lấy từ đâu.
- **Hôm nay họ giải quyết bằng gì, fail ở đâu:** Hỏi thẳng AI Tutor hiện có trên VLearn. Theo log thật, tutor hiện tại thường xuyên trả lời không có trích dẫn nguồn hoặc xin lỗi "không tìm thấy nội dung" khi bị hỏi tóm tắt/tổng quan — chưa bị học sinh bỏ hẳn (vẫn hỏi lặp lại nhiều lần, xem quote bên dưới) nhưng chưa đáng tin để thay thế việc tự lật bài.

### Evidence — chuẩn B (mining, có phương pháp đếm, tái lập được)

**Nguồn:** `data/vlearn-pack/chatlog/chat_history_anonymized_for_hackathon.csv` — 2.522 dòng (1.261 cặp student+tutor), 585 hội thoại, 369 học sinh, 22–29/07/2026. Đã tự kiểm tra dữ liệu nhạy cảm theo `DATA_DICTIONARY.md` (sạch, có lớp redact PII sẵn).

**Phương pháp đếm:** lọc tin nhắn `role=student` chứa ≥1 trong các cụm khoá "tóm tắt", "toàn bộ bài", "cả slide", "tổng quan", "nội dung chính", "không đọc được" (không phân biệt hoa/thường); với mỗi turn khớp, lấy tin `role=tutor` cùng `turn_id` để kiểm tra `citations` rỗng và cụm xin lỗi ("không tìm thấy", "rất tiếc", "xin lỗi", "không thể tự động tổng hợp", "không có quyền truy cập").

- **130/1.261 turn (10,3%)** là câu hỏi dạng "tóm tắt / toàn bộ bài / nội dung chính".
- Trong 130 turn đó: **85 turn (65,4%) tutor trả lời KHÔNG có trích dẫn nguồn** (`citations: []`); **79 turn (60,8%) là lời xin lỗi kiểu "không tìm thấy nội dung"**.
- Đối chiếu toàn bộ dataset (không riêng câu hỏi tóm tắt): **582/1.261 turn (46,2%) không có trích dẫn nguồn** — số này khớp với `DATA_DICTIONARY.md` (tính độc lập bởi người ghi data dictionary), củng cố độ tin cậy phép đếm.

**≥5 quote nguyên văn + nguồn (message_id/turn_id):**
1. (M0122 → T0122) HS: *"tóm tắt hết slice trong vài câu đi"* → Tutor: *"...mình không có quyền truy cập trực tiếp vào toàn bộ tệp tài liệu mà phải thông qua tìm kiếm từ khóa..."* — `citations: []`.
2. (M0332 → T0699) HS: *"tóm tắt toàn bộ slide sau đó đưa ra các ý chính"* → Tutor: *"Rất tiếc là mình đã thử tìm kiếm nội dung tổng quan... nhưng hệ thống chưa trả về kết quả cụ thể..."* — `citations: []`.
3. (M1807 → T0690) HS: *"TÓm tắt tài liệu tôi xem nào"* → Tutor: *"Hệ thống hiện không thể tự động tổng hợp toàn bộ nội dung của tất cả các slide trong một lần."*
4. (T0649) HS: *"tóm tắt nội dung chính trong slide này"* → Tutor: *"Xin lỗi bạn, tôi không tìm thấy nội dung cụ thể cho slide 37 trong tài liệu hiện có."*
5. (T0408) HS: *"tóm tắt các chủ đề chính của slide day05-lecture-slides-batch03.pdf này"* → Tutor: *"Rất tiếc, tôi không thể tìm thấy tệp tin hoặc nội dung chi tiết... để tóm tắt các chủ đề chính cho bạn."*

**Bằng chứng định tính bổ sung** (không đếm được thành số nhưng có nguồn): `tong-hop-feedback-ai-tutor.md` §3.2 ghi nhận case thật — khi học sinh hỏi *"Cả slide này đang nói về gì?"*, chatbot trả lời không thể truy cập nội dung cụ thể và yêu cầu học sinh tự mô tả lại.

### Evidence — chuẩn A (khảo sát)

**[CẦN ĐIỀN — chưa thực hiện.]** Chưa có khảo sát ≥20 người ngoài nhóm với ≥50% xác nhận. Đường B (mining) đã đủ chuẩn và đủ để chứng minh pain *tồn tại*; cần bổ sung Đường A trước CP5 để chứng minh user *muốn* pain này được giải (không chỉ là điều nhóm suy diễn từ log).

---

## §2. Impact & quyết định chọn

| Ứng viên | Bao nhiêu người gặp · tần suất | Mỗi lần tốn gì | Khả thi trong thời gian hackathon | Chọn? |
|---|---|---|---|---|
| **A. Multimodal — đọc chữ/sơ đồ trong slide dạng ảnh** | Chưa đếm được bằng số; chỉ có phản ánh định tính từ mentor + `tong-hop-feedback-ai-tutor.md` §3.1 | Học sinh nhận câu trả lời thiếu/sai ngữ cảnh cho slide có hình | Cần model đa phương thức mới (mentor gợi ý LightRAG/RAGAnything) — effort vượt quá 1,5 ngày hackathon | ❌ Loại |
| **B. Tóm tắt & hỏi-đáp xuyên toàn bài, xuyên diễn đạt/ngôn ngữ, có trích dẫn** | **130/1.261 turn (10,3%), 585 hội thoại thật** — đếm được, có phương pháp, có ≥5 quote nguồn | Học sinh mất niềm tin, tự làm lại việc AI lẽ ra phải làm (tự lật từng trang) | Sửa trong pipeline retrieval + LLM sẵn có, không cần thêm model/API mới — đã build & test được trong phiên hiện tại | ✅ **Chọn** |
| **C. Gợi ý câu hỏi chủ động theo ngữ cảnh** | Chưa đếm được; chỉ có định hướng từ mentor (`tong-hop-feedback-ai-tutor.md` §5.3) | Học sinh không biết nên hỏi tiếp gì | Khả thi kỹ thuật nhưng không chạm vào pain đã đo (65,4% fail rate) — thuộc nhóm "nice to have" | ❌ Loại |

**Ứng viên loại + vì sao:**
- **A (multimodal)** loại không phải vì kém giá trị — feedback mentor xếp đây là pain #1 định tính — mà vì nhóm không có bằng chứng đếm được (chuẩn B) và effort kỹ thuật (model đa phương thức) vượt ngân sách 1,5 ngày. Giữ lại trong roadmap (§6 slide "nếu thêm 1 tuần"/`tong-hop-feedback-ai-tutor.md` §7 P1).
- **C (gợi ý câu hỏi)** loại vì dù rẻ hơn A, vẫn không giải quyết đúng con số pain lớn nhất đã đo (65,4% turn tóm tắt bị fail) — build C trước sẽ là "làm vì dễ", không phải "làm vì đúng bằng chứng".

**Ứng viên chọn + vì sao (bằng số):** B được chọn vì (1) là nhóm pain duy nhất có bằng chứng đếm được đạt chuẩn B — 130/1.261 turn, 65,4% trong đó fail; (2) nguyên nhân gốc đã xác định được ở tầng retrieval (không phải giới hạn của model) nên sửa được trong phạm vi code hiện có; (3) đã có kết quả kiểm thử thật sau khi sửa (xem §7).

---

## §3. Giải pháp tương tự đã nghiên cứu

**[CẦN ĐIỀN — chưa thực hiện theo đúng quy trình `02-guide.md` §2.2.]** Guide yêu cầu mỗi thành viên dùng thử 1 sản phẩm gần giống (ChatGPT study mode · Khanmigo · NotebookLM · Duolingo · Quizlet AI...) và trả lời 4 câu: ① họ giải job này bằng flow nào? ② một điều đáng học (quan sát cụ thể)? ③ một điều đáng né? ④ mình khác gì? — bước này chưa được nhóm thực hiện và ghi log. Cần hoàn thành trước khi chốt spec 23:59, vì đây là một trong các mục bị chấm ở R2.

Gợi ý phân công nhanh (mỗi người 15'): 1 người thử NotebookLM (đáng học tiềm năng: luôn cite nguồn cạnh câu trả lời — gần với hướng B nhóm đang chọn), 1 người thử ChatGPT file upload Q&A, 1 người thử Khanmigo hoặc Quizlet AI.

---

## §4. Thiết kế

- **Lát cắt MỘT CÂU:** Khi học sinh đang xem một slide bài giảng PDF và hỏi AI Tutor bất kỳ điều gì về slide hiện tại hoặc toàn bộ bài — dù diễn đạt dài dòng, lịch sự, đồng nghĩa, hay pha tiếng Anh — AI Tutor tự quyết định phạm vi bằng chứng cần tra cứu, trả lời kèm trích dẫn số trang, và nói rõ khi tài liệu không đủ thông tin thay vì đoán liều.
- **Non-goals (không build trong bản này):**
  1. Không đọc/hiểu nội dung trong slide dạng hình ảnh, sơ đồ, biểu đồ thuần ảnh (multimodal) — xem §2 ứng viên A bị loại.
  2. Không chủ động gợi ý câu hỏi tiếp theo cho học sinh — xem §2 ứng viên C bị loại.
  3. Không chấm điểm, theo dõi tiến độ học tập, hay cá nhân hoá theo lịch sử học của từng học sinh.
  4. Không trả lời hoặc thực hiện yêu cầu ngoài phạm vi tài liệu đang mở (vd. tra cứu ngoài, gọi hành động ngoài hệ thống).
- **Mức prototype nhắm tới:** [x] Working — phần nào mock, phần nào thật:
  - **Thật:** ingest PDF thật (text layer PDF.js + fallback OCR `tesseract.js`), lập chỉ mục lexical (TF-IDF), gọi LLM thật qua `LLMCore` (OpenAI-compatible, có primary/fallback/timeout/retry), sinh câu trả lời có `sourcePages` được xác minh lại phía backend (không tin thẳng citation model tự khai).
  - **Mock/chưa có:** đọc nội dung hình ảnh trong slide (OCR text-only, không hiểu sơ đồ); gợi ý câu hỏi chủ động (`follow_ups` — theo chatlog gốc field này luôn rỗng, 0/1.261, chưa từng được dùng cả ở bản VLearn hiện tại).
- **Automation:** [x] Conditional — lý do theo cost-of-error: sai kiến thức học thuật cho học sinh là đắt (ảnh hưởng việc học/điểm số/niềm tin), nên AI không được "tự làm liều" khi thiếu bằng chứng. Hệ thống tự trả lời khi có trích dẫn xác minh được trong tài liệu; khi không đủ hoặc không xác minh được citation, hệ thống chủ động báo `insufficientContext=true` thay vì đoán (xem `server/tutor/grounded-generation.ts` — validate `sourcePages` khớp `allowedPages`, nếu không khớp trả "Không thể xác minh câu trả lời từ các trang đã truy xuất.").

### §4b. Nguyên tắc HAX/PAIR đã áp dụng

| Nguyên tắc | Áp cụ thể vào đâu trong prototype |
|---|---|
| **G10 — Thu hẹp phạm vi khi nghi ngờ** | Khi evidence không đủ hoặc citation không xác minh được, trả lời `insufficientContext=true`, `sourcePages=[]`, nói rõ thiếu dữ liệu ở đâu — không đoán liều (`server/tutor/grounded-generation.ts`, system prompt rule #5). |
| **G11 — Giải thích vì sao** | Mọi câu trả lời có bằng chứng đều kèm "Trang N: ..." theo đúng trang trích dẫn, học sinh tự kiểm được nguồn (`src/rag/grounding.ts`, `evidencePrompt`). |
| **G2 — Làm rõ hệ thống làm tốt đến đâu** | System prompt bắt buộc "chỉ trả lời bằng EVIDENCE được cung cấp, không dùng kiến thức bên ngoài" — phạm vi trả lời được giới hạn rõ, không giả vờ biết hết. |
| **PAIR — Explainability + Trust** | Hiển thị "Nguồn · Trang X" ngay trong câu trả lời để học sinh tin *đúng mức*, không tin tuyệt đối — tự đối chiếu lại slide gốc. |
| **PAIR — Errors + Graceful Failure** | Phân biệt 2 loại lỗi có đường lui khác nhau: lỗi-do-thiếu-bằng-chứng (báo insufficientContext) khác lỗi-do-hiểu-nhầm-ý-định/diễn-đạt (mở rộng phạm vi tìm kiếm toàn tài liệu trước khi kết luận thiếu, thay vì bail ngay ở tầng từ khoá) — xem case sửa thật trong §9 changelog gần nhất. |

---

## §5. Kiểu lỗi — 4 lớp chỗ khó + kịch bản

| # | Lớp | Tình huống cụ thể | Hành vi mong muốn | Trạng thái |
|---|---|---|---|---|
| 1 | ① Nguồn sự thật | Model trả lời chắc chắn dù evidence rỗng/không liên quan | `insufficientContext=true`, `sourcePages=[]`, nói rõ thiếu gì (zero-tolerance `UNSUPPORTED_ASSERTED_ANSWER`) | Có kiểm soát ở system prompt + eval; **CP3 run gần nhất vẫn còn case fail nhóm này** (xem §7) |
| 2 | ① Nguồn sự thật | Citation trỏ tới trang không có trong EVIDENCE hoặc ngoài `total_pages` của tài liệu | Chặn ở backend: chỉ chấp nhận `sourcePages` ⊆ trang đã truy xuất, sai → "Không thể xác minh câu trả lời từ các trang đã truy xuất." | Đã implement (`grounded-generation.ts`, `allowedPages`) |
| 3 | ② Mơ hồ/thiếu thông tin | Câu hỏi tóm tắt bị diễn đạt khác cách ("nội dung chính của bài" / "tóm tắt" / "what's the main content") | Nhận diện đúng ý định tóm tắt bất kể cách diễn đạt, lấy bằng chứng trải đều toàn tài liệu | **Bug thật đã tìm & sửa trong phiên này** — bộ lọc từ đệm từng xoá nhầm cụm "nội dung" làm vỡ nhận diện ý định |
| 4 | ② Mơ hồ/thiếu thông tin | Câu hỏi không trùng từ khoá với tài liệu (khác ngôn ngữ Anh/Việt, hoặc paraphrase hoàn toàn) | Không bail ngay khi tìm từ khoá rỗng — lấy mẫu đại diện toàn tài liệu, để LLM tự đánh giá đủ/thiếu | **Đã sửa** — trước đây trả "không đủ dữ liệu" ngay ở client, LLM chưa từng được hỏi |
| 5 | ② Mơ hồ/thiếu thông tin | Slide có phần OCR fail (VD "slide Day1 và Day3 không OCR được" — feedback ghi trong changelog `07ee898`) | Báo rõ trang nào thiếu dữ liệu thay vì im lặng bỏ qua | **Chưa xử lý** — feedback ghi nhận, chưa có commit khắc phục riêng |
| 6 | ③ Ngoài phạm vi/thẩm quyền | User yêu cầu hành động/công cụ ngoài khả năng (gọi API ngoài, chấm điểm chính thức...) | Từ chối rõ ràng, không giả vờ thực hiện được | Có ở system prompt (`e3576e7`); **5+ case CP3 (CP3-004/007/008/012/015) vẫn fail nhóm này ở lần đo gần nhất** — chưa coi là đã khắc phục hoàn toàn |
| 7 | ③ Ngoài phạm vi/thẩm quyền | User cố truy cập tài liệu ngoài phạm vi qua ID không hợp lệ (path traversal) | Chỉ chấp nhận document ID đã discover hợp lệ | Đã implement ở nhánh `server/slides` (`07ee898`) — **chưa có trong nhánh `codebase/` hiện tại của repo này**, cần hợp nhất |
| 8 | ④ Đặc thù domain | Ngân sách `maxTokens` quá thấp cắt cụt JSON tóm tắt giữa chừng | Đảm bảo đủ token cho câu trả lời có cấu trúc (danh sách gạch đầu dòng khi ≥2 ý), không trả JSON hỏng | **Rủi ro đã ghi nhận** (`maxTokens: 900` ở nhánh slides), đã tăng lên `1200` ở nhánh `codebase/` hiện tại nhưng **chưa đo lại bằng eval thật** |
| 9 | ④ Đặc thù domain | Trích dẫn đúng cú pháp nhưng không thực sự khớp nội dung câu trả lời | Học sinh cần tin sai kiến thức + tưởng "đã có nguồn" nên không tự kiểm lại | Rủi ro domain-đặc-thù cao nhất — **kịch bản đáng sợ nhất khi demo**, cần ≥2 case golden set riêng |
| 10 | ④ Đặc thù domain | Nhiều request cùng lúc cho cùng một tài liệu gây xử lý trùng lặp | Chặn bằng in-flight promise/cache theo fingerprint, tránh trả nội dung cache cũ/sai | Đã implement ở nhánh `server/slides` (`07ee898`) — chưa có ở `codebase/` hiện tại |

Kịch bản #9 (citation đúng dạng nhưng sai nội dung) là kịch bản nhóm sợ nhất khi demo — chưa có case riêng trong golden set nội bộ, cần bổ sung trước CP5.

---

## §6. Bốn đường đi của trải nghiệm

- **Happy path:** Hỏi về slide hiện tại hoặc toàn bài, có bằng chứng rõ trong tài liệu → trả lời kèm "Trang N: ..." đúng theo evidence đã truy xuất.
- **Low-confidence (②):** Câu hỏi mơ hồ, diễn đạt lạ, hoặc xuyên ngôn ngữ Anh/Việt → hệ thống mở rộng phạm vi tìm bằng chứng (lấy mẫu trải đều toàn tài liệu) trước khi kết luận, để LLM tự đánh giá đủ/thiếu thay vì bail sớm ở tầng từ khoá.
- **Failure/không căn cứ (①):** Không tìm được bằng chứng phù hợp trong tài liệu → `insufficientContext=true`, nói rõ thiếu dữ liệu ở trang/phần nào, `sourcePages=[]`.
- **Correction (user sửa):** Giữ lịch sử hội thoại theo trang/phạm vi khi học sinh hỏi lại hoặc chuyển hướng câu hỏi; học sinh luôn đổi được scope (trang hiện tại ↔ toàn bài) qua UI.
- **Khi bị đòi ngoài phạm vi (③):** Từ chối hành động/công cụ ngoài khả năng; chỉ trả lời thông tin high-stakes khi evidence nêu rõ, không suy đoán thêm.
- **Case đặc thù domain (④):** Khi evidence có nhưng giới hạn token có thể cắt cụt câu trả lời có cấu trúc → cần giám sát riêng (xem §5 kịch bản #8), chưa có cơ chế phát hiện tự động khi output bị cắt.

---

## §7. Kiểm thử

### Chiều chất lượng + định nghĩa kiểm chứng được

| Chiều | Định nghĩa | Cách chấm |
|---|---|---|
| Đúng-có-căn-cứ | Mọi câu trả lời (không phải `insufficientContext`) trace được về đúng trang trong EVIDENCE đã cung cấp, không bịa citation | Pass/fail |
| Đúng phạm vi | Không dùng kiến thức ngoài tài liệu để trả lời | Pass/fail |
| Đúng cỡ — đúng giọng | 1 = sai kiến thức · 3 = đúng nhưng dài/lan man hơn cần · 5 = đúng, đúng cỡ, có trích dẫn rõ | Thang 1–5 |

### Golden set — **ba bộ, ba mục đích khác nhau, không so trực tiếp với nhau**

1. **Bộ CP3 gốc** (20 case, ghi trong `CHANGELOG.md`/`§9`) — đo trên nhánh backend `server/slides` (SlideDocumentService, `/api/slides/.../chat`), nhánh này **KHÔNG có trong `codebase/`** hiện tại (đã bị revert khi dọn xung đột pull). Kết quả 13/20 (65%) của lượt đó **không đại diện cho code trong repo nộp bài**.
2. **Bộ RAG nội bộ** (`codebase/src/rag/rag.test.ts`, 15 case + 2 case hồi quy) — test đơn vị tầng retrieval, chạy tự động trong CI, không gọi LLM thật, không tính vào quality bar CP3.
3. **Bộ CP3 dựng lại cho nhánh `codebase/` hiện tại** (`eval/eval_cases.json`, 20 case `CP3-001`…`CP3-020`, cùng chuẩn với eval/acceptance_standard.md) — bộ này **đã chạy thật, qua đúng pipeline sản phẩm, gọi LLM thật (Gemini)**, không mock. Đây là số liệu đại diện gần nhất cho code sẽ nộp.

### Quality bar (chốt từ 23:59 N1, giữ nguyên sau đó)

**"Đạt khi ≥80% qua bộ 20 case CP3, VÀ zero-tolerance cho `UNSUPPORTED_ASSERTED_ANSWER`/`INVALID_CITATION`, và không có case `blocked`."** — bar này lấy nguyên từ `eval/acceptance_standard.md` đã có sẵn trong changelog, không phải bar mới tự đặt.

### Kết quả các lượt chạy

| Lượt | Bộ đo | Nhánh/code được đo | Kết quả | Trạng thái |
|---|---|---|---|---|
| 1 (`e3576e7`) | CP3 20 case (gốc) | `server/slides` — **không có trong `codebase/` hiện tại** | 13/20 pass (65%), 7 fail, 3 lỗi nghiêm trọng zero-tolerance | **FAIL** — không đại diện cho bản nộp |
| 2 (phiên trước) | RAG golden set nội bộ (15 + 2 case hồi quy) | `codebase/src/rag/rag.test.ts` — tầng retrieval, không gọi LLM | 40/40 pass toàn bộ test suite | Đạt trên phạm vi hẹp (không phủ 4 lớp chỗ khó) |
| **3 (phiên này, thật, có gọi LLM)** | CP3 20 case dựng lại (`eval/eval_cases.json`) | `codebase/` — đúng nhánh sẽ nộp, model `gemini-3.5-flash-lite` | **Tự động: 15/19 pass (78,9%). Sau soát tay theo `02-guide.md` §2.6 bước 4: 17/18 case hợp lệ pass (94,4%), 1 case loại vì lỗi thiết kế câu hỏi** | **FAIL** — dù tỉ lệ 94,4%, case `CP3-003` là 1 vi phạm zero-tolerance thật (model suy diễn "Instructor" = "tác giả" khi tài liệu không nói vậy) → theo đúng luật đã chốt, 1 case zero-tolerance là đủ để KHÔNG đạt |

**Chi tiết đầy đủ, kể cả 2 chỗ tiêu chí chấm tự động của chính bộ eval bị sai (phải viết lại sau khi soát tay) và câu trả lời nguyên văn từng case:** `eval/eval_summary.md`, `eval/eval_results.json`.

**Việc cần làm tiếp (không phải để pass cho đẹp — để sửa đúng chỗ hỏng thật):** thêm chỉ dẫn trong system prompt để model phân biệt "Instructor" (giảng viên đứng lớp) khác "tác giả" (người soạn tài liệu) khi hai khái niệm không được tài liệu đồng nhất, rồi chạy lại đúng bộ 20 case này để xác nhận CP3-003 đã hết.

**Việc cần làm trước CP5 (không giấu gap):**
1. ~~Chạy đủ 20 case CP3 trên đúng code sẽ nộp~~ — **đã làm** (lượt 3 ở bảng trên, `eval/eval_cases.json` + `eval/run-eval.ts`, gọi LLM thật).
2. Sửa lỗi zero-tolerance thật đã tìm thấy (CP3-003 — model suy diễn "Instructor" = "tác giả"), chạy lại để xác nhận gate chuyển PASS.
3. Viết lại câu hỏi CP3-010 (hiện bị loại vì trùng từ khoá với ví dụ trong tài liệu test) thành một case ngoài-phạm-vi sạch hơn.
4. Quyết định có hợp nhất nhánh `server/slides` (đầy đủ hơn, có path traversal protection, cache fingerprint — xem §5 kịch bản #7, #10 còn thiếu ở `codebase/`) vào `codebase/` hay không — hiện hai nhánh vẫn tách biệt.
5. Bổ sung `validation/` (phiên test người dùng thật, hiện chỉ có template rỗng) và `reflection/` trước khi nộp — không thể tạo thay bằng AI.

---

## §8. Phân công & kế hoạch

**[CẦN ĐIỀN — chưa có đủ thông tin xác thực để ghi tên/vai trò.]** Từ lịch sử git, nhóm xác nhận được ít nhất 2 người đóng góp: tác giả commit local là **Ngoc Lan** (nhánh `ngocLan`), và một nhánh remote tên **`tuquynh`** tồn tại trên `origin`. Repo không có nguồn nào khác (README, commit message) ghi rõ mã học viên + tên đầy đủ + phân công theo hạng mục (spec / evidence / prompt / code / demo) — mục này cần cả nhóm điền trực tiếp, không nên để AI suy đoán vai trò của người khác.

- Phân công có tên: **[CẦN ĐIỀN]**
- Willing users (≥3 tên) + kế hoạch vòng validation CP5: **[CẦN ĐIỀN]** — gợi ý: có thể mời lại 3 học sinh có mặt trong 130 turn "tóm tắt" ở §1 làm người test lại (ẩn danh qua `user_id`, không liên hệ trực tiếp danh tính thật theo đúng quy định bảo mật data ở `README.md`).
- Multi-prototype: không áp dụng — nhóm build một prototype duy nhất.

---

## §9. Changelog

| Thời điểm | Đổi gì | Vì sao (trỏ về feedback/case nào) |
|---|---|---|
| 2026-07-30 14:08 — `de98d17` | Tạo prototype React/TypeScript/Vite đầu tiên. `react-pdf` render PDF thật với text layer, thumbnail, Previous/Next có giới hạn trang và trạng thái loading/error; màn upload kiểm tra MIME/đuôi PDF và có tài liệu mẫu. Chat lúc này vẫn dùng `setTimeout` và `buildMockAnswer`, lưu hội thoại riêng theo trang; `App.test.tsx` kiểm tra file sai loại, điều hướng, trang tại thời điểm gửi, giữ history và reset. | Chọn React + TypeScript + Vite để rút ngắn vòng lặp phát triển nhưng vẫn bảo đảm type safety; chat được chủ động giữ ở dạng mock để xác thực độc lập luồng điều hướng/state trước khi tích hợp backend và LLM thật tại CP3 (`04-rubric.md — CP2`). |
| 2026-07-30 14:44 — `d0c48e9` | Thay câu trả lời mock bằng pipeline phía trình duyệt: ưu tiên PDF text, fallback OCR qua `tesseract.js`, chia chunk có overlap, tạo lexical index, truy xuất theo slide hiện tại/toàn bài, tạo lesson overview và citation trang. Thêm `KnowledgePanel`, 5 golden case và test ingestion/OCR/RAG. | Xử lý trực tiếp khoảng trống ghi tại `tong-hop-feedback-ai-tutor.md §3.1–§3.4, §7 P0`: không đọc được slide ảnh, thiếu ngữ cảnh toàn bài, học sinh phải tự mô tả lại khi hỏi "Cả slide này đang nói về gì?". |
| 2026-07-30 15:30 — `af91a0b` | Thêm backend Express và `LLMCore`: cấu hình provider OpenAI-compatible qua env, primary/fallback, timeout/retry, health check, structured logging không lộ prompt/key. `POST /api/tutor/chat` gọi LLM thật với JSON schema, kiểm tra lại `sourcePages`. | Nền tảng đáp ứng yêu cầu gọi AI thật (`01-de-bai.md`, `04-rubric.md — CP3/R5`); quyết định kỹ thuật phục vụ tích hợp, không xuất phát trực tiếp từ feedback. |
| 2026-07-30 15:52 — `e3576e7` | Tạo framework evaluation CP3: 20 case `CP3-001`…`CP3-020`, quality bar ≥80%, zero-tolerance `UNSUPPORTED_ASSERTED_ANSWER`/`INVALID_CITATION`. Kết quả thật ghi nhận: **13/20 pass (65%), 7 fail, 3 lỗi nghiêm trọng, quality gate FAIL** — không che giấu case fail. | Thực thi `04-rubric.md — R4`; kết quả FAIL giữ nguyên để phản ánh đúng mức sẵn sàng của hệ thống tại thời điểm đó. |
| 2026-07-30 15:52 — `e3576e7` | Mở rộng system prompt với quy tắc không đoán câu mơ hồ, từ chối hành động ngoài khả năng, chỉ trả lời high-stakes khi evidence nêu rõ. | Kiểm soát 3 nhóm rủi ro `CP3-004..015`; artifact cùng commit vẫn fail 5 case nhóm này nên **chưa coi là đã khắc phục hoàn toàn**. |
| 2026-07-30 22:00 — `07ee898` | Chuyển nguồn tài liệu sang backend-managed `data/slide` (tự phát hiện PDF, không cần upload); thêm 5 API `/api/slides/documents...`, chỉ chấp nhận document ID đã discover để chặn path traversal. | Hiện thực hóa feedback "hệ thống phải tự động dùng PDF có sẵn... người dùng không cần upload PDF". |
| 2026-07-30 22:00 — `07ee898` | Chuyển xử lý tài liệu chính sang backend `SlideDocumentService` + worker Python `unstructured.partition.pdf`; cache theo fingerprint kích thước/mtime, in-flight promise chặn partition lặp đồng thời. | Bảo toàn metadata/ranh giới trang; feedback sau đó ghi "slide Day1 và Day3 không OCR được" — chiến lược OCR thực tế **vẫn cần một thay đổi riêng, chưa được commit này giải quyết**. |
| 2026-07-30 22:00 — `07ee898` | Thêm chat theo tài liệu tại `/api/slides/documents/{id}/chat`: backend sở hữu toàn bộ context assembly, đặt CURRENT SLIDE trước LESSON CONTEXT, giới hạn history 6 tin/12.000 ký tự, lọc citation trùng/ngoài phạm vi. | Đáp ứng feedback "Slide này đang nói về gì?", giữ history khi chuyển trang; phản hồi sau commit cho thấy `maxTokens: 900` vẫn là rủi ro cắt cụt JSON tóm tắt, **chưa có commit khắc phục**. |
| 2026-07-30 22:00 — `07ee898` | Củng cố thư viện RAG cũ (query understanding Việt–Anh, synonym expansion, lookup trực tiếp theo số trang, section summary). `bug-regression.test.ts` thêm regression cho 5 cách hỏi trang 5, "Nội dung slide là gì?", giảng viên/instructor. | Ưu tiên truy xuất xác định cho câu hỏi có số trang; thư viện này **được test nhưng không được `App.tsx` gọi** sau khi chuyển sang API slide — tài sản thiết kế tương thích, chưa phải hành vi đã triển khai trên luồng chính. |
| 2026-07-30 22:00 — `07ee898` | Nâng contract legacy `/api/tutor/chat` từ `answer/sourcePages/insufficientContext` sang `status/answer/citations/missing_fields`. | Nhắm trực tiếp regression `CP3-001`; do chưa có evaluation artifact mới, **chưa đủ bằng chứng để kết luận quality gate đã chuyển từ FAIL sang PASS**. |
| 2026-07-31 09:xx — `9113e2f` ("nlan", nhánh `ngocLan`, nội bộ phiên làm việc này) | Trên nhánh `/api/tutor/chat` hiện có trong `codebase/`: sửa 4 lỗi retrieval khiến câu hỏi tóm tắt/nội dung chính bị trả lời sai "không đủ dữ liệu" — (1) bộ lọc từ đệm từng xoá nhầm cụm "nội dung" phá vỡ nhận diện ý định tóm tắt, (2) evidence giới hạn cứng 6 trang lấy theo thứ tự xuất hiện, (3) tìm từ khoá rỗng → bail ngay ở client thay vì hỏi LLM, (4) từ điển đồng nghĩa Anh–Việt còn hẹp. Thêm 2 test hồi quy (`rag.test.ts`, tài liệu giả lập 24 trang). Đổi tên UI "Hỏi đáp có nguồn" → "Trợ lý học tập" + đổi icon. Tạo `demo-slides.pptx` 6 trang dùng đúng số liệu ở §1. Tái cấu trúc repo theo layout `README.md` (mã nguồn → `codebase/`, thêm `eval/`, `validation/`, `reflection/` rỗng). | Bug được phát hiện và sửa trực tiếp từ 130/1.261 turn "tóm tắt" fail trong chatlog thật (§1) — cùng một loại pain đã ghi trong changelog `d0c48e9`/`07ee898` nhưng **chưa từng được đo lại bằng bộ CP3 chính thức** (xem gap ở §7). |
