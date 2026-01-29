// const functions = require("firebase-functions");
// const { appendRow } = require("../integrations/googleSheets");

// exports.syncCustomerToSheet = functions.firestore
//   .document("customers/{id}")
//   .onCreate(async (snap, context) => {
//     const data = snap.data();
//     const id = context.params.id;

//     const row = [
//       id,
//       data.name || "",
//       data.email || "",
//       data.phone || "",
//       new Date().toISOString(),
//     ];

//     await appendRow(row);
//   });
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { appendRow } = require("../integrations/googleSheets");

exports.syncCustomerToSheet = onDocumentCreated(
  "customers/{id}",
  async (event) => {
    const data = event.data.data();
    const id = event.params.id;

    const row = [
      id,
      data.name || "",
      data.email || "",
      data.phone || "",
      new Date().toISOString(),
    ];

    await appendRow(row);
  }
);
