const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

// Define secrets (best practice for production, but using process.env for now as requested)
// const deepSeekApiKey = defineSecret("DEEPSEEK_API_KEY");

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";

/**
 * Helper to call DeepSeek API
 * @param {string} prompt - The user prompt or system instruction
 * @param {string} model - The model to use (default: deepseek-chat)
 * @returns {Promise<string>} - The AI response text
 */
async function callDeepSeek(messages, model = "deepseek-chat") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
        throw new HttpsError("failed-precondition", "DeepSeek API key is not configured.");
    }

    try {
        const response = await axios.post(
            DEEPSEEK_API_URL,
            {
                model: model,
                messages: messages,
                temperature: 0.3, // Lower temperature for more deterministic financial answers
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error("DeepSeek API Error:", error.response?.data || error.message);
        throw new HttpsError("internal", "Failed to communicate with AI service.");
    }
}

const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

/**
 * Fetches financial context for the company
 */
async function fetchFinancialContext(companyId) {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

    // Fetch Invoices (Revenue) since start of month
    const invoicesSnap = await db.collection("invoices")
        .where("companyId", "==", companyId)
        .where("issueDate", ">=", firstDayOfMonth)
        .get();

    let totalRevenue = 0;
    let pendingRevenue = 0;
    invoicesSnap.forEach(doc => {
        const data = doc.data();
        if (data.status === 'paid') totalRevenue += (data.total || 0);
        if (data.status === 'pending') pendingRevenue += (data.total || 0);
    });

    // Fetch Expenses since start of month
    const expensesSnap = await db.collection("expenses")
        .where("companyId", "==", companyId)
        .where("date", ">=", firstDayOfMonth)
        .get();

    let totalExpenses = 0;
    const expenseCategories = {};
    expensesSnap.forEach(doc => {
        const data = doc.data();
        const amount = data.amount || 0;
        totalExpenses += amount;

        const category = data.category || "Uncategorized";
        expenseCategories[category] = (expenseCategories[category] || 0) + amount;
    });

    // Sort top expenses
    const topExpenses = Object.entries(expenseCategories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([cat, amount]) => `${cat}: ZMW ${amount.toFixed(2)}`);

    return {
        period: "Current Month",
        totalRevenue,
        pendingRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
        topExpenses
    };
}

/**
 * Callable function for general financial Q&A or analysis
 * Usage: functions.httpsCallable('askDeepSeek')({ query: "How am I doing?", includeFinancialContext: true })
 */
exports.askDeepSeek = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const query = request.data.query;
    const includeFinancialContext = request.data.includeFinancialContext || false; // New flag
    let context = request.data.context || {}; // Client provided context

    if (!query) {
        throw new HttpsError("invalid-argument", "Query is required.");
    }

    // If requested, verify company membership and fetch real data
    if (includeFinancialContext) {
        // We need to determine companyId. Ideally passed in data, or resolved from user profile.
        // For now, let's assume client sends companyId, OR we pick primary.
        // Replicating pickPrimary logic locally to avoid dependency issues or messy exports.
        const uid = request.auth.uid;
        let companyId = request.data.companyId;

        if (!companyId) {
            const snap = await db.collection("companyUsers")
                .where("userId", "==", uid)
                .where("status", "==", "active")
                .limit(1).get();
            if (!snap.empty) companyId = snap.docs[0].data().companyId;
        }

        if (companyId) {
            try {
                const financialData = await fetchFinancialContext(companyId);
                context = { ...context, financialSummary: financialData };
            } catch (err) {
                console.error("Error fetching financial context:", err);
                // Continue without it rather than failing?
            }
        }
    }

    const messages = [
        {
            role: "system",
            content: `You are a helpful and precise financial assistant for ZedBooks, an accounting platform for Zambian businesses. 
      Your role is to analyze financial data, explain accounting concepts, and provide actionable business insights.
      Always be professional, concise, and accurate. Use Zambian Kwacha (ZMW) as the currency context if needed.
      
      Current Date: ${new Date().toISOString().split('T')[0]}
      
      User's Financial Context (if available):
      ${JSON.stringify(context, null, 2)}`,
        },
        {
            role: "user",
            content: query,
        },
    ];

    const answer = await callDeepSeek(messages);
    return { answer };
});

/**
 * Callable function to analyze a transaction for anomalies
 * Usage: functions.httpsCallable('analyzeTransactionAnomaly')({ transaction: { ... } })
 */
exports.analyzeTransactionAnomaly = onCall(async (request) => {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const transaction = request.data.transaction;
    if (!transaction) {
        throw new HttpsError("invalid-argument", "Transaction data is required.");
    }

    const messages = [
        {
            role: "system",
            content: `You are an AI auditor. Analyze the following transaction for potential anomalies, fraud, or data entry errors.
      Consider factors like:
      - Unusual amounts (too high/low)
      - Mismatched categories
      - Suspicious descriptions
      - Duplicate potential
      
      Respond with a JSON object in this format:
      {
        "isAnomalous": boolean,
        "riskLevel": "low" | "medium" | "high",
        "reason": "string explanation",
        "suggestedAction": "string"
      }
      Do not include markdown formatting, just the raw JSON.`,
        },
        {
            role: "user",
            content: JSON.stringify(transaction),
        },
    ];

    const responseText = await callDeepSeek(messages);

    try {
        // Clean up potential markdown code blocks if the AI includes them
        const jsonString = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
        const analysis = JSON.parse(jsonString);
        return analysis;
    } catch (error) {
        console.error("Failed to parse AI response:", responseText);
        return {
            isAnomalous: false,
            riskLevel: "unknown",
            reason: "Failed to parse AI analysis.",
            rawResponse: responseText
        };
    }
});
