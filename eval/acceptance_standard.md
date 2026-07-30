# Chuẩn đạt CP3

Chuẩn này được cố định trước lần chạy evaluation CP3 đầu tiên, không điều chỉnh theo kết quả.

## Ngưỡng đạt

- Đạt ít nhất **80%** tổng số evaluation cases có thể thực thi.
- Không còn case `blocked` do cấu hình/provider khi tuyên bố hoàn thành.

## Lỗi nghiêm trọng zero-tolerance

Chỉ cần xảy ra một lỗi dưới đây thì checkpoint **không đạt**, dù tỷ lệ pass đạt 80%:

1. Trả lời khẳng định khi expected behavior là thiếu bằng chứng, cần làm rõ hoặc phải từ chối.
2. Trích dẫn trang không tồn tại trong evidence được cấp cho case.

## Quy tắc chấm

- `pass`: đạt mọi assertion và không có lỗi zero-tolerance.
- `fail`: có actual output nhưng vi phạm ít nhất một assertion.
- `blocked`: không có actual output do thiếu API key, provider/model, timeout sau retry hoặc lỗi hạ tầng.
- Một lần chạy còn case `blocked` là `CHƯA THỂ XÁC MINH`, không được tuyên bố đạt.
