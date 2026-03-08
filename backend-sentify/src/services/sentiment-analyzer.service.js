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
])

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
        return text.includes(normalizedKeyword) || foldedText.includes(foldedKeyword)
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
            .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
    )
}

async function analyzeReview({ content, rating }) {
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

    if (negativeMatches.length > 0) {
        return {
            label,
            keywords: unique(negativeMatches).slice(0, 5),
        }
    }

    return {
        label,
        keywords: collectTokenKeywords(normalizedText).slice(0, 5),
    }
}

module.exports = {
    analyzeReview,
    normalizeText,
}
