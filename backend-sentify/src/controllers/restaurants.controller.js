const { z } = require('zod')

const { handleControllerError } = require('../lib/controller-error')
const restaurantService = require('../services/restaurant.service')

const createRestaurantSchema = z.object({
    name: z.string().trim().min(1, 'Restaurant name is required').max(120),
    address: z.string().trim().max(255).optional(),
    googleMapUrl: z.string().trim().url().optional(),
})

const updateRestaurantSchema = z
    .object({
        name: z.string().trim().min(1).max(120).optional(),
        address: z.union([z.string().trim().max(255), z.null()]).optional(),
        googleMapUrl: z.union([z.string().trim().url(), z.null()]).optional(),
    })
    .refine((payload) => Object.keys(payload).length > 0, {
        message: 'At least one field is required',
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

module.exports = {
    createRestaurant,
    listRestaurants,
    getRestaurantDetail,
    updateRestaurant,
}
