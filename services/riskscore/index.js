const WORK_DELAY_MS = Number(process.env.WORK_DELAY_MS || 200); // Phase A slow
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();


const TABLE_NAME = process.env.TABLE_NAME;
const DUP_WINDOW_MS = 15000; // treat rapid re-scans as USED


exports.handler = async (event) => {
const records = event.Records || [];


for (const r of records) {
try {
const msg = JSON.parse(r.body);
const { ticketId, deviceId, traceId, receivedAt } = msg;
const pk = `TICKET#${ticketId}`;


// Pull last few events for this ticket
const q = await ddb.query({
TableName: TABLE_NAME,
KeyConditionExpression: 'pk = :pk',
ExpressionAttributeValues: { ':pk': pk },
ScanIndexForward: false,
Limit: 5
}).promise();


const recent = q.Items || [];
const last = recent[0];
const now = Date.now();


// Simple logic: if scanned again within DUP_WINDOW -> USED
let status = 'VALID';


if (recent.some(e => e.status === 'USED')) {
status = 'USED';
} else if (last && last.scanTs && Math.abs(Number(last.scanTs) - Number(receivedAt)) < DUP_WINDOW_MS) {
status = 'USED';
} else if (/FAKE|ZZZ/.test(ticketId) || Math.random() < 0.05) {
// simulate some fakes
status = 'FAKE';
}


await ddb.put({
TableName: TABLE_NAME,
Item: {
pk,
sk: `EVENT#${now}`,
status,
deviceId,
traceId,
riskScore: status === 'VALID' ? 5 : (status === 'USED' ? 80 : 95)
}
}).promise();

await sleep(WORK_DELAY_MS);



} catch (err) {
console.error('RiskScore error', err);
// throw to force SQS retry and DLQ if it keeps failing
throw err;
}
}
};