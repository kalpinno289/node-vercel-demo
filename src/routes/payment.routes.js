const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/payment.controller');

// router.post('/create-order', PaymentController.createOrder);
// router.post('/verify-payment', PaymentController.verifyPayment);


router.post('/getOrderDetails', PaymentController.orderDetails);
router.post('/updateOrder', PaymentController.updateOrder);
router.post('/createOrder', PaymentController.createOrder);
router.post('/checkPayment', PaymentController.checkPayment);
router.post('/razorpay-webhook', PaymentController.razorpayWebhook);


module.exports = router;