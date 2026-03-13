function roundNumber(value, digits = 1) {
    return Number(Number(value || 0).toFixed(digits))
}

function toPercentage(count, total) {
    if (!total) {
        return 0
    }

    return roundNumber((count / total) * 100, 1)
}

module.exports = {
    roundNumber,
    toPercentage,
}
