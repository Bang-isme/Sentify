#!/usr/bin/env node

const service = require('../src/modules/review-ops/review-ops.service')

function parseArgs(argv) {
    const args = {
        _: [],
    }

    for (let index = 0; index < argv.length; index += 1) {
        const value = argv[index]

        if (!value.startsWith('--')) {
            args._.push(value)
            continue
        }

        const key = value.slice(2)
        const nextValue = argv[index + 1]

        if (nextValue && !nextValue.startsWith('--')) {
            args[key] = nextValue
            index += 1
            continue
        }

        args[key] = true
    }

    return args
}

function requireArg(args, key) {
    const value = args[key]

    if (value === undefined || value === null || value === '') {
        throw new Error(`Missing required argument --${key}`)
    }

    return value
}

function parseOptionalNumber(args, key) {
    if (args[key] === undefined) {
        return undefined
    }

    const value = Number(args[key])

    if (!Number.isFinite(value)) {
        throw new Error(`--${key} must be a number`)
    }

    return value
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    const command = args._[0]

    if (!command) {
        throw new Error(
            'Missing command. Use one of: sync-draft, sources, run-status, batch-readiness, approve-valid',
        )
    }

    let result

    switch (command) {
        case 'sync-draft':
            result = await service.syncGoogleMapsToDraft({
                userId: requireArg(args, 'user-id'),
                input: {
                    restaurantId: requireArg(args, 'restaurant-id'),
                    url: requireArg(args, 'url'),
                    ...(args.language ? { language: args.language } : {}),
                    ...(args.region ? { region: args.region } : {}),
                    ...(args.strategy ? { strategy: args.strategy } : {}),
                    ...(args.priority ? { priority: args.priority } : {}),
                    ...(args['max-pages'] !== undefined
                        ? { maxPages: parseOptionalNumber(args, 'max-pages') }
                        : {}),
                    ...(args['max-reviews'] !== undefined
                        ? { maxReviews: parseOptionalNumber(args, 'max-reviews') }
                        : {}),
                    ...(args['page-size'] !== undefined
                        ? { pageSize: parseOptionalNumber(args, 'page-size') }
                        : {}),
                    ...(args['delay-ms'] !== undefined
                        ? { delayMs: parseOptionalNumber(args, 'delay-ms') }
                        : {}),
                },
            })
            break
        case 'sources':
            result = await service.listSources({
                userId: requireArg(args, 'user-id'),
                restaurantId: requireArg(args, 'restaurant-id'),
            })
            break
        case 'run-status':
            result = await service.getRunDetail({
                userId: requireArg(args, 'user-id'),
                runId: requireArg(args, 'run-id'),
            })
            break
        case 'batch-readiness':
            result = await service.getBatchReadiness({
                userId: requireArg(args, 'user-id'),
                batchId: requireArg(args, 'batch-id'),
            })
            break
        case 'approve-valid':
            result = await service.approveValidBatchItems({
                userId: requireArg(args, 'user-id'),
                batchId: requireArg(args, 'batch-id'),
                reviewerNote: args['reviewer-note'] || undefined,
            })
            break
        default:
            throw new Error(
                `Unknown command "${command}". Use one of: sync-draft, sources, run-status, batch-readiness, approve-valid`,
            )
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

main().catch((error) => {
    process.stderr.write(
        `${JSON.stringify(
            {
                error: {
                    code: error.code || 'REVIEW_OPS_CLI_FAILED',
                    message: error.message,
                },
            },
            null,
            2,
        )}\n`,
    )
    process.exitCode = 1
})
