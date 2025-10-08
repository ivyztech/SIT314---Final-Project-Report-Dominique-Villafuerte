const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');


const ddb = new AWS.DynamoDB.DocumentClient();
const sqs = new AWS.SQS();


const TABLE_NAME = process.env.TABLE_NAME;
const QUEUE_URL = process.env.QUEUE_URL;
const API_KEY = process.env.API_KEY;


exports.handler = async (event) => {
try {
// Simple API key gate (httpApi doesn't support API keys easily)
const headers = event.headers || {};
const key = headers['x-api-key'] || headers['X-Api-Key'];
if (!API_KEY || key !== API_KEY) {
return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
}


const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
const { ticketId, issuer = 'tixster', scanTs, deviceId = 'scanner-unknown', nonce } = body || {};


if (!ticketId || !scanTs) {
return { statusCode: 400, body: JSON.stringify({ error: 'ticketId and scanTs required' }) };
}


const now = Date.now();
const traceId = `ing-${uuidv4()}`;
const pk = `TICKET#${ticketId}`;
const sk = `EVENT#${now}`;


// Record receipt
await ddb.put({
TableName: TABLE_NAME,
Item: {
pk, sk, status: 'RECEIVED', issuer, deviceId,
scanTs, traceId, nonce: nonce || uuidv4(),
}
}).promise();


// Enqueue for risk scoring
await sqs.sendMessage({
QueueUrl: QUEUE_URL,
MessageBody: JSON.stringify({ ticketId, deviceId, traceId, receivedAt: now })
}).promise();


return { statusCode: 202, body: JSON.stringify({ ok: true, traceId }) };
} catch (err) {
console.error('Validator error', err);
return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
}
};