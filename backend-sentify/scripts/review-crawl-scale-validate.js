#!/usr/bin/env node

require('dotenv').config()

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')

const env = require('../src/config/env')
const { crawlGoogleMapsReviews } = require('../src/modules/review-crawl/google-maps.service')
const { crawlGoogleMapsOptionsSchema } = require('../src/modules/review-crawl/google-maps.validation')

function readFlag(args, name) {
    const inline = args.find((value) => value.startsWith(`${name}=`))

    if (inline) {
        return inline.slice(`${name}=`.length)
    }

    const index = args.findIndex((value) => value === name)

    if (index === -1) {
        return undefined
    }

    return args[index + 1]
}

function parsePositiveInt(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback
    }

    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed
}

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/review-crawl-scale-validate.js --url <google-maps-url> [options]',
            '',
            'Options:',
            '  --language <code>          Default: en',
            '  --region <code>            Default: us',
            '  --page-size <n>            Default: 20',
            '  --target-reviews <n>       Default: 20000',
            '  --direct-runs <n>          Default: 2',
            '  --queued-runs <n>          Default: 1',
            '  --queue-timeout-ms <n>     Default: 1200000',
            '  --queue-settle-ms <n>      Default: 8000',
            '  --output <file>            Write JSON report to a file',
        ].join('\n'),
    )
}

function mean(values) {
    if (!values.length) {
        return 0
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round(value, digits = 2) {
    const factor = 10 ** digits
    return Math.round(value * factor) / factor
}

function summarizeRuns(runs) {
    const durations = runs.map((run) => run.durationMs)
    const extractedCounts = runs.map((run) => run.extractedCount)
    const pagesFetched = runs.map((run) => run.pagesFetched)
    const reviewsPerSecond = runs.map((run) =>
        run.durationMs > 0 ? run.extractedCount / (run.durationMs / 1000) : 0,
    )
    const pagesPerSecond = runs.map((run) =>
        run.durationMs > 0 ? run.pagesFetched / (run.durationMs / 1000) : 0,
    )
    const reviewsPerPage = runs.map((run) =>
        run.pagesFetched > 0 ? run.extractedCount / run.pagesFetched : 0,
    )

    return {
        runCount: runs.length,
        extractedCounts,
        pagesFetched,
        durationMs: durations,
        averageDurationMs: round(mean(durations), 2),
        averageExtractedCount: round(mean(extractedCounts), 2),
        averagePagesFetched: round(mean(pagesFetched), 2),
        averageReviewsPerSecond: round(mean(reviewsPerSecond), 2),
        averagePagesPerSecond: round(mean(pagesPerSecond), 3),
        averageReviewsPerPage: round(mean(reviewsPerPage), 3),
        convergedExtractedCount:
            new Set(extractedCounts).size === 1 ? extractedCounts[0] : null,
    }
}

function estimateTargetScale(summary, targetReviews) {
    const averageReviewsPerPage = summary.averageReviewsPerPage || 20
    const averageReviewsPerSecond = summary.averageReviewsPerSecond || 0
    const estimatedPages = Math.ceil(targetReviews / averageReviewsPerPage)
    const estimatedDurationMs =
        averageReviewsPerSecond > 0
            ? Math.ceil((targetReviews / averageReviewsPerSecond) * 1000)
            : null
    const estimatedBackfillLegs = Math.ceil(
        estimatedPages / env.REVIEW_CRAWL_BACKFILL_MAX_PAGES,
    )
    const availableLegs = env.REVIEW_CRAWL_BACKFILL_AUTO_RESUME_MAX_CHAINS + 1

    return {
        targetReviews,
        estimatedPages,
        estimatedDurationMs,
        estimatedBackfillLegs,
        backfillLegCapacity: availableLegs,
        fitsCurrentLegBudget: estimatedBackfillLegs <= availableLegs,
    }
}

async function runDirectBenchmark(input, iteration) {
    const startedAt = Date.now()
    const result = await crawlGoogleMapsReviews(input)
    const durationMs = Date.now() - startedAt

    return {
        iteration,
        mode: 'direct',
        durationMs,
        extractedCount: result.crawl.totalReviewsExtracted,
        pagesFetched: result.crawl.fetchedPages,
        completeness: result.crawl.completeness,
        reportedTotal: result.place.totalReviewCount,
        warningCount: Array.isArray(result.crawl.warnings)
            ? result.crawl.warnings.length
            : 0,
        warnings: result.crawl.warnings || [],
    }
}

async function runQueuedBenchmark(args, options, iteration) {
    const tempFile = path.join(
        os.tmpdir(),
        `sentify-scale-queued-${Date.now()}-${iteration}.json`,
    )
    const commandArgs = [
        'scripts/review-crawl-queue-smoke.js',
        '--url',
        options.url,
        '--language',
        options.language,
        '--region',
        options.region,
        '--strategy',
        'backfill',
        '--page-size',
        String(options.pageSize),
        '--delay-ms',
        '0',
        '--timeout-ms',
        String(options.queueTimeoutMs),
        '--settle-ms',
        String(options.queueSettleMs),
        '--output',
        tempFile,
    ]

    const startedAt = Date.now()

    await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, commandArgs, {
            cwd: path.resolve(__dirname, '..'),
            stdio: 'inherit',
            windowsHide: true,
        })

        child.once('error', reject)
        child.once('exit', (code) => {
            if (code === 0) {
                resolve()
                return
            }

            reject(
                new Error(
                    `review-crawl-queue-smoke.js exited with code ${code ?? 'unknown'}`,
                ),
            )
        })
    })

    const payload = JSON.parse(fs.readFileSync(tempFile, 'utf8'))
    fs.rmSync(tempFile, { force: true })

    return {
        iteration,
        mode: 'queued',
        durationMs: Date.now() - startedAt,
        extractedCount: payload.run.extractedCount,
        pagesFetched: payload.run.pagesFetched,
        completeness: payload.run.status,
        reportedTotal: payload.run.reportedTotal,
        warningCount: payload.run.warningCount,
        warnings: payload.run.warnings || [],
        benchmarkWallClockMs: payload.benchmark?.totalWallClockMs ?? null,
        inlineQueueMode: payload.redis?.inlineQueueMode ?? false,
    }
}

