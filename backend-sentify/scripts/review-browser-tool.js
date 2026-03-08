#!/usr/bin/env node

const { scrapeGoogleReviewsWithBrowser } = require('../src/services/google-browser-review-tool.service')

function parseArgs(argv) {
    const parsedArgs = {
        _: [],
    }

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index]

        if (!argument.startsWith('--')) {
            parsedArgs._.push(argument)
            continue
        }

        const key = argument.slice(2)
        const nextValue = argv[index + 1]

        if (!nextValue || nextValue.startsWith('--')) {
            parsedArgs[key] = true
            continue
        }

        parsedArgs[key] = nextValue
        index += 1
    }

    return parsedArgs
}

async function main() {
    const args = parseArgs(process.argv.slice(2))
    const googleMapUrl =
        typeof args.url === 'string'
            ? args.url.trim()
            : typeof args._[0] === 'string'
              ? args._[0].trim()
              : ''

    if (!googleMapUrl) {
        console.error(
            'Usage: npm run reviews:tool -- "https://www.google.com/maps/place/..."',
        )
        process.exitCode = 1
        return
    }

    const reviews = await scrapeGoogleReviewsWithBrowser({
        googleMapUrl,
        restaurantName: typeof args.name === 'string' ? args.name.trim() : undefined,
        restaurantAddress: typeof args.address === 'string' ? args.address.trim() : undefined,
    })

    process.stdout.write(
        `${JSON.stringify(
            {
                total: reviews.length,
                reviews,
            },
            null,
            2,
        )}\n`,
    )
}

main().catch((error) => {
    console.error(
        JSON.stringify(
            {
                code: error?.code || 'TOOL_FAILED',
                message: error?.message || 'Unknown error',
                details: error?.details,
            },
            null,
            2,
        ),
    )
    process.exitCode = 1
})
