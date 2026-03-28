#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { loadEnvFiles } = require('./load-env-files')

loadEnvFiles({
    includeReleaseEvidence: true,
})

const DEFAULT_OUTPUT_PATH = path.join(
    'load-reports',
    'performance-proof-local.json',
)
const DEFAULT_MERCHANT_OUTPUT_PATH = path.join(
    'load-reports',
    'merchant-reads-proof-local.json',
)
const DEFAULT_WORKER_OUTPUT_PATH = path.join(
    'load-reports',
    'review-crawl-workers-proof-local.json',
)
const DEFAULT_SCALE_OUTPUT_PATH = path.join(
    'load-reports',
    'review-crawl-scale-proof-local.json',
)

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

function hasFlag(args, name) {
    return args.includes(name)
}

function parsePositiveInt(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback
    }

    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed
}

function normalizeForDigest(value) {
    if (value instanceof Date) {
        return value.toISOString()
    }

    if (Array.isArray(value)) {
        return value.map((item) => normalizeForDigest(item))
    }

    if (value && typeof value === 'object') {
        const normalized = {}

        for (const key of Object.keys(value).sort()) {
            normalized[key] = normalizeForDigest(value[key])
        }

        return normalized
    }

    return value
}

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/performance-proof.js [options]',
            '',
            'Options:',
            '  --skip-db-reset                   Skip the clean local baseline reset before running load proofs',
            '  --merchant-output <file>          Merchant reads artifact path',
            '  --worker-output <file>            Review crawl worker artifact path',
            '  --scale-output <file>             Crawl scale validation artifact path',
            '  --output <file>                   Combined performance proof artifact path',
            '  --merchant-extra-reviews <n>      Default: 4000',
            '  --merchant-concurrency <n>        Default: 8',
            '  --merchant-rounds <n>             Default: 45',
            '  --merchant-timeout-ms <n>         Default: 10000',
            '  --merchant-max-p95-ms <n>         Default: 250',
            '  --merchant-max-error-rate <n>     Default: 0',
            '  --merchant-min-rps <n>            Default: 100',
            '  --worker-source-count <n>         Default: 24',
            '  --worker-concurrency <n>          Default: 4',
            '  --worker-pages-per-run <n>        Default: 12',
            '  --worker-reviews-per-page <n>     Default: 20',
            '  --worker-step-ms <n>              Default: 40',
            '  --worker-max-total-run-p95-ms <n> Default: 8000',
            '  --worker-min-raw-rps <n>          Default: 800',
            '  --allow-inline-worker-proof       Allow inline queue mode to pass worker proof',
            '  --scale-url <google-maps-url>     Optional live source URL for crawl scale estimation',
            '  --scale-target-reviews <n>        Default: 20000',
            '  --help                            Show this help message',
        ].join('\n'),
    )
}

function runNodeScript(scriptName, args) {
    const scriptPath = path.resolve(__dirname, scriptName)
    const child = spawnSync(process.execPath, [scriptPath, ...args], {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf8',
        env: process.env,
        windowsHide: true,
    })

    return {
        ok: !child.error && (child.status ?? 1) === 0,
        status: child.status ?? 1,
        stdout: child.stdout || '',
        stderr: child.stderr || '',
        error: child.error ? String(child.error) : null,
    }
}

function readJsonIfExists(filePath) {
    const resolvedPath = path.resolve(filePath)

    if (!fs.existsSync(resolvedPath)) {
        return null
    }

    return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'))
}

function buildCheck(key, label, status, detail, required = true) {
    return {
        key,
        label,
        status,
        required,
        detail,
    }
}

function buildOverallStatus(checks) {
    if (checks.some((check) => check.required && check.status === 'FAILED')) {
        return 'PERFORMANCE_PROOF_FAILED'
    }

    if (checks.some((check) => check.status === 'SKIPPED')) {
        return 'PERFORMANCE_PROOF_PARTIAL'
    }

    return 'PERFORMANCE_PROOF_COMPLETE'
}

