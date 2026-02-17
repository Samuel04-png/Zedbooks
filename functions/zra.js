const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Stub function to Simulate ZRA Invoice Signing
 * In production, this would communicate with the ZRA VSDC (Virtual Sales Data Controller)
 */
exports.signInvoice = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in to sign invoices.");
    }

    const { invoiceId, companyId } = request.data;

    if (!invoiceId || !companyId) {
        throw new HttpsError("invalid-argument", "Missing invoiceId or companyId.");
    }

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock ZRA Response
    const mockZraData = {
        zraStatus: "submitted",
        zraInvoiceNumber: `ZRA-${Math.floor(Math.random() * 1000000)}`,
        zraQrCode: "https://zra.org.zm/verify?id=" + invoiceId,
        zraVsdcDate: new Date().toISOString(),
    };

    // Update Firestore with ZRA details
    await admin.firestore().collection("invoices").doc(invoiceId).update(mockZraData);

    return {
        success: true,
        message: "Invoice successfully signed by ZRA (Simulated)",
        data: mockZraData
    };
});
