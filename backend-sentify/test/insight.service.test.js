const test = require('node:test')
const assert = require('node:assert/strict')

function clearModule(modulePath) {
    delete require.cache[require.resolve(modulePath)]
}

function withMock(modulePath, exports) {
    require.cache[require.resolve(modulePath)] = {
        id: require.resolve(modulePath),
        filename: require.resolve(modulePath),
        loaded: true,
        exports,
    }
}

function restoreModules() {
    clearModule('../src/services/insight.service')
    clearModule('../src/lib/prisma')
    clearModule('../src/services/sentiment-analyzer.service')
}

test('insight service reuses cached review keywords and only falls back to extraction when needed', async () => {
    restoreModules()

    let extractedKeywordInputs = 0
    let summaryUpsertPayload = null
    let createdComplaintKeywords = null

    withMock('../src/lib/prisma', {
        review: {
            aggregate: async () => ({
                _count: { _all: 3 },
                _avg: { rating: 2.7 },
            }),
            groupBy: async () => [
                { sentiment: 'POSITIVE', _count: { _all: 1 } },
                { sentiment: 'NEGATIVE', _count: { _all: 2 } },
            ],
            findMany: async () => [
                { sentiment: 'NEGATIVE', content: 'Service was slow and rude.', keywords: ['slow', 'rude'] },
                { sentiment: 'NEGATIVE', content: 'Food arrived cold.', keywords: [] },
            ],
        },
        $transaction: async (callback) =>
            callback({
                insightSummary: {
                    upsert: async (payload) => {
                        summaryUpsertPayload = payload
                    },
                },
                complaintKeyword: {
                    deleteMany: async () => undefined,
                    createMany: async ({ data }) => {
                        createdComplaintKeywords = data
                    },
                },
            }),
    })

    withMock('../src/services/sentiment-analyzer.service', {
        extractComplaintKeywords: (content) => {
            extractedKeywordInputs += 1
            return content.includes('cold') ? ['cold food'] : []
        },
    })

    const { recalculateRestaurantInsights } = require('../src/services/insight.service')
    const result = await recalculateRestaurantInsights({
        restaurantId: 'restaurant-1',
    })

    assert.equal(extractedKeywordInputs, 1)
    assert.equal(summaryUpsertPayload.update.totalReviews, 3)
    assert.equal(summaryUpsertPayload.update.negativePercentage, 66.7)
    assert.deepEqual(
        createdComplaintKeywords.map((row) => [row.keyword, row.count]),
        [
            ['cold food', 1],
            ['rude', 1],
            ['slow', 1],
        ],
    )
    assert.equal(result.complaintKeywords.length, 3)

    restoreModules()
})
