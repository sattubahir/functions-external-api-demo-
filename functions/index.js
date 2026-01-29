
require("dotenv").config();
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

exports.qbAuth = functions.https.onRequest((req, res) => {
  const authUrl =
    "https://appcenter.intuit.com/connect/oauth2" +
    "?client_id=" + process.env.QB_CLIENT_ID +
    "&redirect_uri=" + encodeURIComponent(process.env.QB_REDIRECT_URI) +
    "&response_type=code" +
    "&scope=com.intuit.quickbooks.accounting" +
    "&state=test";

  res.redirect(authUrl);
});

// Auth callback to handle OAuth response
exports.qbAuthCallback = functions.https.onRequest(async (req, res) => {
  try {
    const code = req.query.code;
    const realmId = req.query.realmId;

    const tokenRes = await axios.post(
      "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.QB_REDIRECT_URI
      }),
      {
        auth: {
          username: process.env.QB_CLIENT_ID,
          password: process.env.QB_CLIENT_SECRET
        },
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    await db.collection("qb_tokens").doc("main").set({
      ...tokenRes.data,
      realmId
    });

    res.send("QuickBooks Connected Successfully!");
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("OAuth failed");
  }
});

//Real API function to get customers

exports.getQBCustomers = functions.https.onRequest(async (req, res) => {
  try {
    const tokenDoc = await db.collection("qb_tokens").doc("main").get();
    const { access_token, realmId } = tokenDoc.data();

    const qbRes = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query`,
      {
        params: { query: "select * from Customer" },
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json"
        }
      }
    );

    res.json(qbRes.data.QueryResponse.Customer);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Failed to fetch customers");
  }
});

// Function to sync customers to Firestore
exports.syncQBCustomers = functions.https.onRequest(async (req, res) => {
  try {
    const tokenDoc = await db.collection("qb_tokens").doc("main").get();
    const { access_token, realmId } = tokenDoc.data();

    const qbRes = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query`,
      {
        params: { query: "select * from Customer" },
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json"
        }
      }
    );

    const customers = qbRes.data.QueryResponse.Customer || [];
    const batch = db.batch();

    customers.forEach(c => {
      const ref = db.collection("qb_customers").doc(c.Id);
      batch.set(ref, {
        name: c.DisplayName,
        email: c.PrimaryEmailAddr?.Address || null,
        active: c.Active,
        syncedAt: new Date()
      });
    });

    await batch.commit();
    res.send(`Synced ${customers.length} customers`);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Sync failed");
  }
});
// Function to sync payments to Firestore
exports.syncQBPayments = functions.https.onRequest(async (req, res) => {
  try {
    const tokenDoc = await db.collection("qb_tokens").doc("main").get();
    const { access_token, realmId } = tokenDoc.data();

    const qbRes = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query`,
      {
        params: { query: "select * from Payment" },
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json"
        }
      }
    );

    const payments = qbRes.data.QueryResponse.Payment || [];
    const batch = db.batch();

    payments.forEach(p => {
      const ref = db.collection("qb_payments").doc(p.Id);
      batch.set(ref, {
        totalAmt: p.TotalAmt,
        customerRef: p.CustomerRef?.value || null,
        paymentMethod: p.PaymentMethodRef?.name || null,
        txnDate: p.TxnDate,
        status: p.PrivateNote || "NA",
        syncedAt: new Date()
      });
    });

    await batch.commit();
    res.send(`Synced ${payments.length} payments`);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Payment sync failed");
  }
});
``
//function to sync Vendors to Firestore

exports.syncQBVendors =  functions.https.onRequest(async (req, res) => {
  try {
    const tokenDoc = await db.collection("qb_tokens").doc("main").get();
    const { access_token, realmId } = tokenDoc.data();

    const qbRes = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query`,
      {
        params: { query: "select * from Vendor" },
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json"
        }
      }
    );

    const vendors = qbRes.data.QueryResponse.Vendor || [];
    const batch = db.batch();       
    vendors.forEach(v => {          
        const ref = db.collection("qb_vendors").doc(v.Id);
        batch.set(ref, {
            name: v.DisplayName,
            email: v.PrimaryEmailAddr?.Address || null,
            active: v.Active,
            syncedAt: new Date()
        });
    }
    );
    
    await batch.commit();
    res.send(`Synced ${vendors.length} vendors`);
  }
    catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Vendor sync failed");
  }
});

//Function to sync Item to Firestore
exports.syncQBItems = functions.https.onRequest(async (req, res) => {
  try {
    const tokenDoc = await db.collection("qb_tokens").doc("main").get();
    const { access_token, realmId } = tokenDoc.data();

    const qbRes = await axios.get(
      `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query`,
      {
        params: { query: "select * from Item" },
        headers: {
          Authorization: `Bearer ${access_token}`,
          Accept: "application/json"
        }
      }
    );

    const items = qbRes.data.QueryResponse.Item || [];
    const batch = db.batch();

    items.forEach(i => {
      const ref = db.collection("qb_items").doc(i.Id);
      batch.set(ref, {                  
        name: i.Name,
        type: i.Type,
        active: i.Active,
        unitPrice: i.UnitPrice || null,
        qtyOnHand: i.QtyOnHand || null,
        syncedAt: new Date()
      });
    });

    await batch.commit();
    res.send(`Synced ${items.length} items`);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).send("Item sync failed");
  }
}); 

// Additional functions can be added similarly