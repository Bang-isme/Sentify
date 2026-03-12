# 9. AI Pipeline Design — Sprint 1

Date: 2026-03-03  
Updated: 2026-03-06 (Sprint 1 scope sync)

## 9.1 Overview

Sprint 1 dùng pipeline AI đơn giản:
1. **Sentiment Analysis**: phân loại review → positive / neutral / negative
2. **Keyword Extraction**: trích xuất keywords từ review tiêu cực

Không có trong Sprint 1:
- ❌ Text embedding / vector storage
- ❌ Topic clustering (cosine similarity)
- ❌ RAG-style recommendation
- ❌ AI summary generation

## 9.2 Sentiment Analysis

### Approach: Keyword-based + OpenAI fallback

**Option A: Simple keyword-based (miễn phí, nhanh)**
```
Input: review text
→ Normalize (lowercase, remove diacritics optional)
→ Check positive keywords: "ngon", "tốt", "nhanh", "sạch", "thân thiện"...
→ Check negative keywords: "chậm", "dở", "bẩn", "thái độ", "lâu", "nguội"...
→ Score = (positive_count - negative_count) / total_keywords
→ Output: "positive" | "neutral" | "negative"
```

**Option B: OpenAI API (chính xác hơn, tốn chi phí)**
```
Input: review text
→ Call OpenAI gpt-4o-mini
→ Prompt: "Classify sentiment: positive/neutral/negative. Extract keywords."
→ Output: { sentiment: "negative", keywords: ["giao hàng", "chậm"] }
```

### Sprint 1 recommendation:
- Bắt đầu với **Option A** (keyword-based) để chạy nhanh, miễn phí
- Chuẩn bị interface để swap sang **Option B** khi cần accuracy cao hơn

### Service Interface:
```typescript
interface SentimentResult {
  label: "positive" | "neutral" | "negative";
  keywords: string[];
}

interface SentimentAnalyzer {
  analyze(text: string): Promise<SentimentResult>;
}
```

## 9.3 Keyword Extraction

### Approach:
1. Lọc reviews có rating 1-2⭐ (hoặc sentiment = "negative")
2. Tokenize text → split by spaces/punctuation
3. Remove stopwords (Vietnamese: "của", "và", "là", "có", "không"...)
4. Count frequency per keyword
5. Tính % = keyword_count / total_negative_reviews
6. Lưu top N keywords vào `ComplaintKeyword` table

### Khi nào chạy:
- Sau mỗi lần import reviews → recalculate
- Update `ComplaintKeyword` table (delete old + insert new)

## 9.4 InsightSummary Calculation

Sau mỗi lần import, update `InsightSummary`:

```sql
-- Tính từ bảng Review
averageRating = AVG(rating) WHERE restaurantId = ?
totalReviews = COUNT(*) WHERE restaurantId = ?
positivePercentage = COUNT(sentiment='positive') / total * 100
neutralPercentage = COUNT(sentiment='neutral') / total * 100
negativePercentage = COUNT(sentiment='negative') / total * 100
```

## 9.5 Sprint 2 Pipeline (để tham khảo)

Khi cần nâng cấp:
1. Replace keyword-based → OpenAI sentiment
2. Add text embedding (text-embedding-3-small)
3. Add vector storage (pgvector)
4. Add topic clustering (cosine similarity)
5. Add AI summary + recommendation generation
6. Move to async processing (BullMQ + Redis)