function evaluateMerchantReads(report, thresholds) {
    const errorRate = report?.overall?.errorRatePercent ?? null
    const p95 = report?.overall?.p95Ms ?? null
    const requestsPerSecond = report?.overall?.requestsPerSecond ?? null
    const passed =
        typeof errorRate === 'number' &&
        typeof p95 === 'number' &&
        typeof requestsPerSecond === 'number' &&
        errorRate <= thresholds.maxErrorRatePercent &&
        p95 <= thresholds.maxP95Ms &&
        requestsPerSecond >= thresholds.minRequestsPerSecond

    return {
        passed,
        observed: {
            errorRatePercent: errorRate,
            p95Ms: p95,
            requestsPerSecond,
        },
        thresholds,
    }
}

function evaluateWorkerLoad(report, thresholds) {
    const queueMode = report?.queueMode ?? 'unknown'
    const completedCount = report?.statusSummary?.COMPLETED ?? 0
    const expectedCount = report?.configuration?.sourceCount ?? null
    const rawReviewsPerSecond = report?.execution?.rawReviewsPerSecond ?? null
    const totalRunP95 = report?.latencyMs?.totalRun?.p95Ms ?? null
    const maxRunningObserved = report?.observedConcurrency?.maxRunningObserved ?? null
    const minimumExpectedRunning = Math.max(
        1,
        (report?.configuration?.concurrency ?? 1) - 1,
    )
    const queueModeAllowed = thresholds.allowInlineQueueMode || queueMode === 'redis'
    const passed =
        queueModeAllowed &&
        expectedCount !== null &&
        completedCount === expectedCount &&
        typeof rawReviewsPerSecond === 'number' &&
        rawReviewsPerSecond >= thresholds.minRawReviewsPerSecond &&
        typeof totalRunP95 === 'number' &&
        totalRunP95 <= thresholds.maxTotalRunP95Ms &&
        typeof maxRunningObserved === 'number' &&
        maxRunningObserved >= minimumExpectedRunning

    return {
        passed,
        observed: {
            queueMode,
            completedCount,
            expectedCount,
            rawReviewsPerSecond,
            totalRunP95Ms: totalRunP95,
            maxRunningObserved,
            minimumExpectedRunning,
        },
        thresholds,
    }
}

function evaluateScaleValidation(report) {
    return {
        passed:
            Boolean(report?.estimateForTargetReviews?.queued?.fitsCurrentLegBudget) &&
            Boolean(report?.estimateForTargetReviews?.direct?.fitsCurrentLegBudget),
        observed: {
            targetReviews: report?.targetReviews ?? null,
            direct: report?.estimateForTargetReviews?.direct ?? null,
            queued: report?.estimateForTargetReviews?.queued ?? null,
            conclusion: report?.conclusion ?? null,
        },
    }
}

