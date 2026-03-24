function logReviewCrawlEvent(event, context = {}) {
    console.info(
        JSON.stringify({
            type: 'review_crawl_event',
            timestamp: new Date().toISOString(),
            event,
            ...context,
        }),
    )
}

module.exports = {
    logReviewCrawlEvent,
}
