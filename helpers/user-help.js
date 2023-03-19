var db = require('../config/connection')
const bcrypt = require("bcrypt")
const collection = require('../config/collections')
const { reject, resolve } = require('promise')
const { ObjectId } = require('mongodb')
const { response } = require('../app')
var objectId = require('mongodb').ObjectId
const Razorpay = require('razorpay')
var instance = new Razorpay({ key_id: 'rzp_test_62g6dzrTvkv70G', key_secret: 'aTu2fBBJLfOixKbDBn4P60iv' })

module.exports = {

    doSignup: (userData) => {
        return new Promise(async (resolve, reject) => {
            userData.Password = await bcrypt.hash(userData.Password, 10)
            db.get().collection(collection.USER_COLLECTION).insertOne(userData).then(() => {
                resolve(userData)
            })

        })
    },
    doLogin: (userData) => {
        return new Promise(async (resolve, reject) => {

            let response = {}
            let user = await db.get().collection(collection.USER_COLLECTION).findOne({ Email: userData.Email })
            if (user) {
                bcrypt.compare(userData.Password, user.Password).then((status) => {
                    if (status) {
                        console.log("login success")
                        response.user = user
                        response.status = true
                        resolve(response)
                    } else {
                        console.log("login failed")
                        resolve({ status: false })
                    }
                })

            } else {
                console.log("login failed")
            }
        })
    },
    addToCart: (proId, userId) => {
        let proObj = {
            item: new objectId(proId),
            quantity: 1
        }
        return new Promise(async (resolve, reject) => {
            let userCart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new objectId(userId) })
            if (userCart) {
                let proExist = userCart.products.findIndex(product => product.item == proId)
                if (proExist != -1) {
                    db.get().collection(collection.CART_COLLECTION).updateOne({ user: new objectId(userId), 'products.item': new objectId(proId) },
                        {
                            $inc: { 'products.$.quantity': 1 }
                        }
                    ).then(() => {
                        resolve()
                    })
                } else {
                    db.get().collection(collection.CART_COLLECTION).updateOne({ user: new objectId(userId) },
                        {

                            $push: { products: proObj }
                        }
                    ).then((response) => {
                        resolve(response)
                        console.log(response);

                    })
                }


            } else {
                let cartObj = {
                    user: new objectId(userId),
                    products: [proObj],
                }
                db.get().collection(collection.CART_COLLECTION).insertOne(cartObj).then((response) => {
                    resolve(response)
                    console.log(response);
                })
            }
        })
    },
    getCartProducts: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cartItems = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: new objectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                }

            ]).toArray()

            resolve(cartItems)
        })
    },
    getCartCount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let count = 0
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new objectId(userId) })
            if (cart) {
                count = cart.products.length
            }
            resolve(count)
        })
    },
    changeProductQuantity: (details) => {

        details.count = parseInt(details.count)
        details.quantity = parseInt(details.quantity)


        return new Promise((resolve, reject) => {
            if (details.count == -1 && details.quantity == 1) {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne({ _id: new objectId(details.cart) },
                        {
                            $pull: { products: { item: new objectId(details.product) } }
                        }
                    ).then((response) => {
                        resolve({ removeProduct: true })

                    })

            } else {
                db.get().collection(collection.CART_COLLECTION)
                    .updateOne({ _id: new objectId(details.cart), 'products.item': new objectId(details.product) },
                        {
                            $inc: { 'products.$.quantity': details.count }
                        }
                    ).then((response) => {
                        resolve({ status: true })

                    })
            }
        })
    },
    removeProduct: (details) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.CART_COLLECTION).updateOne({ _id: new objectId(details.cart) },
                {
                    $pull: { products: { item: new objectId(details.product) } }
                }
            ).then((response) => {
                resolve({ removeProduct: true })
            })
        })
    },
    getTotalAmount: (userId) => {
        return new Promise(async (resolve, reject) => {
            let total = await db.get().collection(collection.CART_COLLECTION).aggregate([
                {
                    $match: { user: new objectId(userId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity'
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $multiply: [{ $toInt: '$quantity' }, { $toInt: '$product.Price' }] } }
                    }
                }


            ]).toArray()

            if (total[0]) {
                resolve(total[0].total)
            } else {
                resolve([])
            }
        })
    },
    placeOrder: (order, products, total) => {
        return new Promise((resolve, reject) => {
            let status = order['payment-method'] === 'COD' ? 'placed' : 'pending'
            let orderObj = {
                DeliveryDetails: {
                    mobile: order.mobile,
                    address: order.address,
                    pincode: order.pincode
                },
                userId: new objectId(order.userId),
                paymentMethod: order['payment-method'],
                products: products,
                totalAmount: total,
                status: status,
                date: new Date()
            }
            db.get().collection(collection.ORDER_COLLECTION).insertOne(orderObj).then((response) => {
                db.get().collection(collection.CART_COLLECTION).deleteOne({ user: new objectId(order.userId) })
                resolve(response.insertedId)
            })
        })
    },
    getCartProductList: (userId) => {
        return new Promise(async (resolve, reject) => {
            let cart = await db.get().collection(collection.CART_COLLECTION).findOne({ user: new objectId(userId) })
            resolve(cart.products)
        })
    },
    getUserOrder: (userId) => {
        return new Promise(async (resolve, reject) => {
            let orders = await db.get().collection(collection.ORDER_COLLECTION)
                .find({ userId: new objectId(userId) }).toArray()

            resolve(orders)
        })
    },
    getOrderProducts: (orderId) => {

        return new Promise(async (resolve, reject) => {
            let orderItems = await db.get().collection(collection.ORDER_COLLECTION).aggregate([
                {
                    $match: { _id: new objectId(orderId) }
                },
                {
                    $unwind: '$products'
                },
                {
                    $project: {
                        item: '$products.item',
                        quantity: '$products.quantity',
                    }
                },
                {
                    $lookup: {
                        from: collection.PRODUCT_COLLECTION,
                        localField: 'item',
                        foreignField: '_id',
                        as: 'product'
                    }
                },
                {
                    $project: {
                        item: 1, quantity: 1, name: 1, price: 1, product: { $arrayElemAt: ['$product', 0] }
                    }
                }

            ]).toArray()


            resolve(orderItems)

        })
    },
    generateRazorpay: (orderId, total) => {
        return new Promise((resolve, reject) => {
            var options = {
                amount: total * 100,
                currency: "INR",
                receipt: '' + orderId
            }
            instance.orders.create(options, function (err, order) {
                console.log(order);
                if (err) {
                    console.log(err);
                } else {
                    console.log('success');
                    resolve(order)
                }
            })
        })
    },
    verifyPayment: (details) => {
        return new Promise((resolve, reject) => {
            const crypto = require('crypto')
            let verify = crypto.createHmac('sha256', 'aTu2fBBJLfOixKbDBn4P60iv')

            verify.update(details['payment[razorpay_order_id]'] + '|' + details['payment[razorpay_payment_id]'])
            verify = verify.digest('hex')

            if (verify = details['payment[razorpay_signature]']) {
                resolve()
            } else {
                reject()
            }

        })
    },
    changePaymentStatus: (orderId) => {
        return new Promise((resolve, reject) => {
            db.get().collection(collection.ORDER_COLLECTION)
                .updateOne({ _id: new objectId(orderId) },
                    {
                        $set: {
                            status: 'placed'
                        }
                    }
                ).then(() => {
                    resolve()
                })
        })
    }
}
