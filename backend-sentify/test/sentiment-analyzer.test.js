const test = require('node:test')
const assert = require('node:assert/strict')

const { analyzeReview, normalizeText } = require('../src/services/sentiment-analyzer.service')

test('sentiment analyzer preserves multilingual text during normalization', () => {
    assert.equal(normalizeText('Phục vụ rất tốt!'), 'phục vụ rất tốt')
    assert.equal(normalizeText('Great service, very clean.'), 'great service very clean')
    assert.equal(normalizeText('接客が遅い。料理がぬるい。'), '接客が遅い 料理がぬるい')
})

test('sentiment analyzer does not match "late" inside translation boilerplate', async () => {
    const result = await analyzeReview({
        content: '(Translated by Google) Pleasant atmosphere and clean tables.',
        rating: 5,
    })

    assert.equal(result.label, 'POSITIVE')
    assert.deepEqual(result.keywords, [])
})

test('sentiment analyzer ignores internal id-like junk content', async () => {
    const result = await analyzeReview({
        content: '0x0:0x7f3c3d5f44588746',
        rating: 1,
    })

    assert.equal(result.label, 'NEGATIVE')
    assert.deepEqual(result.keywords, [])
})

test('sentiment analyzer extracts negative vietnamese complaint keywords accurately', async () => {
    const result = await analyzeReview({
        content: 'Phục vụ chậm, món ăn nguội và giá cao.',
        rating: 2,
    })

    assert.equal(result.label, 'NEGATIVE')
    assert.deepEqual(result.keywords, ['chậm', 'nguội', 'giá cao'])
})

test('sentiment analyzer extracts negative english complaint keywords accurately', async () => {
    const result = await analyzeReview({
        content: 'Service was slow, rude, and overpriced.',
        rating: 1,
    })

    assert.equal(result.label, 'NEGATIVE')
    assert.deepEqual(result.keywords, ['slow', 'rude', 'overpriced'])
})

test('sentiment analyzer handles japanese complaint phrases without corrupting text', async () => {
    const result = await analyzeReview({
        content: '接客が遅いし、店内もうるさい。',
        rating: 2,
    })

    assert.equal(result.label, 'NEGATIVE')
    assert.deepEqual(result.keywords, ['遅い', 'うるさい'])
})