async function main() {
    const args = process.argv.slice(2)

    if (hasFlag(args, '--help')) {
        printUsage()
        return
    }

    const outputPath = readFlag(args, '--output') || DEFAULT_OUTPUT_PATH
    const merchantOutputPath =
        readFlag(args, '--merchant-output') || DEFAULT_MERCHANT_OUTPUT_PATH
    const workerOutputPath =
        readFlag(args, '--worker-output') || DEFAULT_WORKER_OUTPUT_PATH
    const scaleOutputPath =
        readFlag(args, '--scale-output') || DEFAULT_SCALE_OUTPUT_PATH

    const merchantOptions = {
        extraReviews: parsePositiveInt(readFlag(args, '--merchant-extra-reviews'), 4000),
        concurrency: parsePositiveInt(readFlag(args, '--merchant-concurrency'), 8),
        rounds: parsePositiveInt(readFlag(args, '--merchant-rounds'), 45),
        timeoutMs: parsePositiveInt(readFlag(args, '--merchant-timeout-ms'), 10000),
        thresholds: {
            maxP95Ms: parsePositiveInt(readFlag(args, '--merchant-max-p95-ms'), 250),
            maxErrorRatePercent: parsePositiveInt(
                readFlag(args, '--merchant-max-error-rate'),
                0,
            ),
            minRequestsPerSecond: parsePositiveInt(
                readFlag(args, '--merchant-min-rps'),
                100,
            ),
        },
    }
    const workerOptions = {
        sourceCount: parsePositiveInt(readFlag(args, '--worker-source-count'), 24),
        concurrency: parsePositiveInt(readFlag(args, '--worker-concurrency'), 4),
        pagesPerRun: parsePositiveInt(readFlag(args, '--worker-pages-per-run'), 12),
        reviewsPerPage: parsePositiveInt(
            readFlag(args, '--worker-reviews-per-page'),
            20,
        ),
        stepMs: parsePositiveInt(readFlag(args, '--worker-step-ms'), 40),
        thresholds: {
            maxTotalRunP95Ms: parsePositiveInt(
                readFlag(args, '--worker-max-total-run-p95-ms'),
                8000,
            ),
            minRawReviewsPerSecond: parsePositiveInt(
                readFlag(args, '--worker-min-raw-rps'),
                800,
            ),
            allowInlineQueueMode: hasFlag(args, '--allow-inline-worker-proof'),
        },
    }
    const scaleUrl = readFlag(args, '--scale-url')
    const scaleTargetReviews = parsePositiveInt(
        readFlag(args, '--scale-target-reviews'),
        20000,
    )
    const startedAt = new Date()
    const checks = []

    if (!hasFlag(args, '--skip-db-reset')) {
        const resetRun = runNodeScript('reset-local-baseline.js', [])
        checks.push(
            buildCheck(
                'baselineReset',
                'Clean local baseline reset',
                resetRun.ok ? 'PASSED' : 'FAILED',
                {
                    status: resetRun.status,
                    stdout: resetRun.stdout.trim(),
                    stderr: resetRun.stderr.trim(),
                    error: resetRun.error,
                },
            ),
        )

        if (!resetRun.ok) {
            const finishedAt = new Date()
            const report = {
                benchmark: {
                    startedAt,
                    finishedAt,
                    durationMs: finishedAt.getTime() - startedAt.getTime(),
                    mode: 'performance_proof',
                },
                overallStatus: buildOverallStatus(checks),
                checks,
                notes: [
                    'Performance proof stopped early because the clean local baseline could not be reset.',
                ],
            }

            const resolvedOutputPath = path.resolve(outputPath)
            fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
            fs.writeFileSync(
                resolvedOutputPath,
                `${JSON.stringify(normalizeForDigest(report), null, 2)}\n`,
            )
            process.stdout.write(`Performance proof report written to ${resolvedOutputPath}\n`)
            process.exitCode = 1
            return
        }
    }

    const merchantRun = runNodeScript('load-merchant-reads.js', [
        '--extra-reviews',
        String(merchantOptions.extraReviews),
        '--concurrency',
        String(merchantOptions.concurrency),
        '--rounds',
        String(merchantOptions.rounds),
        '--timeout-ms',
        String(merchantOptions.timeoutMs),
        '--output',
        merchantOutputPath,
    ])
    const merchantReport = readJsonIfExists(merchantOutputPath)
    const merchantEvaluation = merchantReport
        ? evaluateMerchantReads(merchantReport, merchantOptions.thresholds)
        : null

    checks.push(
        buildCheck(
            'merchantReads',
            'Merchant HTTP read-path proof',
            merchantRun.ok && merchantEvaluation?.passed ? 'PASSED' : 'FAILED',
            {
                executionStatus: merchantRun.status,
                stdout: merchantRun.stdout.trim(),
                stderr: merchantRun.stderr.trim(),
                artifactFileName: path.basename(merchantOutputPath),
                evaluation: merchantEvaluation,
            },
        ),
    )

    const workerRun = runNodeScript('load-review-crawl-workers.js', [
        '--source-count',
        String(workerOptions.sourceCount),
        '--concurrency',
        String(workerOptions.concurrency),
        '--pages-per-run',
        String(workerOptions.pagesPerRun),
        '--reviews-per-page',
        String(workerOptions.reviewsPerPage),
        '--step-ms',
        String(workerOptions.stepMs),
        '--output',
        workerOutputPath,
    ])
    const workerReport = readJsonIfExists(workerOutputPath)
    const workerEvaluation = workerReport
        ? evaluateWorkerLoad(workerReport, workerOptions.thresholds)
        : null

    checks.push(
        buildCheck(
            'reviewCrawlWorkers',
            'Review crawl worker-pressure proof',
            workerRun.ok && workerEvaluation?.passed ? 'PASSED' : 'FAILED',
            {
                executionStatus: workerRun.status,
                stdout: workerRun.stdout.trim(),
                stderr: workerRun.stderr.trim(),
                artifactFileName: path.basename(workerOutputPath),
                evaluation: workerEvaluation,
            },
        ),
    )

    if (scaleUrl) {
        const scaleRun = runNodeScript('review-crawl-scale-validate.js', [
            '--url',
            scaleUrl,
            '--target-reviews',
            String(scaleTargetReviews),
            '--output',
            scaleOutputPath,
        ])
        const scaleReport = readJsonIfExists(scaleOutputPath)
        const scaleEvaluation = scaleReport
            ? evaluateScaleValidation(scaleReport)
            : null

        checks.push(
            buildCheck(
                'reviewCrawlScaleEstimate',
                'Review crawl scale-estimate proof',
                scaleRun.ok && scaleEvaluation?.passed ? 'PASSED' : 'FAILED',
                {
                    executionStatus: scaleRun.status,
                    stdout: scaleRun.stdout.trim(),
                    stderr: scaleRun.stderr.trim(),
                    artifactFileName: path.basename(scaleOutputPath),
                    evaluation: scaleEvaluation,
                },
                false,
            ),
        )
    } else {
        checks.push(
            buildCheck(
                'reviewCrawlScaleEstimate',
                'Review crawl scale-estimate proof',
                'SKIPPED',
                {
                    message:
                        'No live Google Maps URL was supplied for scale estimation. Merchant/read and worker-pressure proofs still ran.',
                },
                false,
            ),
        )
    }

    const finishedAt = new Date()
    const overallStatus = buildOverallStatus(checks)
    const report = {
        benchmark: {
            startedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - startedAt.getTime(),
            mode: 'performance_proof',
        },
        configuration: {
            merchant: {
                extraReviews: merchantOptions.extraReviews,
                concurrency: merchantOptions.concurrency,
                rounds: merchantOptions.rounds,
                timeoutMs: merchantOptions.timeoutMs,
                thresholds: merchantOptions.thresholds,
            },
            worker: {
                sourceCount: workerOptions.sourceCount,
                concurrency: workerOptions.concurrency,
                pagesPerRun: workerOptions.pagesPerRun,
                reviewsPerPage: workerOptions.reviewsPerPage,
                stepMs: workerOptions.stepMs,
                thresholds: workerOptions.thresholds,
            },
            scaleValidationConfigured: Boolean(scaleUrl),
            scaleTargetReviews,
        },
        overallStatus,
        checks,
        notes: [
            'This proof aggregates the local SMB merchant read harness and the local worker-pressure harness into a single pass/fail report.',
            'Performance numbers remain workstation-local evidence; they are useful for regression detection, not universal production SLA claims.',
            'Provide --scale-url when you want the proof to include live-source crawl scale estimation as well.',
        ],
    }

    const resolvedOutputPath = path.resolve(outputPath)
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
    fs.writeFileSync(
        resolvedOutputPath,
        `${JSON.stringify(normalizeForDigest(report), null, 2)}\n`,
    )

    process.stdout.write(
        `${JSON.stringify(
            {
                overallStatus,
                checks: checks.map((check) => ({
                    key: check.key,
                    status: check.status,
                })),
            },
            null,
            2,
        )}\n`,
    )
    process.stdout.write(`Performance proof report written to ${resolvedOutputPath}\n`)

    if (overallStatus === 'PERFORMANCE_PROOF_FAILED') {
        process.exitCode = 1
    }
}

main().catch((error) => {
    console.error(error?.stack || error?.message || String(error))
    process.exitCode = 1
})
