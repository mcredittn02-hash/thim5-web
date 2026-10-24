# KHO LƯU TRỮ PROMPT CHUẨN LONGHOAFOOD MASTER

## [PROMPT-01] ZERO_DEFECT_AUDIT
(Dành cho giai đoạn lập kế hoạch) Yêu cầu Agent đối soát 11 tiêu chí Zero-Defect, bảo vệ 7 Sheet SSOT và phân tích luồng Data Flow trước khi chạm vào mã nguồn.

## [PROMPT-02] CHUNKING_EXPORTER (KỶ LUẬT THÉP KHI XUẤT CODE)
1. ZERO-TOLERANCE CUTTING: BẮT BUỘC xuất 100% dòng code. TUYỆT ĐỐI KHÔNG dùng placeholder (//... code cũ).
2. MULTI-PART CHUNKING: Tự động chia file thành các phần tối đa 250 dòng. Chỉ cắt sau dấu đóng hàm '}'.
3. KHÔNG ĐƯỢC XÓA BỎ logic hiện hữu nếu chưa có sự cho phép.
