const POSITIVE_KEYWORDS = [
    'ngon',
    'tot',
    'nhanh',
    'sach',
    'than thien',
    'hai long',
    'tuyet voi',
    'de tim',
]

const NEGATIVE_KEYWORDS = [
    'cham',
    'lau',
    'te',
    'thai do',
    'nguoi',
    'ban',
    'gia cao',
    'on ao',
    've sinh kem',
    'khong than thien',
    'do',
]

const STOPWORDS = new Set([
    'va',
    'la',
    'co',
    'cho',
    'mot',
    'rat',
    'kha',
    'nen',
    'hoi',
    'nay',
    'kia',
    'quan',
    'mon',
    'nhan',
    'vien',
    'khong',
    'do',
    'an',
])

function normalizeText(text) {
    return (text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
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

function collectPhraseMatches(text, keywords) {
    return keywords.filter((keyword) => text.includes(keyword))
}

function collectTokenKeywords(text) {
    return unique(
        text
            .split(' ')
            .map((token) => token.trim())
            .filter((token) => token.length >= 3 && !STOPWORDS.has(token)),
    )
}

async function analyzeReview({ content, rating }) {
    const normalizedText = normalizeText(content)

    if (!normalizedText) {
        return {
            label: labelFromRating(rating),
            keywords: [],
        }
    }

    const positiveMatches = collectPhraseMatches(normalizedText, POSITIVE_KEYWORDS)
    const negativeMatches = collectPhraseMatches(normalizedText, NEGATIVE_KEYWORDS)

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
