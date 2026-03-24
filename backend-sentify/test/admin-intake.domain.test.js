const test = require('node:test')
const assert = require('node:assert/strict')

const { buildCanonicalReviewExternalId } = require('../src/modules/admin-intake/admin-intake.domain')

test('admin intake uses source review identity when available for canonical external ids', () => {
    const externalId = buildCanonicalReviewExternalId('restaurant-1', {
        sourceProvider: 'GOOGLE_MAPS',
        sourceExternalId: 'google-maps:review:abc123',
        rawAuthorName: 'Ana',
        rawRating: 5,
        rawContent: 'Great pho',
        rawReviewDate: new Date('2026-03-20T00:00:00.000Z'),
    })

    assert.equal(externalId, 'source-review:v1:google_maps:google-maps:review:abc123')
})