async function main() {
    const args = process.argv.slice(2)
    const url = readFlag(args, '--url')

    if (!url) {
        printUsage()
        process.exit(1)
    }

    const options = {
        url,
        language: readFlag(args, '--language') || 'en',
        region: readFlag(args, '--region') || 'us',
        pageSize: parsePositiveInt(readFlag(args, '--page-size'), 20),
        targetReviews: parsePositiveInt(readFlag(args, '--target-reviews'), 20000),
        directRuns: parsePositiveInt(readFlag(args, '--direct-runs'), 2),
        queuedRuns: parsePositiveInt(readFlag(args, '--queued-runs'), 1),
        queueTimeoutMs: parsePositiveInt(
            readFlag(args, '--queue-timeout-ms'),
            20 * 60 * 1000,
        ),
        queueSettleMs: parsePositiveInt(readFlag(args, '--queue-settle-ms'), 8000),
    }

    const crawlInput = crawlGoogleMapsOptionsSchema.parse({
        url: options.url,
        language: options.language,
        region: options.region,
        sort: 'newest',
        pages: 'max',
        pageSize: options.pageSize,
        delayMs: 0,
    })

    const directRuns = []
    for (let iteration = 1; iteration <= options.directRuns; iteration += 1) {
        directRuns.push(await runDirectBenchmark(crawlInput, iteration))
    }

    const queuedRuns = []
    for (let iteration = 1; iteration <= options.queuedRuns; iteration += 1) {
        queuedRuns.push(await runQueuedBenchmark(args, options, iteration))
    }

    const directSummary = summarizeRuns(directRuns)
    const queuedSummary = summarizeRuns(queuedRuns)
    const directEstimate = estimateTargetScale(
        directSummary,
        options.targetReviews,
    )
    const queuedEstimate = estimateTargetScale(
        queuedSummary,
        options.targetReviews,
    )
    const observedReportedTotals = [
        ...directRuns.map((run) => run.reportedTotal),
        ...queuedRuns.map((run) => run.reportedTotal),
    ]
    const observedReportedTotal =
        observedReportedTotals.length > 0
            ? observedReportedTotals[observedReportedTotals.length - 1]
            : null

    const report = {
        generatedAt: new Date().toISOString(),
        targetUrl: options.url,
        targetReviews: options.targetReviews,
        validationChecklist: [
            'Run repeated direct full crawls and verify extractedCount converges.',
            'Run at least one queued backfill and compare extractedCount to direct mode.',
            'Check reportedTotal versus extractedCount and keep mismatch warnings visible.',
            'Estimate target pages, duration, and backfill legs for the desired review count.',
            'Do not claim completeness proof for target scale until a comparable live source is benchmarked.',
        ],
        runtimeBudgets: {
            backfillMaxPagesPerRun: env.REVIEW_CRAWL_BACKFILL_MAX_PAGES,
            incrementalMaxPagesPerRun: env.REVIEW_CRAWL_INCREMENTAL_MAX_PAGES,
            autoResumeMaxChains: env.REVIEW_CRAWL_BACKFILL_AUTO_RESUME_MAX_CHAINS,
            maxDurationMsPerRun: env.REVIEW_CRAWL_MAX_DURATION_MS,
            workerConcurrency: env.REVIEW_CRAWL_WORKER_CONCURRENCY,
        },
        observed: {
            reportedTotal: observedReportedTotal,
            direct: {
                runs: directRuns,
                summary: directSummary,
            },
            queued: {
                runs: queuedRuns,
                summary: queuedSummary,
            },
        },
        estimateForTargetReviews: {
            direct: directEstimate,
            queued: queuedEstimate,
        },
        conclusion: {
            singleSourceRuntimeLooksCapable:
                queuedEstimate.fitsCurrentLegBudget && queuedSummary.averageReviewsPerSecond > 0,
            completenessProvenAtTargetScale: false,
            note:
                'Current evidence can estimate runtime and run-budget fit for a 20K-review source, but it does not prove 20K review completeness until a comparable live source is benchmarked.',
        },
    }

    const outputPath = readFlag(args, '--output')
    const text = `${JSON.stringify(report, null, 2)}\n`

    if (!outputPath) {
        process.stdout.write(text)
        return
    }

    const resolvedOutputPath = path.resolve(outputPath)
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
    fs.writeFileSync(resolvedOutputPath, text, 'utf8')
    process.stdout.write(`${resolvedOutputPath}\n`)
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error))
    process.exit(1)
})
