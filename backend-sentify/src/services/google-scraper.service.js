const crypto = require('crypto')

const { badGateway } = require('../lib/app-error')

const REVIEW_FIXTURES = [
    {
        authorName: 'Tran B',
        rating: 2,
        content: 'Phuc vu cham, mon hoi nguoi va ban ban.',
        daysAgo: 2,
    },
    {
        authorName: 'Le C',
        rating: 5,
        content: 'Do an ngon, nhan vien than thien, len mon nhanh.',
        daysAgo: 4,
    },
    {
        authorName: 'Pham D',
        rating: 3,
        content: 'Tam on, quan dong nen hoi lau mot chut.',
        daysAgo: 8,
    },
    {
        authorName: 'Nguyen E',
        rating: 1,
        content: 'Thai do nhan vien te, phuc vu lau va mon hoi do.',
        daysAgo: 11,
    },
    {
        authorName: 'Hoang F',
        rating: 4,
        content: 'Quan sach, vi tri de tim, do an kha tot.',
        daysAgo: 15,
    },
    {
        authorName: 'Vu G',
        rating: 2,
        content: 'Gia cao, cho lau, khong gian on ao.',
        daysAgo: 20,
    },
    {
        authorName: 'Bui H',
        rating: 5,
        content: 'Rat hai long, mon ngon va phuc vu rat nhanh.',
        daysAgo: 27,
    },
    {
        authorName: 'Do I',
        rating: 1,
        content: 'Mon nguoi, ban ban, ve sinh kem va nhan vien khong than thien.',
        daysAgo: 35,
    },
]

function buildReviewDate(daysAgo) {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - daysAgo)
    date.setUTCHours(10, 0, 0, 0)
    return date
}

async function scrapeGoogleReviews({ googleMapUrl }) {
    let parsedUrl

    try {
        parsedUrl = new URL(googleMapUrl)
    } catch (error) {
        throw badGateway('SCRAPE_FAILED', 'The saved Google Maps URL is invalid')
    }

    if (!parsedUrl.hostname.toLowerCase().includes('google')) {
        throw badGateway('SCRAPE_FAILED', 'The saved URL is not a Google Maps URL')
    }

    const seed = crypto.createHash('sha1').update(googleMapUrl).digest('hex').slice(0, 10)

    return REVIEW_FIXTURES.map((fixture, index) => ({
        externalId: `google_${seed}_${index + 1}`,
        authorName: fixture.authorName,
        rating: fixture.rating,
        content: fixture.content,
        reviewDate: buildReviewDate(fixture.daysAgo),
    }))
}

module.exports = {
    scrapeGoogleReviews,
}
