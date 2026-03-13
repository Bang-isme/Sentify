const POSITIVE_KEYWORDS = [
    'ngon',
    'tốt',
    'nhanh',
    'sạch',
    'thân thiện',
    'hài lòng',
    'tuyệt vời',
    'dễ tìm',
    'delicious',
    'great',
    'good',
    'friendly',
    'clean',
    'quick',
    'fast',
    'excellent',
    'amazing',
    '美味しい',
    'おいしい',
    '良い',
    '最高',
    '親切',
    '早い',
    '清潔',
]

const NEGATIVE_KEYWORDS = [
    'chậm',
    'lâu',
    'tệ',
    'thái độ',
    'nguội',
    'bẩn',
    'giá cao',
    'ồn ào',
    'vệ sinh kém',
    'không thân thiện',
    'slow',
    'late',
    'bad',
    'rude',
    'dirty',
    'noisy',
    'overpriced',
    'cold food',
    'terrible',
    'awful',
    'まずい',
    '遅い',
    '高い',
    '汚い',
    'うるさい',
    '最悪',
]

const STOPWORDS = new Set([
    'và',
    'là',
    'có',
    'cho',
    'một',
    'rất',
    'khá',
    'nên',
    'hơi',
    'này',
    'kia',
    'quán',
    'món',
    'nhân',
    'viên',
    'không',
    'đồ',
    'ăn',
    'the',
    'and',
    'for',
    'with',
    'this',
    'that',
    'very',
    'really',
    'just',
    'have',
    'had',
    'was',
    'were',
    'food',
    'place',
    'restaurant',
    'service',
    'translated',
    'translate',
    'translation',
    'original',
    'google',
    'hours',
    'hour',
    'days',
    'day',
    'weeks',
    'week',
    'months',
    'month',
    'ago',
])

const INTERNAL_KEYWORD_PATTERNS = [
    /^0x[0-9a-f]+$/i,
    /^0ahuke/i,
    /^[a-z0-9]+(?:_[a-z0-9]+){2,}$/i,
    /^[a-z0-9]{24,}$/i,
]

function normalizeText(text) {
    return (text || '')
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function foldLatinText(text) {
    return normalizeText(text)
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
}

function unique(values) {
    return [...new Set(values)]
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function labelFromRating(rating) {
    if (rating >= 4) {
        return 'POSITIVE'
    }

    if (rating <= 2) {
        return 'NEGATIVE'
    }

    return 'NEUTRAL'
}

function collectPhraseMatches(text, foldedText, keywords) {
    return keywords.filter((keyword) => {
        const normalizedKeyword = normalizeText(keyword)
        const foldedKeyword = foldLatinText(keyword)

        const buildPattern = (value) =>
            new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(value).replace(/\s+/g, '\\s+')}($|[^\\p{L}\\p{N}])`, 'u')

        const matchesKeyword = (sourceText, keywordValue) => {
            if (!keywordValue) {
                return false
            }

            if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(keywordValue)) {
                return sourceText.includes(keywordValue)
            }

            return buildPattern(keywordValue).test(sourceText)
        }

        return matchesKeyword(text, normalizedKeyword) || matchesKeyword(foldedText, foldedKeyword)
    })
}

function containsCjk(text) {
    return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text)
}

function collectTokenKeywords(text) {
    if (containsCjk(text)) {
        return []
    }

    return unique(
        (text.match(/[\p{L}\p{N}-]+/gu) || [])
            .map((token) => token.trim())
            .filter(
                (token) =>
                    token.length >= 3 &&
                    !STOPWORDS.has(token) &&
                    !INTERNAL_KEYWORD_PATTERNS.some((pattern) => pattern.test(token)),
            ),
    )
}

function extractComplaintKeywords(content) {
    const normalizedText = normalizeText(content)

    if (!normalizedText) {
        return []
    }

    const foldedText = foldLatinText(content)

    const negativeMatches = collectPhraseMatches(normalizedText, foldedText, NEGATIVE_KEYWORDS)

    if (negativeMatches.length > 0) {
        return unique(negativeMatches).slice(0, 5)
    }

    return collectTokenKeywords(normalizedText).slice(0, 5)
}

function analyzeReviewSync({ content, rating }) {
    const normalizedText = normalizeText(content)
    const foldedText = foldLatinText(content)

    if (!normalizedText) {
        return {
            label: labelFromRating(rating),
            keywords: [],
        }
    }

    const positiveMatches = collectPhraseMatches(normalizedText, foldedText, POSITIVE_KEYWORDS)
    const negativeMatches = collectPhraseMatches(normalizedText, foldedText, NEGATIVE_KEYWORDS)

    let score = positiveMatches.length - negativeMatches.length

    if (rating >= 4) {
        score += 1
    } else if (rating <= 2) {
        score -= 1
    }

    let label = 'NEUTRAL'

    if (score > 0) {
        label = 'POSITIVE'
    } else if (score < 0) {
        label = 'NEGATIVE'
    } else {
        label = labelFromRating(rating)
    }

    if (label !== 'NEGATIVE') {
        return {
            label,
            keywords: [],
        }
    }

    return {
        label,
        keywords: extractComplaintKeywords(content),
    }
}

async function analyzeReview(input) {
    return analyzeReviewSync(input)
}

module.exports = {
    analyzeReview,
    analyzeReviewSync,
    extractComplaintKeywords,
    normalizeText,
}
