const test = require('node:test')
const assert = require('node:assert/strict')

const dashboardService = require('../src/services/dashboard.service')

const {
    MERCHANT_ACTION_SUMMARY_STATE,
    MERCHANT_ACTION_RECOMMENDATION_CODE,
    buildMerchantActionsPayload,
} = dashboardService.__private

test('buildMerchantActionsPayload returns AWAITING_SOURCE when no Google Maps URL exists', () => {
    const payload = buildMerchantActionsPayload({
        restaurant: {
            googleMapUrl: null,
        },
        entitlement: {
            planTier: 'FREE',
            effectivePolicy: {
                sourceSubmissionLane: 'STANDARD',
                sourceSyncIntervalMinutes: 1440,
                actionCardsLimit: 1,
                prioritySync: false,
                processingClass: 'STANDARD_QUEUE',
            },
        },
        insightSummary: {
            totalReviews: 0,
            averageRating: 0,
            negativePercentage: 0,
        },
        complaintKeywords: [],
        negativeReviews: [],
    })

    assert.equal(payload.summary.state, MERCHANT_ACTION_SUMMARY_STATE.AWAITING_SOURCE)
    assert.equal(payload.snapshot.hasSourceUrl, false)
    assert.equal(payload.topIssue, null)
    assert.deepEqual(payload.actionCards, [])
    assert.equal(payload.capabilities.actionCardsLimit, 1)
    assert.equal(payload.executionLayer.nextCapabilityCode, 'CONNECT_SOURCE')
})

test('buildMerchantActionsPayload returns evidence-backed actionable cards from published complaints', () => {
    const payload = buildMerchantActionsPayload({
        restaurant: {
            googleMapUrl: 'https://maps.app.goo.gl/demo-place',
        },
        entitlement: {
            planTier: 'PREMIUM',
            effectivePolicy: {
                sourceSubmissionLane: 'PRIORITY',
                sourceSyncIntervalMinutes: 360,
                actionCardsLimit: 3,
                prioritySync: true,
                processingClass: 'PRIORITY_QUEUE',
            },
        },
        insightSummary: {
            totalReviews: 10,
            averageRating: 3.3,
            negativePercentage: 40,
        },
        complaintKeywords: [
            {
                keyword: 'slow service',
                count: 3,
                percentage: 75,
                lastUpdatedAt: new Date('2026-03-27T10:00:00.000Z'),
            },
            {
                keyword: 'dirty tables',
                count: 2,
                percentage: 50,
                lastUpdatedAt: new Date('2026-03-27T09:00:00.000Z'),
            },
        ],
        negativeReviews: [
            {
                id: 'review-1',
                authorName: 'Lan',
                rating: 2,
                sentiment: 'NEGATIVE',
                content: 'Slow service again and the soup arrived cold.',
                reviewDate: new Date('2026-03-26T07:00:00.000Z'),
                createdAt: new Date('2026-03-26T07:00:00.000Z'),
                keywords: ['slow service'],
            },
            {
                id: 'review-2',
                authorName: 'Minh',
                rating: 2,
                sentiment: 'NEGATIVE',
                content: 'Dirty tables made the room feel rushed.',
                reviewDate: new Date('2026-03-25T07:00:00.000Z'),
                createdAt: new Date('2026-03-25T07:00:00.000Z'),
                keywords: ['dirty tables'],
            },
        ],
    })

    assert.equal(payload.summary.state, MERCHANT_ACTION_SUMMARY_STATE.ACTIONABLE_NOW)
    assert.equal(payload.topIssue.keyword, 'slow service')
    assert.equal(payload.topIssue.recommendationCode, MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_RESPONSE_TIME)
    assert.equal(payload.actionCards.length, 2)
    assert.equal(payload.actionCards[0].status, 'NOW')
    assert.equal(payload.actionCards[0].recommendationCode, MERCHANT_ACTION_RECOMMENDATION_CODE.FIX_RESPONSE_TIME)
    assert.equal(payload.actionCards[0].evidenceReview.id, 'review-1')
    assert.equal(payload.actionCards[1].status, 'NEXT')
    assert.equal(payload.capabilities.sourceSubmissionLane, 'PRIORITY')
    assert.equal(payload.executionLayer.nextCapabilityCode, 'ASSIGN_AND_TRACK')
})
