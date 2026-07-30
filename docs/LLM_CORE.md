# LLM Core

## Kiến trúc

Mọi lời gọi mô hình chạy ở server và đi qua `backend/src/llm/LLMCore`. Frontend không chứa API key và không import SDK của provider.

```text
React → RAG retrieval → POST /api/tutor/chat
      → grounded-generation → LLMCore
      → OpenAI-compatible adapter → primary/fallback provider
```

`LLMCore` cung cấp ba method:

- `generate()` cho chat completion thông thường.
- `generate_structured()` cho JSON output có schema validation.
- `health_check()` để kiểm tra endpoint provider.

Response chuẩn chứa `content`, `provider`, `model`, token usage, latency, finish reason, request ID, provider request ID và tổng số attempt.

## Cấu hình

Sao chép `.env.example` thành `.env`, sau đó điền provider, endpoint, model và key ở máy chạy server. Không thêm prefix `VITE_` cho key vì Vite sẽ public biến đó ra browser.

### Gemini qua OpenAI compatibility

```env
LLM_PRIMARY_PROVIDER=gemini
LLM_PRIMARY_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai
LLM_PRIMARY_API_KEY=your_key
LLM_PRIMARY_MODEL=your_available_gemini_model
```

### NVIDIA NIM

```env
LLM_PRIMARY_PROVIDER=nvidia
LLM_PRIMARY_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_PRIMARY_API_KEY=your_key
LLM_PRIMARY_MODEL=your_available_nim_model
```

Model không có giá trị mặc định trong source. Hãy chọn model đang có trong tài khoản/provider và khai báo qua biến môi trường.

Fallback chỉ hoạt động khi cả bốn biến `LLM_FALLBACK_*` được cấu hình. Retry chỉ áp dụng cho timeout, network error, rate limit và lỗi provider tạm thời; config/invalid request không được retry.

## Chạy

```bash
npm install
npm run dev
```

Lệnh trên chạy Vite ở port 5173 và server API ở port 3001. Vite proxy `/api` sang server.

Kiểm tra server và provider:

```bash
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1:3001/api/llm/health
```

## Bảo mật và logging

- Key chỉ được đọc từ environment ở server.
- Log chỉ chứa provider/model, request ID, latency, usage, finish reason và mã lỗi.
- Không log API key, prompt, message history hoặc nội dung evidence.
- Server kiểm tra lại citation; trang nguồn ngoài evidence bị chuyển thành `insufficientContext`.

## Test

```bash
npm run test:llm
npm test
npm run typecheck
npm run lint
npm run build
```

Unit/integration test dùng provider stub, không tiêu tốn quota và không cần secret thật.

## Tài liệu provider

- Gemini OpenAI compatibility: https://ai.google.dev/gemini-api/docs/openai
- NVIDIA NIM OpenAI-compatible API: https://docs.nvidia.com/nim/large-language-models/latest/api-reference.html
