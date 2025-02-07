const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();


// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});



class PaymentController {

  /**
   * Checks the status and details of a payment using the payment ID
   * @param {Object} req - Request object containing paymentId in body
   * @param {Object} res - Response object
   * @returns {Object} Payment details or error message
   */
  static async checkPayment(req, res) {
    try {
      const { paymentId } = req.body;
      
      if (!paymentId) {
        return res.status(400).json({ error: "Payment ID is required" });
      }

      const paymentDetails = await razorpay.payments.fetch(paymentId);

      if (paymentDetails) {
        res.status(200).json({ message: "Payment details fetched successfully", code: 200, data: paymentDetails });
      } else {
        res.status(400).json({ message: "Failed to fetch payment details", code: 400 });
      }

    } catch (error) {
      res.status(500).json({
        message: error,
        code: 500
      });
    }
  }

  /**
   * Fetches order details using the order ID
   * @param {Object} req - Request object containing orderId in body
   * @param {Object} res - Response object
   * @returns {Object} Order details or error message
   */
  static async orderDetails(req, res) {
    try {
      const { orderId } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      const orderDetails = await razorpay.orders.fetch(orderId);

      if (orderDetails) {
        res.status(200).json({ message: "Order details fetched successfully", code: 200, data: orderDetails });
      } else {
        res.status(400).json({ message: "Failed to fetch order details", code: 400 });
      }
      
    } catch (error) {
      res.status(500).json({
        message: error,
        code: 500
      });
    }
  }

  /**
   * Updates an existing order with payment receipt ID and other details
   * @param {Object} req - Request object containing orderId and pmtRecID in body
   * @param {Object} res - Response object
   * @returns {Object} Updated order details or error message
   */
  static async updateOrder(req, res) {
    try {
      const { orderId, pmtRecID } = req.body;
      
      if (!orderId || !pmtRecID) {
        return res.status(400).json({ error: "Order ID and Payment Receipt ID are required" });
      }

      const response = await razorpay.orders.fetch(orderId);

      if (!response.notes) {
        return res.status(400).json({ message: "Order notes not found", code: 400 });
      }

      const notes = response.notes;
      const updateNotes = {
        "PmtRecID": pmtRecID,
        "APPReqNo": notes.APPReqNo,
        "PtnNo": notes.PtnNo, 
        "SchDt": notes.SchDt,
        "FctMainCd": notes.FctMainCd,
        "FctCd": notes.FctCd,
        "SessionCd": notes.SessionCd,
        "SlotNo": notes.SlotNo
      };

      const updatedOrder = await razorpay.orders.edit(orderId, {
        notes: JSON.stringify(updateNotes)
      });

      res.status(200).json({
        message: "Order updated successfully",
        code: 200,
        data: updatedOrder
      });

    } catch (error) {
      res.status(500).json({
        message: error,
        code: 500
      });
    }
  }

