const test = require('node:test')
const assert = require('node:assert/strict')

const {
    extractPlaceHexIdFromUrl,
    extractPreviewFetchPathFromHtml,
    parseCidFromPlaceHexId,
    parsePreviewPlacePayload,
    parseReviewPagePayload,
} = require('../src/modules/review-crawl/google-maps.parser')

test('google maps parser extracts the preview preload URL from html', () => {
    const html = `
        <!doctype html>
        <html>
          <head>
            <link href="/maps/preview/place?authuser=0&amp;hl=en&amp;pb=test-value" as="fetch" rel="preload">
          </head>
        </html>
    `

    assert.equal(
        extractPreviewFetchPathFromHtml(html),
        '/maps/preview/place?authuser=0&hl=en&pb=test-value',
    )
})

test('google maps parser extracts the last place id from a nested multi-place url', () => {
    const url =
        'https://www.google.com/maps/place/Quán+Phở+Hồng/@16.0691784,108.2159655,2517m/data=!3m1!1e3!4m21!1m9!3m8!1s0x314219bb28181783:0xdc89976718ec6b96!2sThe+59+cafe!8m2!3d16.0717586!4d108.2175209!9m1!1b1!16s%2Fg%2F11jdrj84zk!3m10!1s0x314219004bcdcae5:0x3f209364ddcb52d4!5m2!4m1!1i2!8m2!3d16.077659!4d108.2219165!9m1!1b1!16s%2Fg%2F11ld2kb4vt?entry=ttu'

    assert.equal(
        extractPlaceHexIdFromUrl(url),
        '0x314219004bcdcae5:0x3f209364ddcb52d4',
    )
})

test('google maps parser converts place hex ids into canonical cid values', () => {
    assert.equal(
        parseCidFromPlaceHexId('0x314219004bcdcae5:0x3f209364ddcb52d4'),
        '4548797685071303380',
    )
})

test('google maps parser extracts preview metadata', () => {
    const payload = []
    payload[6] = []
    payload[6][2] = ['23 W 33rd St', 'New York, NY 10001', 'United States']
    payload[6][4] = [null, null, null, null, null, null, null, 4.4]
    payload[6][9] = [null, null, 40.7484404, -73.9861861]
    payload[6][10] = '0x89c259a903a8074d:0x85e2e7637cfe73a5'
    payload[6][11] = 'Tacombi'
    payload[6][13] = ['Mexican restaurant', 'Restaurant']
    payload[6][18] = 'Tacombi, 23 W 33rd St, New York, NY 10001, United States'
    payload[6][32] = [null, [null, 'Full restaurant description']]
    payload[6][37] = [null, 1797, null, 'REVIEW_TOKEN']
    payload[6][42] = 'https://www.google.com/maps/preview/place/Tacombi'
    payload[6][78] = 'ChIJTQeoA6lZwokRpXP-fGPn4oU'

    const parsed = parsePreviewPlacePayload(payload, {
        inputUrl:
            'https://www.google.com/maps/place/Tacombi/@40.748062,-73.985694,17z/data=!4m5!3m4!1s0x89c259a903a8074d:0x85e2e7637cfe73a5!8m2!3d40.748062!4d-73.985694',
    })

    assert.equal(parsed.place.name, 'Tacombi')
    assert.equal(parsed.place.totalReviewCount, 1797)
    assert.equal(parsed.place.identifiers.googlePlaceId, 'ChIJTQeoA6lZwokRpXP-fGPn4oU')
    assert.equal(parsed.place.identifiers.cid, '9647527766265852837')
    assert.equal(parsed.place.coordinates.latitude, 40.7484404)
})

test('google maps parser extracts normalized review rows from rpc payload', () => {
    const review = []
    review[0] = 'review-1'
    review[1] = []
    review[1][2] = 1773438148012879
    review[1][3] = 1773871134699022
    review[1][4] = [
        null,
        null,
        ['https://www.google.com/maps/contrib/100769441830883212380/reviews?hl=en'],
        null,
        null,
        [
            'Bryon Perreira',
            'https://lh3.googleusercontent.com/avatar',
            ['https://www.google.com/maps/contrib/100769441830883212380?hl=en'],
            '100769441830883212380',
            null,
            72,
            102,
            null,
            null,
            null,
            ['Local Guide · 72 reviews'],
        ],
    ]
    review[1][6] = '2 days ago'
    review[1][13] = ['Google']
    review[2] = []
    review[2][0] = [5]
    review[2][14] = ['en']
    review[2][15] = [['Always great service']]
    review[3] = []
    review[3][1] = 1773495830000000
    review[3][2] = 1773495830000000
    review[3][14] = [['Thanks for visiting']]

    const payload = []
    payload[1] = 'NEXT_TOKEN'
    payload[2] = [
        [
            review,
            null,
            [
                null,
                null,
                null,
                ['https://www.google.com/maps/reviews/data=!4m8!review-1'],
            ],
        ],
    ]

    const parsed = parseReviewPagePayload(payload)

    assert.equal(parsed.nextPageToken, 'NEXT_TOKEN')
    assert.equal(parsed.reviews.length, 1)
    assert.equal(parsed.reviews[0].reviewId, 'review-1')
    assert.equal(parsed.reviews[0].author.name, 'Bryon Perreira')
    assert.equal(parsed.reviews[0].rating, 5)
    assert.equal(parsed.reviews[0].text, 'Always great service')
    assert.equal(parsed.reviews[0].ownerResponse.text, 'Thanks for visiting')
    assert.equal(
        parsed.reviews[0].reviewUrl,
        'https://www.google.com/maps/reviews/data=!4m8!review-1',
    )
})
