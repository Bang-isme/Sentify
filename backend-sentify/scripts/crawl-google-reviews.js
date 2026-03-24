#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

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

function printUsage() {
    console.error(
        [
            'Usage:',
            '  node scripts/crawl-google-reviews.js --url <google-maps-url> [options]',
            '',
            'Options:',
            '  --language <code>       Default: en',
            '  --region <code>         Default: us',
            '  --sort <value>          relevant | newest | highest_rating | lowest_rating',
            '  --pages <n|max>         Default: 1',
            '  --page-size <n>         Default: 20',
            '  --max-reviews <n>       Optional cap on extracted reviews',
            '  --delay-ms <n>          Delay between page fetches, default 500',
            '  --search-query <text>   Optional Google review search filter',
            '  --output <file>         Write JSON to file instead of stdout',
        ].join('\n'),
    )
}

async function main() {
    const args = process.argv.slice(2)
    const rawPages = readFlag(args, '--pages')

    const parsedInput = crawlGoogleMapsOptionsSchema.parse({
        url: readFlag(args, '--url'),
        language: readFlag(args, '--language'),
        region: readFlag(args, '--region'),
        sort: readFlag(args, '--sort'),
        pages: rawPages === 'max' ? 'max' : rawPages,
        pageSize: readFlag(args, '--page-size'),
        maxReviews: readFlag(args, '--max-reviews'),
        delayMs: readFlag(args, '--delay-ms'),
        searchQuery: readFlag(args, '--search-query'),
    })

    const result = await crawlGoogleMapsReviews(parsedInput)
    const outputPath = readFlag(args, '--output')
    const payload = `${JSON.stringify(result, null, 2)}\n`

    if (!outputPath) {
        process.stdout.write(payload)
        return
    }

    const resolvedOutputPath = path.resolve(outputPath)
    fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
    fs.writeFileSync(resolvedOutputPath, payload, 'utf8')
    process.stdout.write(`${resolvedOutputPath}\n`)
}

main().catch((error) => {
    if (error?.name === 'ZodError') {
        printUsage()
        console.error(JSON.stringify(error.issues, null, 2))
        process.exit(1)
    }

    console.error(error?.stack || error?.message || String(error))
    process.exit(1)
})