  /**
   * Creates a new payment order
   * @param {Object} req - Request object containing amount and meta data in body
   * @param {Object} res - Response object
   * @returns {Object} Created order ID or error message
   */
  static async createOrder(req, res) {
    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ 
          message: "Invalid request",
          code: 400
        });
      }

      const { amount, meta } = req.body;

      const options = {
        amount: amount,
        currency: "INR", 
        notes: meta
      };

      const response = await razorpay.orders.create(options);

      if (response.status === 'created') {
        res.status(200).json({
          message: "Order generated successfully",
          code: 200,
          data: {
            orderId: response.id
          }
        });
      } else {
        res.status(400).json({
          message: "Error generating order",
          code: 400
        });
      }

    } catch (error) {
      res.status(500).json({
        message: error,
        code: 500
      });
    }
  }

  /**
   * Handles Razorpay webhook events for payment status updates
   * Verifies webhook signature and updates payment and appointment status
   * @param {Object} req - Request object containing webhook payload and signature
   * @param {Object} res - Response object
   * @returns {Object} Success or error message
   */
  static async razorpayWebhook(req, res) {
    try {
      const body = JSON.stringify(req.body);
      const signature = req.header('X-Razorpay-Signature');
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

      const hash = crypto.createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      if (hash !== signature) {
        console.error('Webhook verification failed');
        return res.status(400).json({
          message: "Webhook Error: Signature verification failed",
          code: 400
        });
      }

      console.log('Webhook verified and received:', req.body);

      const backendUrl = process.env.BACKEND_URL + "api/patientportal/NewUserLogin?UId=guestuser&UPwd=mob@guest$user";
      let config = { method: 'get', maxBodyLength: Infinity, url: backendUrl, headers: {} };

      const tokenResponse = await axios.request(config);
      let token = '';
      if (tokenResponse && tokenResponse.data) {
        token = tokenResponse.data.data.token;
      }

      let updatePaymentUrl = '';
      let updateAppointmentUrl = '';
      // let releaseSlot = '';
      let updateAppointmentData = {};

      const ApptReqNo = req.body.payload.payment.entity.notes.APPReqNo;
      const PmtRecID = req.body.payload.payment.entity.notes.PmtRecID;

      if (req.body.event === 'payment.captured') {
        const paymentId = req.body.payload.payment.entity.id;
        console.log('Payment captured:', paymentId);

        updatePaymentUrl = process.env.BACKEND_URL + `api/patientportal/UpdtPmtGatewayDtlPortal?PmtParam={"OnlinePmtSuccessFlg":1,"PmtStatus":"S","PmtStatusDesc":"Successfully","PmtRecID":${PmtRecID}}`;
        updateAppointmentUrl = process.env.BACKEND_URL + 'api/patientportal/UpdtDocApptReqForPortal?objPost=';

        updateAppointmentData = {"COCD":"1","LOCCD":1,"DIVCD":1,"ApptReqNo":ApptReqNo,"ReqStsCd":1,"AptmSts":4,"PmtRecID":PmtRecID,"IsPmtDone":1 };
      }

      if (req.body.event === 'payment.failed') {
        const paymentId = req.body.payload.payment.entity.id;
        console.log('Payment failed:', paymentId);

        updatePaymentUrl = process.env.BACKEND_URL + `api/patientportal/UpdtPmtGatewayDtlPortal?PmtParam={"OnlinePmtSuccessFlg":0,"PmtStatus":"F","PmtStatusDesc":"Failed","PmtRecID":${PmtRecID}}`;
        updateAppointmentUrl = process.env.BACKEND_URL + 'api/patientportal/UpdtDocApptReqForPortal?objPost=';

        updateAppointmentData = {"COCD":"1","LOCCD":1,"DIVCD":1,"ApptReqNo":ApptReqNo,"ReqStsCd":1,"AptmSts":3,"PmtRecID":PmtRecID,"IsPmtDone":0 };
      }

      // Update Payment
      if (updatePaymentUrl !== '') {
        let config = { method: 'post', maxBodyLength: Infinity, url: backendUrl, headers: {} };
        const tokenResponse = await axios.request(config);
        if (tokenResponse && tokenResponse.data) {
          token = tokenResponse.data.data.token;
          await axios.request({ method: 'get', maxBodyLength: Infinity, url: updatePaymentUrl, headers: { TokenHeader: token } });
        }
      }

      // Update Appointment
      if (updateAppointmentUrl !== '') {
        let config = { method: 'post', maxBodyLength: Infinity, url: backendUrl, headers: {} };
        const tokenResponse = await axios.request(config);
        if (tokenResponse && tokenResponse.data) {
          token = tokenResponse.data.data.token;

          await axios.request({
            method: 'post',
            maxBodyLength: Infinity,
            url: updateAppointmentUrl,
            headers: {
              TokenHeader: token,
              'Content-Type': 'application/json'
            },
            data: JSON.stringify(updateAppointmentData)
          });
        }
      }

      res.status(200).json({
        message: "Webhook processed successfully",
        code: 200
      });

    } catch (error) {
      res.status(500).json({
        message: error,
        code: 500
      });
    }
  }
}

module.exports = PaymentController;