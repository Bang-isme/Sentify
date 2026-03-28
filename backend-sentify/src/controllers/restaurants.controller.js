const { z } = require('zod')

const { handleControllerError } = require('../lib/controller-error')
const restaurantService = require('../services/restaurant.service')

const SUPPORTED_GOOGLE_MAPS_SHORT_HOSTS = new Set(['maps.app.goo.gl', 'g.co', 'goo.gl'])

function isSupportedGoogleMapsUrl(value) {
    try {
        const parsedUrl = new URL(value)
        const hostname = parsedUrl.hostname.toLowerCase()

        if (SUPPORTED_GOOGLE_MAPS_SHORT_HOSTS.has(hostname)) {
            return true
        }

        return (
            ['google.com', 'www.google.com', 'maps.google.com'].includes(hostname) &&
            parsedUrl.pathname.startsWith('/maps')
        )
    } catch {
        return false
    }
}

const googleMapsUrlSchema = z
    .string()
    .trim()
    .url()
    .refine(isSupportedGoogleMapsUrl, {
        message: 'Google Maps URL must point to a public Google Maps place',
    })

const createRestaurantSchema = z.object({
    name: z.string().trim().min(1, 'Restaurant name is required').max(120),
    address: z.string().trim().max(255).optional(),
    googleMapUrl: googleMapsUrlSchema.optional(),
})

const updateRestaurantSchema = z
    .object({
        name: z.string().trim().min(1).max(120).optional(),
        address: z.union([z.string().trim().max(255), z.null()]).optional(),
        googleMapUrl: z.union([googleMapsUrlSchema, z.null()]).optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, {
        message: 'At least one field is required',
    })

const previewSourceSubmissionSchema = z.object({
    googleMapUrl: googleMapsUrlSchema,
    language: z.string().trim().min(2).max(8).optional(),
    region: z.string().trim().min(2).max(8).optional(),
})

async function createRestaurant(req, res) {
    try {
        const input = createRestaurantSchema.parse(req.body)
        const result = await restaurantService.createRestaurant({
            userId: req.user.userId,
            ...input,
        })

        return res.status(201).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function listRestaurants(req, res) {
    try {
        const result = await restaurantService.listRestaurants({
            userId: req.user.userId,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getRestaurantDetail(req, res) {
    try {
        const result = await restaurantService.getRestaurantDetail({
            userId: req.user.userId,
            restaurantId: req.params.id,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function getRestaurantSourceSubmissionHistory(req, res) {
    try {
        const result = await restaurantService.getRestaurantSourceSubmissionHistory({
            userId: req.user.userId,
            restaurantId: req.params.id,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function updateRestaurant(req, res) {
    try {
        const input = updateRestaurantSchema.parse(req.body)
        const result = await restaurantService.updateRestaurant({
            userId: req.user.userId,
            restaurantId: req.params.id,
            ...input,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

async function previewSourceSubmission(req, res) {
    try {
        const input = previewSourceSubmissionSchema.parse(req.body)
        const result = await restaurantService.previewSourceSubmission({
            userId: req.user.userId,
            restaurantId: req.params.id,
            ...input,
        })

        return res.status(200).json({
            data: result,
        })
    } catch (error) {
        return handleControllerError(req, res, error)
    }
}

module.exports = {
    createRestaurant,
    listRestaurants,
    getRestaurantDetail,
    getRestaurantSourceSubmissionHistory,
    previewSourceSubmission,
    updateRestaurant,
}
